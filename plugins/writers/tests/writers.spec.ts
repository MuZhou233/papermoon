import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { WriterRepository } from '../src/repository.ts'
import {
  createWriterTemplate,
  DEFAULT_WRITER_PROMPT,
  resolveWriterContext,
  type WriterDefinition,
} from '../src/model.ts'
import { createDispatcher } from '../src/service.ts'
import { WriterStore } from '../src/client/store.ts'
import type { Api } from '../src/client/api.ts'
const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-writers-')),
    path = join(directory, 'writers.sqlite')
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  const repository = new WriterRepository({ path })
  cleanups.push(() => repository.close())
  return { path, repository }
}
function definition(): WriterDefinition {
  return {
    name: 'Writer',
    systemPrompt: 'Literal {{name}}\r\n系统',
    systemPromptName: 'Role',
    messages: [
      { id: 'a', name: 'Opening', role: 'assistant', content: '' },
      { id: 'b', role: 'assistant', content: 'answer\r\n' },
      { id: 'c', role: 'user', content: '你好' },
    ],
    metadata: { labels: ['writer'] },
  }
}
test('initialization creates no writers and a fresh template has no stored identity', () => {
  const { repository, path } = fixture()
  expect(repository.list()).toEqual([])
  const template = createWriterTemplate('New', 'Description')
  expect(template).toEqual({ name: 'New', description: 'Description', systemPrompt: DEFAULT_WRITER_PROMPT, messages: [], metadata: {} })
  expect(repository.list()).toEqual([])
  template.messages.push({ id: 'local', role: 'user', content: 'local' })
  expect(createWriterTemplate('Other').messages).toEqual([])
  const saved = repository.create(createWriterTemplate('Saved'))
  repository.update(saved.id, 0, { ...definition(), name: 'Editable' })
  repository.delete(saved.id, 1)
  expect(repository.list()).toEqual([])
  repository.close()
  const reopened = new WriterRepository({ path })
  cleanups.push(() => reopened.close())
  expect(reopened.list()).toEqual([])
  expect(() => repository.list()).toThrow(/closed/)
})
test('roles, empty text, order, metadata and literal prompt survive reopening', () => {
  const { repository, path } = fixture(),
    saved = repository.create(definition())
  const context = resolveWriterContext(saved)
  expect(context.messages.map((message) => message.role)).toEqual([
    'assistant',
    'assistant',
    'user',
  ])
  context.messages[0]!.content = 'detached'
  expect(saved.messages[0]!.content).toBe('')
  const copy = repository.copy(saved.id, { name: 'Copy', description: 'Different description' })
  expect(copy.description).toBe('Different description')
  expect(repository.get(saved.id).description).toBeUndefined()
  expect(copy.messages.map((message) => message.id)).not.toEqual(
    saved.messages.map((message) => message.id),
  )
  repository.delete(saved.id, saved.sequence)
  repository.close()
  const reopened = new WriterRepository({ path })
  cleanups.push(() => reopened.close())
  expect(resolveWriterContext(reopened.get(copy.id))).toEqual(
    resolveWriterContext(definition()),
  )
  expect(reopened.get(copy.id).metadata).toEqual(definition().metadata)
  expect(reopened.get(copy.id).systemPromptName).toBe('Role')
  expect(reopened.get(copy.id).messages[0]!.name).toBe('Opening')
  expect(resolveWriterContext(reopened.get(copy.id))).toEqual({
    systemPrompt: definition().systemPrompt,
    messages: definition().messages.map(({ role, content }) => ({ role, content })),
  })
})
test('two connections reject stale changes without overwriting the saved definition', () => {
  const { repository, path } = fixture(),
    other = new WriterRepository({ path })
  cleanups.push(() => other.close())
  const writer = repository.create(definition())
  other.update(writer.id, 0, { ...definition(), systemPrompt: 'new' })
  expect(() => repository.update(writer.id, 0, definition())).toThrow(/changed/)
  expect(() => repository.delete(writer.id, 0)).toThrow(/changed/)
  expect(repository.get(writer.id).systemPrompt).toBe('new')
  const lock = new DatabaseSync(path)
  cleanups.push(() => lock.close())
  lock.exec('BEGIN IMMEDIATE')
  try {
    expect(() => repository.update(writer.id, 1, definition())).toThrow(
      expect.objectContaining({ code: 'busy' }),
    )
  } finally {
    lock.exec('ROLLBACK')
  }
})
test('malformed settings and unsupported database formats are rejected', () => {
  const { repository, path } = fixture()
  expect(() =>
    repository.create({
      ...definition(),
      messages: [
        { id: 'x', role: 'user', content: '' },
        { id: 'x', role: 'user', content: '' },
      ],
    }),
  ).toThrow()
  expect(() =>
    repository.create({ ...definition(), metadata: { bad: Infinity } }),
  ).toThrow()
  repository.close()
  const db = new DatabaseSync(path)
  db.exec('PRAGMA user_version=1')
  db.close()
  const before = readFileSync(path)
  expect(() => new WriterRepository({ path })).toThrow(/format/)
  expect(readFileSync(path)).toEqual(before)
})
test('stored body identity mismatches are not repaired', () => {
  const { repository, path } = fixture(),
    writer = repository.create(definition())
  repository.close()
  const db = new DatabaseSync(path)
  db.prepare('UPDATE writers SET body=? WHERE id=?').run(
    JSON.stringify({ ...writer, id: 'wrong' }),
    writer.id,
  )
  db.close()
  expect(() => new WriterRepository({ path })).toThrow(/invalid stored/)
})
function controller(repository: WriterRepository) {
  const dispatch = createDispatcher(repository, (error) => {
    throw error
  })
  const api: Api = {
    async call(method, payload) {
      const result = await dispatch(
        method,
        payload,
        new AbortController().signal,
      )
      if (!result.ok) throw new Error(result.error.message)
      return result.value
    },
  }
  return new WriterStore(api, () => {})
}
test('editor decisions preserve pending changes on cancellation and failed save', async () => {
  const { repository } = fixture(),
    writer = repository.create(definition()),
    store = controller(repository)
  await store.load(writer.id)
  store.edit({ name: 'Local' })
  let left = false
  store.request(() => {
    left = true
  })
  await store.choose('cancel')
  expect(left).toBe(false)
  expect(store.dirty).toBe(true)
  repository.update(writer.id, 0, { ...definition(), name: 'External' })
  store.request(() => {
    left = true
  })
  await store.choose('save')
  expect(left).toBe(false)
  expect(store.getSnapshot().draft!.name).toBe('Local')
  expect(store.getSnapshot().error).toContain('changed')
  await store.choose('discard')
  expect(left).toBe(true)
  expect(repository.get(writer.id).name).toBe('External')
})
test('successful save precedes navigation and updates the observed sequence', async () => {
  const { repository } = fixture(),
    writer = repository.create(definition()),
    store = controller(repository)
  await store.load(writer.id)
  store.beginEditing()
  store.edit({ systemPrompt: 'edited' })
  let observed = ''
  store.request(() => {
    observed = repository.get(writer.id).systemPrompt
  })
  await store.choose('save')
  expect(observed).toBe('edited')
  expect(store.getSnapshot().saved!.sequence).toBe(1)
  expect(store.dirty).toBe(false)
})
test('management dispatcher rejects tool execution, invalid roles and cancellation', async () => {
  const { repository } = fixture(),
    dispatch = createDispatcher(repository, (error) => {
      throw error
    }),
    signal = new AbortController().signal
  expect(
    (
      await dispatch(
        'create',
        {
          ...definition(),
          messages: [{ id: 'a', role: 'system', content: 'bad' }],
        },
        signal,
      )
    ).ok,
  ).toBe(false)
  const aborted = new AbortController()
  aborted.abort()
  expect(await dispatch('create', definition(), aborted.signal)).toMatchObject({
    ok: false,
    error: { code: 'cancelled' },
  })
  expect(repository.list()).toHaveLength(0)
  const writer = repository.create(createWriterTemplate('Saved'))
  const result = await dispatch('context', { id: writer.id }, signal)
  expect(result).toEqual({ ok: true, value: resolveWriterContext(writer) })
})

