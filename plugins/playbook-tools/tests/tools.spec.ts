import { CompilationService, ArtifactStore } from '@papermoon/playbook-compiler/service'
import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlaybookStorage } from '@papermoon/playbook-storage'
import { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { createPlaybookTools } from '../src/index.ts'
import { schemas, toolCatalog, type ToolName } from '../src/catalog.ts'
const cleanups: (() => void | Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-tools-'))
  const storage = new PlaybookStorage({ path: join(directory, 'playbook.sqlite') }),
    repository = new PlaybookRepository(storage)
  cleanups.push(() => {
    storage.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const project = repository.createProject({ name: 'Tools' }),
    playbook = repository.createPlaybook({
      projectId: project.id,
      name: 'A',
      defaultLanguage: 'en',
    })
  const compiler = new CompilationService(repository, new ArtifactStore(join(directory, 'compiled')))
  cleanups.push(() => compiler.close())
  const tools = createPlaybookTools(repository, playbook.id, undefined, compiler)
  const call = (name: ToolName, args: unknown) =>
    tools
      .find((tool) => tool.name === name)!
      .execute(args, { signal: new AbortController().signal })
  return { repository, project, playbook, tools, call }
}
test('program batches preserve exact strings, validate final paths and commit immutable revisions', async () => {
  const { call, repository, playbook } = fixture()
  await call('playbook_program_edit', {
    operations: [{ kind: 'create-file', path: 'part', source: 'before\r\n尾' }],
  })
  await call('playbook_program_edit', {
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
  const committed = await call('playbook_commit', { allowCompilationFailure: true,
    expectedSequence: 2,
    description: ' draft ',
    entryMetadata: { stage: 'first' },
  })
  expect(committed).toMatchObject({
    revision: { description: ' draft ' },
    entry: { metadata: { stage: 'first' } },
  })
  const revision = repository.listRevisions(playbook.id).items[0]!.revision
  await call('playbook_program_edit', {
    operations: [{ kind: 'replace-file', path: 'part/main.js', source: '' }],
  })
  expect(
    await call('playbook_program_read', {
      path: 'part/main.js',
      ref: { kind: 'revision', revisionId: revision.id },
    }),
  ).toMatchObject({ file: { source: 'after\r\n尾' } })
  expect(
    await call('playbook_diff', {
      left: { kind: 'revision', revisionId: revision.id },
      right: { kind: 'draft' },
    }),
  ).toMatchObject({ items: [{ kind: 'modified' }] })
  await call('playbook_restore', {
    expectedSequence: 4,
    revisionId: revision.id,
    selection: { kind: 'file', path: 'part/main.js' },
  })
  expect(await call('playbook_program_search', { query: 'after' })).toMatchObject({
    items: [{ path: 'part/main.js' }],
  })
})
test('failed matches and invalid arguments leave no partial changes', async () => {
  const { call } = fixture()
  await call('playbook_program_edit', {
    operations: [{ kind: 'create-file', path: 'file', source: 'aaa' }],
  })
  for (const oldText of ['', 'aa', 'absent'])
    await expect(
      call('playbook_program_edit', {
        operations: [
          { kind: 'create-file', path: 'new', source: '' },
          { kind: 'replace-text', path: 'file', oldText, newText: 'x' },
        ],
      }),
    ).rejects.toThrow()
  await expect(
    call('playbook_program_edit', { expectedSequence: 0, operations: [] }),
  ).rejects.toThrow(/expectedSequence/)
  await expect(
    call('playbook_program_edit', {
      operations: [{ kind: 'create-text', key: 'bad' }],
    }),
  ).rejects.toThrow()
  await expect(
    call('playbook_text_edit', {
      operations: [{ kind: 'delete-file', path: 'file' }],
    }),
  ).rejects.toThrow()
  expect(await call('playbook_status', {})).toMatchObject({
    draft: { sequence: 1 },
    programFiles: 1,
    textEntries: 0,
  })
})
test('text tools preserve exact-language missing results and final language invariants', async () => {
  const { call } = fixture()
  await call('playbook_text_edit', {
    operations: [
      { kind: 'create-text', key: 'opening', description: 'Greeting' },
      { kind: 'set-translation', key: 'opening', language: 'en', text: '' },
      { kind: 'add-language', language: 'zh-CN' },
    ],
  })
  expect(
    await call('playbook_text_read', { key: 'opening', language: 'en' }),
  ).toMatchObject({ result: { kind: 'found', translation: { text: '' } } })
  for (const [key, language, reason] of [
    ['opening', 'fr', 'language'],
    ['missing', 'en', 'entry'],
    ['opening', 'zh-CN', 'translation'],
  ])
    expect(await call('playbook_text_read', { key, language })).toMatchObject({
      result: { kind: 'missing', reason },
    })
  expect(
    await call('playbook_text_list', { missingLanguage: 'zh-CN' }),
  ).toMatchObject({ items: [{ key: 'opening' }] })
  expect(await call('playbook_text_search', { query: 'Greeting' })).toMatchObject({
    items: [{ key: 'opening' }],
  })
  await call('playbook_text_edit', {
    operations: [
      { kind: 'delete-language', language: 'en', expectedSequence: 1 },
      { kind: 'set-default-language', language: 'zh-CN' },
    ],
  })
  expect(await call('playbook_status', {})).toMatchObject({
    defaultLanguage: 'zh-CN',
  })
})
test('bound tools reject foreign revisions and playbook IDs, including comparison and restoration', async () => {
  const { call, repository, project } = fixture(),
    other = repository.createPlaybook({
      projectId: project.id,
      name: 'B',
      defaultLanguage: 'en',
    })
  const revision = repository.commitRevision({
    playbookId: other.id,
    expectedSequence: 0,
    description: 'Other',
  }).revision.id
  await expect(call('playbook_history', { revisionId: revision })).rejects.toThrow(
    /not-found/,
  )
  await expect(
    call('playbook_diff', {
      left: { kind: 'revision', revisionId: revision },
      right: { kind: 'draft' },
    }),
  ).rejects.toThrow(/not-found/)
  await expect(
    call('playbook_restore', {
      expectedSequence: 0,
      revisionId: revision,
      selection: { kind: 'all' },
    }),
  ).rejects.toThrow(/not-found/)
  await expect(call('playbook_status', { playbookId: other.id })).rejects.toThrow()
})
test('draft pagination requires pinned identities and cancellation does not save', async () => {
  const { call, tools } = fixture()
  await call('playbook_program_edit', {
    operations: ['a', 'b'].map((path) => ({
      kind: 'create-file',
      path,
      source: '',
    })),
  })
  const page = await call('playbook_program_list', { limit: 1 })
  expect(page).toMatchObject({ ref: { sequence: 1 }, next: 'a' })
  await expect(call('playbook_program_list', { after: 'a' })).rejects.toThrow(
    /sequence/,
  )
  await call('playbook_program_edit', { operations: [] })
  await expect(
    call('playbook_program_list', {
      ref: { kind: 'draft', sequence: 1 },
      after: 'a',
    }),
  ).rejects.toThrow(/conflict/)
  const abort = new AbortController()
  abort.abort()
  await expect(
    tools
      .find((tool) => tool.name === 'playbook_commit')!
      .execute(
        { expectedSequence: 2, description: 'No' },
        { signal: abort.signal },
      ),
  ).rejects.toThrow()
  expect(await call('playbook_history', {})).toMatchObject({ items: [] })
})
test('catalog includes only available operations and help is callable', async () => {
  const { tools, call } = fixture()
  expect(toolCatalog().map((tool) => tool.name)).toEqual(
    tools.map((tool) => tool.name),
  )
  expect(toolCatalog()).toHaveLength(16)
  expect(
    tools
      .find((tool) => tool.name === 'playbook_program_read')!
      .isConcurrencySafe(),
  ).toBe(true)
  expect(
    tools.find((tool) => tool.name === 'playbook_commit')!.isConcurrencySafe(),
  ).toBe(false)
  expect(await call('playbook_help', { topic: 'program' })).toMatchObject({
    topic: 'program',
    text: expect.stringContaining('exactly one'),
  })
})

test.each(schemas.playbook_help.shape.topic.unwrap().options)('help topic %s returns nonempty text', async (topic) => {
  const { call } = fixture()
  expect(await call('playbook_help', { topic })).toEqual({
    topic,
    text: expect.stringMatching(/\S/),
  })
})

test('commit references identify revisions, reject file paths at their parameter and preserve the complete draft', async () => {
  const { call, repository, playbook, project } = fixture()
  await call('playbook_program_edit', {
    operations: [{ kind: 'create-file', path: 'playbook.js', source: 'unfinished program' }],
  })
  await call('playbook_text_edit', {
    operations: [
      { kind: 'create-text', key: 'opening' },
      { kind: 'set-translation', key: 'opening', language: 'en', text: 'Opening' },
    ],
  })
  await call('playbook_commit', { allowCompilationFailure: true, expectedSequence: 2, description: 'First' })
  const first = repository.listRevisions(playbook.id).items[0]!.revision
  const other = repository.createPlaybook({ projectId: project.id, name: 'Other', defaultLanguage: 'en' })
  const foreign = repository.commitRevision({ playbookId: other.id, expectedSequence: 0, description: 'Other' }).revision.id
  const before = repository.readSnapshot({ kind: 'draft', playbookId: playbook.id })
  for (const invalid of ['playbook.js', 'missing-revision', foreign]) {
    await expect(call('playbook_commit', { allowCompilationFailure: true,
      expectedSequence: 3, description: 'Next', references: [first.id, invalid],
    })).rejects.toMatchObject({
      code: 'not-found',
      message: expect.stringContaining(`references[1]: ${JSON.stringify(invalid)}`),
    })
    expect(repository.readSnapshot({ kind: 'draft', playbookId: playbook.id })).toEqual(before)
    expect(repository.listRevisions(playbook.id).items).toHaveLength(1)
  }
  await call('playbook_commit', { allowCompilationFailure: true, expectedSequence: 3, description: 'With reference', references: [first.id] })
  await call('playbook_commit', { allowCompilationFailure: true, expectedSequence: 4, description: 'Without reference' })
  const revisions = repository.listRevisions(playbook.id).items.map(entry => entry.revision)
  expect(revisions[1]!.references).toEqual([first.id])
  expect(revisions[2]!.references).toEqual([])
  for (const revision of revisions) {
    expect(repository.readSnapshot({ kind: 'revision', revisionId: revision.id }).content).toEqual(before.content)
  }
})

test('missing revision errors locate each reference without changing the draft', async () => {
  const { call, repository, playbook } = fixture()
  const before = repository.readSnapshot({ kind: 'draft', playbookId: playbook.id })
  for (const [name, args, parameter] of [
    ['playbook_history', { revisionId: 'missing' }, 'revisionId'],
    ['playbook_program_read', { path: 'playbook.js', ref: { kind: 'revision', revisionId: 'missing' } }, 'ref.revisionId'],
    ['playbook_diff', { left: { kind: 'revision', revisionId: 'missing' }, right: { kind: 'draft' } }, 'left.revisionId'],
    ['playbook_diff', { left: { kind: 'draft' }, right: { kind: 'revision', revisionId: 'missing' } }, 'right.revisionId'],
    ['playbook_restore', { expectedSequence: 0, revisionId: 'missing', selection: { kind: 'all' } }, 'revisionId'],
  ] as const) {
    await expect(call(name, args)).rejects.toMatchObject({ code: 'not-found', message: expect.stringContaining(`${parameter}: "missing"`) })
  }
  expect(repository.readSnapshot({ kind: 'draft', playbookId: playbook.id })).toEqual(before)
})
