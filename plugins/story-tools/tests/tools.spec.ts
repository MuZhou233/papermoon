import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from '@papermoon/story-core/repository'
import { createStoryTools } from '../src/index.ts'
import { toolCatalog, type ToolName } from '../src/catalog.ts'
const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-tools-'))
  const storage = new StoryStorage({ path: join(directory, 'story.sqlite') }),
    repository = new StoryRepository(storage)
  cleanups.push(() => {
    storage.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const project = repository.createProject({ name: 'Tools' }),
    script = repository.createScript({
      projectId: project.id,
      name: 'A',
      defaultLanguage: 'en',
    })
  const tools = createStoryTools(repository, script.id)
  const call = (name: ToolName, args: unknown) =>
    tools
      .find((tool) => tool.name === name)!
      .execute(args, { signal: new AbortController().signal })
  return { repository, project, script, tools, call }
}
test('program batches preserve exact strings, validate final paths and commit immutable revisions', async () => {
  const { call, repository, script } = fixture()
  await call('story_program_edit', {
    expectedSequence: 0,
    operations: [{ kind: 'create-file', path: 'part', source: 'before\r\n尾' }],
  })
  await call('story_program_edit', {
    expectedSequence: 1,
    operations: [
      { kind: 'create-file', path: 'part/main.js', source: 'before\r\n尾' },
      { kind: 'delete-file', path: 'part' },
      {
        kind: 'replace-text',
        path: 'part/main.js',
        oldText: 'before',
        newText: 'after',
      },
    ],
  })
  const committed = await call('story_commit', {
    expectedSequence: 2,
    description: ' draft ',
    entryMetadata: { stage: 'first' },
  })
  expect(committed).toMatchObject({
    revision: { description: ' draft ' },
    entry: { metadata: { stage: 'first' } },
  })
  const revision = repository.listRevisions(script.id).items[0]!.revision
  await call('story_program_edit', {
    expectedSequence: 3,
    operations: [{ kind: 'replace-file', path: 'part/main.js', source: '' }],
  })
  expect(
    await call('story_program_read', {
      path: 'part/main.js',
      ref: { kind: 'revision', revisionId: revision.id },
    }),
  ).toMatchObject({ file: { source: 'after\r\n尾' } })
  expect(
    await call('story_diff', {
      left: { kind: 'revision', revisionId: revision.id },
      right: { kind: 'draft' },
    }),
  ).toMatchObject({ items: [{ kind: 'modified' }] })
  await call('story_restore', {
    expectedSequence: 4,
    revisionId: revision.id,
    selection: { kind: 'file', path: 'part/main.js' },
  })
  expect(await call('story_program_search', { query: 'after' })).toMatchObject({
    items: [{ path: 'part/main.js' }],
  })
})
test('failed matches, invalid operations and stale sequences leave no partial changes', async () => {
  const { call } = fixture()
  await call('story_program_edit', {
    expectedSequence: 0,
    operations: [{ kind: 'create-file', path: 'file', source: 'aaa' }],
  })
  for (const oldText of ['', 'aa', 'absent'])
    await expect(
      call('story_program_edit', {
        expectedSequence: 1,
        operations: [
          { kind: 'create-file', path: 'new', source: '' },
          { kind: 'replace-text', path: 'file', oldText, newText: 'x' },
        ],
      }),
    ).rejects.toThrow()
  await expect(
    call('story_program_edit', { expectedSequence: 0, operations: [] }),
  ).rejects.toThrow(/conflict/)
  await expect(
    call('story_program_edit', {
      expectedSequence: 1,
      operations: [{ kind: 'create-text', key: 'bad' }],
    }),
  ).rejects.toThrow()
  await expect(
    call('story_text_edit', {
      expectedSequence: 1,
      operations: [{ kind: 'delete-file', path: 'file' }],
    }),
  ).rejects.toThrow()
  expect(await call('story_status', {})).toMatchObject({
    draft: { sequence: 1 },
    programFiles: 1,
    textEntries: 0,
  })
})
test('text tools preserve exact-language missing results and final language invariants', async () => {
  const { call } = fixture()
  await call('story_text_edit', {
    expectedSequence: 0,
    operations: [
      { kind: 'create-text', key: 'opening', description: 'Greeting' },
      { kind: 'set-translation', key: 'opening', language: 'en', text: '' },
      { kind: 'add-language', language: 'zh-CN' },
    ],
  })
  expect(
    await call('story_text_read', { key: 'opening', language: 'en' }),
  ).toMatchObject({ result: { kind: 'found', translation: { text: '' } } })
  for (const [key, language, reason] of [
    ['opening', 'fr', 'language'],
    ['missing', 'en', 'entry'],
    ['opening', 'zh-CN', 'translation'],
  ])
    expect(await call('story_text_read', { key, language })).toMatchObject({
      result: { kind: 'missing', reason },
    })
  expect(
    await call('story_text_list', { missingLanguage: 'zh-CN' }),
  ).toMatchObject({ items: [{ key: 'opening' }] })
  expect(await call('story_text_search', { query: 'Greeting' })).toMatchObject({
    items: [{ key: 'opening' }],
  })
  await call('story_text_edit', {
    expectedSequence: 1,
    operations: [
      { kind: 'delete-language', language: 'en' },
      { kind: 'set-default-language', language: 'zh-CN' },
    ],
  })
  expect(await call('story_status', {})).toMatchObject({
    defaultLanguage: 'zh-CN',
  })
})
test('bound tools reject foreign revisions and script IDs, including comparison and restoration', async () => {
  const { call, repository, project } = fixture(),
    other = repository.createScript({
      projectId: project.id,
      name: 'B',
      defaultLanguage: 'en',
    })
  const revision = repository.commitRevision({
    scriptId: other.id,
    expectedSequence: 0,
    description: 'Other',
  }).revision.id
  await expect(call('story_history', { revisionId: revision })).rejects.toThrow(
    /not-found/,
  )
  await expect(
    call('story_diff', {
      left: { kind: 'revision', revisionId: revision },
      right: { kind: 'draft' },
    }),
  ).rejects.toThrow(/not-found/)
  await expect(
    call('story_restore', {
      expectedSequence: 0,
      revisionId: revision,
      selection: { kind: 'all' },
    }),
  ).rejects.toThrow(/not-found/)
  await expect(call('story_status', { scriptId: other.id })).rejects.toThrow()
})
test('draft pagination requires pinned identities and cancellation does not save', async () => {
  const { call, tools } = fixture()
  await call('story_program_edit', {
    expectedSequence: 0,
    operations: ['a', 'b'].map((path) => ({
      kind: 'create-file',
      path,
      source: '',
    })),
  })
  const page = await call('story_program_list', { limit: 1 })
  expect(page).toMatchObject({ ref: { sequence: 1 }, next: 'a' })
  await expect(call('story_program_list', { after: 'a' })).rejects.toThrow(
    /sequence/,
  )
  await call('story_program_edit', { expectedSequence: 1, operations: [] })
  await expect(
    call('story_program_list', {
      ref: { kind: 'draft', sequence: 1 },
      after: 'a',
    }),
  ).rejects.toThrow(/conflict/)
  const abort = new AbortController()
  abort.abort()
  await expect(
    tools
      .find((tool) => tool.name === 'story_commit')!
      .execute(
        { expectedSequence: 2, description: 'No' },
        { signal: abort.signal },
      ),
  ).rejects.toThrow()
  expect(await call('story_history', {})).toMatchObject({ items: [] })
})
test('catalog includes only available operations and help is callable', async () => {
  const { tools, call } = fixture()
  expect(toolCatalog().map((tool) => tool.name)).toEqual(
    tools.map((tool) => tool.name),
  )
  expect(toolCatalog()).toHaveLength(14)
  expect(
    tools
      .find((tool) => tool.name === 'story_program_read')!
      .isConcurrencySafe(),
  ).toBe(true)
  expect(
    tools.find((tool) => tool.name === 'story_commit')!.isConcurrencySafe(),
  ).toBe(false)
  expect(await call('story_help', { topic: 'program' })).toMatchObject({
    topic: 'program',
    text: expect.stringContaining('exactly one'),
  })
})