test('prompt editing is opt-in; exit saves, discards or preserves an unfinished edit', async () => {
  const { repository } = fixture(), writer = repository.create(definition()), store = controller(repository)
  await store.load(writer.id)
  expect(store.getSnapshot().editing).toBe(false)
  store.edit({ systemPrompt: 'blocked' })
  expect(store.dirty).toBe(false)
  store.beginEditing()
  store.edit({ systemPrompt: 'kept', systemPromptName: 'Named system' })
  store.exitEditing()
  await store.choose('cancel')
  expect(store.getSnapshot().editing).toBe(true)
  expect(store.getSnapshot().draft!.systemPrompt).toBe('kept')
  store.exitEditing()
  await store.choose('save')
  expect(store.getSnapshot().editing).toBe(false)
  expect(repository.get(writer.id).systemPromptName).toBe('Named system')
  store.beginEditing()
  store.edit({ messages: [] })
  store.exitEditing()
  await store.choose('discard')
  expect(store.getSnapshot().editing).toBe(false)
  expect(store.getSnapshot().draft!.messages).toHaveLength(3)
  store.tab('settings')
  store.edit({ name: 'Changed settings' })
  await store.save()
  expect(store.getSnapshot().saved!.name).toBe('Changed settings')
  store.requestDelete()
  await store.remove()
  expect(store.getSnapshot().saved).toBeUndefined()
  expect(store.getSnapshot().draft).toBeUndefined()
  expect(store.getSnapshot().writers).toEqual([])
  store.beginEditing()
  expect(store.getSnapshot().editing).toBe(false)
})

