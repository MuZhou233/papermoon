import { CompilationService, ArtifactStore } from '@papermoon/story-compiler/service'
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from '@papermoon/story-core/repository'
import { dispatcher, type Results } from '../src/service.ts'
import { schemas } from '../src/protocol.ts'
import { fromDTO, snapshotDTO } from '../src/wire.ts'
import { DraftEditor } from '../src/client/draft.ts'
import type { Backups, Backup } from '../src/client/buffers.ts'
import type { Api } from '../src/client/api.ts'
const cleanups: (() => void | Promise<void>)[] = []
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!()
})
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'pm-editor-unit-')),
    storage = new StoryStorage({ path: join(dir, 'db') }),
    repo = new StoryRepository(storage)
  cleanups.push(() => {
    storage.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const project = repo.createProject({ name: 'Project' }),
    script = repo.createScript({
      projectId: project.id,
      name: 'Script',
      defaultLanguage: 'zh-CN',
    })
  const compiler = new CompilationService(repo, new ArtifactStore(join(dir, 'compiled')))
  cleanups.push(() => compiler.close())
  const dispatch = dispatcher(repo, (error) => {
    throw error
  }, compiler)
  const api: Api = {
    async call(method, payload) {
      const result = await dispatch(
        method,
        payload,
        new AbortController().signal,
      )
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        })
      return result.value as Results[typeof method]
    },
  }
  const data = new Map<string, Backup>(),
    backups: Backups = {
      list: async (id) => [...data.values()].filter((v) => v.scriptId === id),
      put: async (value) => {
        data.set(value.id, structuredClone(value))
      },
      remove: async (id) => {
        data.delete(id)
      },
    }
  const base = snapshotDTO(
    repo.readSnapshot({ kind: 'draft', scriptId: script.id }),
  )
  if (base.kind !== 'draft') throw new Error('draft expected')
  return { storage, repo, project, script, api, dispatch, backups, data, base }
}
describe('editor interface', () => {
  it('validates requests before calling core and exposes no publication or metadata writes', async () => {
    const { dispatch, script, repo } = setup()
    for (const [method, payload] of [
      [
        'save',
        {
          scriptId: script.id,
          expectedSequence: 0,
          operations: [
            { kind: 'set-metadata', target: { kind: 'content' }, metadata: {} },
          ],
        },
      ],
      ['createProject', { name: 'X', metadata: {} }],
      [
        'commit',
        { scriptId: script.id, expectedSequence: 0, description: '  ' },
      ],
      ['registerPublication', {}],
    ]) {
      expect(
        (
          await dispatch(
            method as string,
            payload,
            new AbortController().signal,
          )
        ).ok,
      ).toBe(false)
    }
    expect(
      repo.readSnapshot({ kind: 'draft', scriptId: script.id }).draft.sequence,
    ).toBe(0)
  })
  it('saves code and text together, preserves hidden metadata, and round-trips multilingual differences', async () => {
    const { repo, api, script } = setup()
    repo.editDraft({
      scriptId: script.id,
      expectedSequence: 0,
      operations: [
        {
          kind: 'create-file',
          path: 'main.js',
          source: 'a',
          metadata: { keep: true },
        },
        { kind: 'create-text', key: 'hello', metadata: { tag: 'keep' } },
        {
          kind: 'set-translation',
          key: 'hello',
          language: 'zh-CN',
          text: '',
          metadata: { checked: true },
        },
      ],
    })
    const first = await api.call('commit', {
      allowCompilationFailure: true,
      scriptId: script.id,
      expectedSequence: 1,
      description: '  First  ',
    })
    if (!first.committed) throw new Error('expected committed revision')
    await api.call('save', {
      scriptId: script.id,
      expectedSequence: 2,
      operations: [
        { kind: 'replace-file', path: 'main.js', source: 'unfinished(' },
        {
          kind: 'set-translation',
          key: 'hello',
          language: 'zh-CN',
          text: '你好',
        },
      ],
    })
    const current = await api.call('snapshot', {
        ref: { kind: 'draft', scriptId: script.id },
      }),
      content = fromDTO(JSON.parse(JSON.stringify(current.content)))
    expect(content.program.files.get('main.js')?.metadata).toEqual({
      keep: true,
    })
    expect(
      content.texts.entries.get('hello')?.translations.get('zh-CN')?.metadata,
    ).toEqual({ checked: true })
    expect(first.revision.description).toBe('  First  ')
    const diff = JSON.parse(
      JSON.stringify(
        await api.call('compare', {
          left: { kind: 'revision', revisionId: first.revision.id },
          right: { kind: 'draft', scriptId: script.id },
        }),
      ),
    )
    expect(
      diff.items.find(
        (item: { after?: { kind: string } }) => item.after?.kind === 'text',
      ).after.value.translations,
    ).toEqual([['zh-CN', { text: '你好', metadata: { checked: true } }]])
  })
  it('rejects stale saves and final-invalid batches without partial effects', async () => {
    const { api, script } = setup()
    await api.call('save', {
      scriptId: script.id,
      expectedSequence: 0,
      operations: [{ kind: 'create-file', path: 'a', source: '' }],
    })
    await expect(
      api.call('save', {
        scriptId: script.id,
        expectedSequence: 0,
        operations: [{ kind: 'create-file', path: 'stale', source: '' }],
      }),
    ).rejects.toMatchObject({ code: 'conflict' })
    await expect(
      api.call('save', {
        scriptId: script.id,
        expectedSequence: 1,
        operations: [
          { kind: 'create-file', path: 'b', source: '' },
          { kind: 'delete-language', language: 'zh-CN' },
        ],
      }),
    ).rejects.toBeDefined()
    const snapshot = await api.call('snapshot', {
      ref: { kind: 'draft', scriptId: script.id },
    })
    expect(snapshot.content.program.files.map((f) => f.path)).toEqual(['a'])
  })
  it('queries across projects with literal filters, pages, and descending histories', () => {
    const { repo, project, script } = setup()
    repo.createScript({
      projectId: repo.createProject({ name: 'Other' }).id,
      name: 'Two',
      defaultLanguage: 'en',
    })
    expect(repo.queryScripts({ limit: 1 }).next).toBeDefined()
    expect(repo.queryScripts({ projectId: project.id }).items).toHaveLength(1)
    expect(repo.queryScripts({ query: '%' }).items).toHaveLength(0)
    for (let i = 0; i < 3; i++)
      repo.commitRevision({
        scriptId: script.id,
        expectedSequence: i,
        description: 'revision',
      })
    const page = repo.listRevisions(script.id, { descending: true, limit: 2 })
    expect(page.items.map((v) => v.ordinal)).toEqual([3, 2])
    expect(
      repo
        .listRevisions(script.id, { descending: true, after: page.next })
        .items.map((v) => v.ordinal),
    ).toEqual([1])
  })
  it('restores and copies independent drafts without duplicating revision bodies', async () => {
    const { api, script, project } = setup()
    const first = await api.call('commit', {
      allowCompilationFailure: true,
      scriptId: script.id,
      expectedSequence: 0,
      description: 'Empty',
    })
    if (!first.committed) throw new Error('expected committed revision')
    const copy = await api.call('copy', {
      sourceScriptId: script.id,
      source: { kind: 'revision', revisionId: first.revision.id },
      targetProjectId: project.id,
      name: 'Alternative',
      history: 'copy',
    })
    await api.call('deleteScript', { scriptId: script.id })
    expect(
      (await api.call('history', { scriptId: copy.id })).items[0]?.revision.id,
    ).toBe(first.revision.id)
    await api.call('save', {
      scriptId: copy.id,
      expectedSequence: 0,
      operations: [{ kind: 'create-file', path: 'x', source: '' }],
    })
    await api.call('restore', {
      scriptId: copy.id,
      expectedSequence: 1,
      revisionId: first.revision.id,
      selection: { kind: 'all' },
    })
    expect(
      (
        await api.call('snapshot', {
          ref: { kind: 'draft', scriptId: copy.id },
        })
      ).content.program.files,
    ).toEqual([])
  })
  it('rejects cancelled dispatches before mutating', async () => {
    const { dispatch, repo } = setup()
    const signal = AbortSignal.abort()
    expect(
      (await dispatch('createProject', { name: 'Never' }, signal)).ok,
    ).toBe(false)
    expect(repo.listProjects().items).toHaveLength(1)
  })
})
describe('local drafts', () => {
  it('keeps edits typed while a save is in flight and does not clear their backup', async () => {
    const { api, base, backups, script } = setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const delayed: Api = {
      async call(method, input) {
        const result = await api.call(method, input)
        if (method === 'save') await gate
        return result
      },
    }
    const editor = new DraftEditor(base, delayed, backups)
    editor.edit([{ kind: 'create-file', path: 'x', source: 'first' }])
    const saving = editor.save()
    editor.edit([{ kind: 'replace-file', path: 'x', source: 'second' }])
    release()
    await saving
    expect(editor.getSnapshot().operations).toEqual([
      { kind: 'replace-file', path: 'x', source: 'second' },
    ])
    expect(editor.getSnapshot().content.program.files.get('x')?.source).toBe(
      'second',
    )
    expect(
      (
        await api.call('snapshot', {
          ref: { kind: 'draft', scriptId: script.id },
        })
      ).content.program.files[0]?.source,
    ).toBe('first')
    await editor.save()
    expect(editor.getSnapshot().operations).toEqual([])
  })
  it('recognizes a committed save after losing its response', async () => {
    const { api, base, backups } = setup()
    let dropped = false
    const unreliable: Api = {
      async call(method, input) {
        const result = await api.call(method, input)
        if (method === 'save' && !dropped) {
          dropped = true
          throw new Error('lost response')
        }
        return result
      },
    }
    const editor = new DraftEditor(base, unreliable, backups)
    editor.edit([
      { kind: 'create-file', path: 'z', source: 'text' },
      { kind: 'create-file', path: 'a', source: 'other' },
    ])
    await editor.save()
    expect(editor.getSnapshot().base.draft.sequence).toBe(1)
    expect(editor.getSnapshot().operations).toEqual([])
  })
  it('retains local edits on a conflict and gives each window its own backup', async () => {
    const { api, base, backups, data } = setup()
    const a = new DraftEditor(base, api, backups),
      b = new DraftEditor(base, api, backups)
    a.edit([{ kind: 'create-file', path: 'local', source: 'keep' }])
    b.edit([{ kind: 'create-file', path: 'server', source: 'other' }])
    await b.save()
    await a.refresh()
    expect(a.getSnapshot().conflict?.draft.sequence).toBe(1)
    expect(a.getSnapshot().content.program.files.has('local')).toBe(true)
    expect(a.id).not.toBe(b.id)
    await Promise.resolve()
    await Promise.resolve()
    expect([...data.values()].some((v) => v.id === a.id)).toBe(true)
  })
  it('reports failed local backup writes without dropping in-memory edits', async () => {
    const { api, base, backups } = setup()
    const editor = new DraftEditor(base, api, {
      ...backups,
      put: async () => {
        throw new Error('quota')
      },
    })
    editor.edit([{ kind: 'create-file', path: 'a', source: '' }])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(editor.getSnapshot().backupError).toBeInstanceOf(Error)
    expect(editor.getSnapshot().content.program.files.has('a')).toBe(true)
  })
  it('restores an isolated backup and marks a changed server sequence', async () => {
    const { api, base, backups, script } = setup()
    const later = await api.call('save', {
      scriptId: script.id,
      expectedSequence: 0,
      operations: [],
    })
    if (later.kind !== 'draft') throw new Error()
    const editor = new DraftEditor(later, api, backups)
    editor.recover({
      version: 1,
      id: 'other',
      scriptId: script.id,
      updatedAt: 0,
      base,
      operations: [{ kind: 'create-file', path: 'old', source: 'keep' }],
    })
    expect(editor.getSnapshot().conflict).toEqual(later)
    expect(editor.getSnapshot().content.program.files.get('old')?.source).toBe(
      'keep',
    )
  })
})
it('the protocol accepts incomplete code and distinguishes empty from missing translations', () => {
  expect(
    schemas.save.safeParse({
      scriptId: 'id',
      expectedSequence: 0,
      operations: [
        { kind: 'create-file', path: 'a.js', source: '(' },
        { kind: 'set-translation', key: 'x', language: 'en', text: '' },
      ],
    }).success,
  ).toBe(true)
})