test('tab transitions preserve edits on cancel or conflict and only remember accepted destinations', async () => {
  const { repository } = fixture(), writer = repository.create(definition()), store = controller(repository)
  await store.load(writer.id)
  store.beginEditing()
  store.edit({ systemPrompt: 'local' })
  store.tab('prompts')
  expect(store.getSnapshot().pending).toBeUndefined()
  store.tab('tools')
  await store.choose('cancel')
  expect(store.getSnapshot().tab).toBe('prompts')
  expect(store.getSnapshot().editing).toBe(true)
  repository.update(writer.id, 0, { ...definition(), systemPrompt: 'external' })
  store.tab('settings')
  await store.choose('save')
  expect(store.getSnapshot().tab).toBe('prompts')
  expect(store.getSnapshot().draft!.systemPrompt).toBe('local')
  await store.choose('discard')
  expect(store.getSnapshot().tab).toBe('settings')
  expect(store.getSnapshot().editing).toBe(false)
})

test('creation and copying write only on confirmation and retain dialog input on failure', async () => {
  const { repository } = fixture(), store = controller(repository)
  await store.load()
  expect(store.getSnapshot().saved).toBeUndefined()
  store.requestCreate('Untitled')
  store.editCreation({ name: 'Cancelled', description: 'Do not store' })
  expect(repository.list()).toEqual([])
  store.cancelCreation()
  expect(repository.list()).toEqual([])
  store.requestCreate('Untitled')
  store.editCreation({ name: '   ' })
  expect(await store.confirmCreation()).toBe(false)
  expect(repository.list()).toEqual([])
  store.editCreation({ name: 'Original', description: 'Original description' })
  expect(await store.confirmCreation()).toBe(true)
  const source = store.getSnapshot().saved!
  expect(source.systemPrompt).toBe(DEFAULT_WRITER_PROMPT)
  expect(source.description).toBe('Original description')
  store.requestCopy(' (copy)')
  expect(store.getSnapshot().creating).toEqual({ sourceId: source.id, name: 'Original (copy)', description: 'Original description' })
  store.cancelCreation()
  expect(repository.list()).toHaveLength(1)
  store.requestCopy(' (copy)')
  store.editCreation({ name: 'Copy', description: '' })
  expect(await store.confirmCreation()).toBe(true)
  expect(repository.list()).toHaveLength(2)
  expect(store.getSnapshot().saved!.description).toBe('')
  expect(repository.get(source.id).description).toBe('Original description')
  store.requestCopy(' (copy)')
  const copied = store.getSnapshot().saved!
  repository.delete(copied.id, copied.sequence)
  store.editCreation({ name: 'Retained', description: 'Retry input' })
  expect(await store.confirmCreation()).toBe(false)
  expect(store.getSnapshot().creating).toMatchObject({ name: 'Retained', description: 'Retry input' })
  expect(store.getSnapshot().error).toContain('does not exist')
  expect(repository.list()).toHaveLength(1)
})


test('updating replaces the full definition, including removal of optional labels', () => {
  const { repository, path } = fixture()
  const original = repository.create({ ...definition(), description: 'Remove this' })
  const replacement = {
    name: 'Minimal',
    systemPrompt: '',
    messages: [{ id: 'c', role: 'user' as const, content: '' }],
    metadata: {},
  }
  const updated = repository.update(original.id, 0, replacement)
  expect(updated).toEqual({
    ...replacement,
    id: original.id,
    sequence: 1,
    createdAt: original.createdAt,
    updatedAt: expect.any(String),
  })
  repository.close()
  const reopened = new WriterRepository({ path })
  cleanups.push(() => reopened.close())
  expect(reopened.get(original.id)).toEqual(updated)
})

test('locked reads report the same busy error as writes', () => {
  const { repository, path } = fixture()
  const writer = repository.create(definition())
  const lock = new DatabaseSync(path)
  cleanups.push(() => lock.close())
  lock.exec('BEGIN EXCLUSIVE')
  try {
    for (const read of [
      () => repository.list(),
      () => repository.get(writer.id),
      () => repository.copy(writer.id, { name: 'Copy' }),
    ]) expect(read).toThrow(expect.objectContaining({ code: 'busy' }))
  } finally {
    lock.exec('ROLLBACK')
  }
  expect(repository.list()).toHaveLength(1)
})