it('deep revision reads validate script membership independently of pagination', async () => {
  const { api, repo, script, project } = setup()
  const initial = repo.commitRevision({
    scriptId: script.id,
    expectedSequence: 0,
    description: 'old',
    historyMetadata: { tag: 1 },
  })
  for (let i = 1; i < 105; i++)
    repo.commitRevision({
      scriptId: script.id,
      expectedSequence: i,
      description: 'later',
    })
  expect(
    (
      await api.call('revision', {
        scriptId: script.id,
        revisionId: initial.revision.id,
      })
    ).entry,
  ).toMatchObject({ ordinal: 1, metadata: { tag: 1 } })
  const other = repo.createScript({
    projectId: project.id,
    name: 'Other',
    defaultLanguage: 'en',
  })
  await expect(
    api.call('revision', {
      scriptId: other.id,
      revisionId: initial.revision.id,
    }),
  ).rejects.toMatchObject({ code: 'not-found' })
})

it('ignores a refresh response older than an acknowledged save', async () => {
  const { api, base, backups } = setup()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let held = false
  const delayed: Api = {
    async call(method, input) {
      const result = await api.call(method, input)
      if (method === 'snapshot' && !held) {
        held = true
        await gate
      }
      return result
    },
  }
  const editor = new DraftEditor(base, delayed, backups)
  const refreshing = editor.refresh()
  editor.edit([{ kind: 'create-file', path: 'saved', source: 'keep' }])
  await editor.save()
  release()
  await refreshing
  expect(editor.getSnapshot().base.draft.sequence).toBe(1)
  expect(editor.getSnapshot().content.program.files.get('saved')?.source).toBe(
    'keep',
  )
})
