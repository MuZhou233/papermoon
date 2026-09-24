import { CompilationService, ArtifactStore } from '@papermoon/playbook-compiler/service'
import { afterEach, expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { PlaybookStorage } from '@papermoon/playbook-storage'
import type { ContentOperation } from '@papermoon/playbook-core'
import { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { createPlaybookTools, PlaybookObservations } from '../src/index.ts'
import { schemas, type ToolName } from '../src/catalog.ts'

const cleanup: (() => void | Promise<void>)[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const dispose of cleanup.splice(0).reverse()) await dispose() })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-concurrent-tools-'))
  const path = join(directory, 'playbook.sqlite'), storage = new PlaybookStorage({ path })
  const repository = new PlaybookRepository(storage), project = repository.createProject({ name: 'Concurrent' })
  const playbook = repository.createPlaybook({ projectId: project.id, name: 'Shared', defaultLanguage: 'en' })
  const snapshot = () => repository.readSnapshot({ kind: 'draft', playbookId: playbook.id })
  repository.editDraft({ playbookId: playbook.id, expectedSequence: 0, operations: [
    ...['a.js', 'b.js', 'unread.js'].map(path => ({ kind: 'create-file' as const, path, source: 'original' })),
    { kind: 'add-language', language: 'zh-CN' },
    { kind: 'create-text', key: 'opening' },
    { kind: 'set-translation', key: 'opening', language: 'en', text: 'Hello' },
    { kind: 'set-translation', key: 'opening', language: 'zh-CN', text: '你好' },
  ] })
  const peerStorage = new PlaybookStorage({ path }), peer = new PlaybookRepository(peerStorage)
  cleanup.push(() => { peerStorage.close(); storage.close(); rmSync(directory, { recursive: true, force: true }) })
  const writePeer = (operations: readonly ContentOperation[]) => peer.editDraft({ playbookId: playbook.id, expectedSequence: peer.readSnapshot({ kind: 'draft', playbookId: playbook.id }).draft.sequence, operations })
  const compiler = new CompilationService(repository, new ArtifactStore(join(directory, 'compiled')))
  cleanup.push(() => compiler.close())
  const session = () => {
    const tools = createPlaybookTools(repository, playbook.id, new PlaybookObservations(), compiler)
    return (name: ToolName, args: unknown, signal = new AbortController().signal) => tools.find(tool => tool.name === name)!.execute(args, { signal })
  }
  const rawConnection = () => { const db = new DatabaseSync(path); cleanup.push(() => db.close()); return db }
  return { repository, storage, playbook, snapshot, session, writePeer, rawConnection }
}
const replace = (path: string, source: string) => ({ operations: [{ kind: 'replace-file', path, source }] })
const translate = (language: string, text: string) => ({ operations: [{ kind: 'set-translation', key: 'opening', language, text }] })

test('sessions edit separate files and translations without refreshing a shared sequence', async () => {
  const f = fixture(), a = f.session(), b = f.session()
  await a('playbook_program_read', { path: 'a.js' }); await b('playbook_program_read', { path: 'b.js' })
  await a('playbook_text_read', { key: 'opening', language: 'en' }); await b('playbook_text_read', { key: 'opening', language: 'zh-CN' })
  const receipts = await Promise.all([
    a('playbook_program_edit', replace('a.js', 'A')),
    b('playbook_text_edit', translate('zh-CN', '新内容')),
    b('playbook_program_edit', replace('b.js', 'B')),
    a('playbook_text_edit', translate('en', 'New content')),
  ])
  expect(receipts).toMatchObject([{ sequence: 2 }, { sequence: 3 }, { sequence: 4 }, { sequence: 5 }])
  const content = f.snapshot().content
  expect(content.program.files.get('a.js')!.source).toBe('A'); expect(content.program.files.get('b.js')!.source).toBe('B')
  expect(content.texts.entries.get('opening')!.translations.get('en')!.text).toBe('New content')
  expect(content.texts.entries.get('opening')!.translations.get('zh-CN')!.text).toBe('新内容')
  await expect(a('playbook_program_edit', replace('unread.js', 'unseen'))).rejects.toMatchObject({ code: 'not-observed' })
})

test('a changed observed object rejects the entire batch while unrelated human edits remain', async () => {
  const f = fixture(), a = f.session(), b = f.session()
  await a('playbook_program_read', { path: 'a.js' }); await b('playbook_program_read', { path: 'a.js' })
  f.writePeer([{ kind: 'replace-file', path: 'b.js', source: 'Human edit' }])
  await a('playbook_program_edit', replace('a.js', 'A'))
  const before = f.snapshot()
  await expect(b('playbook_program_edit', { operations: [{ kind: 'create-file', path: 'candidate.js', source: '' }, ...replace('a.js', 'B').operations] })).rejects.toMatchObject({ code: 'observation-stale' })
  expect(f.snapshot()).toEqual(before)
})

test('a competing translation between calculation and save is preserved on retry without granting whole-entry authority', async () => {
  const f = fixture(), call = f.session()
  await call('playbook_text_read', { key: 'opening' })
  const write = f.storage.writeDraft.bind(f.storage)
  const attempts = vi.spyOn(f.storage, 'writeDraft').mockImplementationOnce(input => {
    f.writePeer([{ kind: 'set-translation', key: 'opening', language: 'zh-CN', text: '来自另一会话' }])
    return write(input)
  })
  await expect(call('playbook_text_edit', translate('en', 'Hello again'))).resolves.toMatchObject({ sequence: 3 })
  expect(attempts).toHaveBeenCalledTimes(2)
  const entry = f.snapshot().content.texts.entries.get('opening')!
  expect(entry.translations.get('en')!.text).toBe('Hello again')
  expect(entry.translations.get('zh-CN')!.text).toBe('来自另一会话')
  await expect(call('playbook_text_edit', { operations: [{ kind: 'rename-text', key: 'opening', to: 'renamed' }] })).rejects.toMatchObject({ code: 'observation-stale' })
  await expect(call('playbook_text_edit', translate('zh-CN', '未读修改'))).rejects.toMatchObject({ code: 'observation-stale' })
  await call('playbook_text_edit', translate('en', 'Own saved text remains observed'))
})

test('retry keeps the original file observation and refuses to recalculate over another author', async () => {
  const f = fixture(), call = f.session()
  await call('playbook_program_read', { path: 'a.js' })
  const write = f.storage.writeDraft.bind(f.storage)
  const attempts = vi.spyOn(f.storage, 'writeDraft').mockImplementationOnce(input => {
    f.writePeer([{ kind: 'replace-file', path: 'a.js', source: 'Other author' }])
    return write(input)
  })
  await expect(call('playbook_program_edit', { operations: [{ kind: 'replace-text', path: 'a.js', oldText: 'original', newText: 'Candidate' }] })).rejects.toMatchObject({ code: 'observation-stale' })
  expect(attempts).toHaveBeenCalledTimes(1)
  expect(f.snapshot().content.program.files.get('a.js')!.source).toBe('Other author')
})

test('contention stops after three rejected writes and does not advance observations', async () => {
  const f = fixture(), call = f.session()
  await call('playbook_program_read', { path: 'a.js' })
  const write = f.storage.writeDraft.bind(f.storage)
  let other = 0
  const attempts = vi.spyOn(f.storage, 'writeDraft').mockImplementation(input => {
    f.writePeer([{ kind: 'replace-file', path: 'b.js', source: String(++other) }])
    return write(input)
  })
  await expect(call('playbook_program_edit', replace('a.js', 'Candidate'))).rejects.toMatchObject({ code: 'write-contention' })
  expect(attempts).toHaveBeenCalledTimes(3)
  expect(f.snapshot().draft.sequence).toBe(4)
  expect(f.snapshot().content.program.files.get('a.js')!.source).toBe('original')
  attempts.mockRestore()
  await call('playbook_program_edit', replace('a.js', 'After contention'))
})

test('cancellation between rejected save attempts leaves candidate content and observations uncommitted', async () => {
  const f = fixture(), call = f.session(), abort = new AbortController()
  const write = f.storage.writeDraft.bind(f.storage)
  const attempts = vi.spyOn(f.storage, 'writeDraft').mockImplementationOnce(input => {
    f.writePeer([{ kind: 'replace-file', path: 'b.js', source: 'Other' }]); abort.abort()
    return write(input)
  })
  await expect(call('playbook_program_edit', { operations: [{ kind: 'create-file', path: 'new.js', source: 'Candidate' }] }, abort.signal)).rejects.toThrow()
  expect(attempts).toHaveBeenCalledTimes(1)
  expect(f.snapshot().content.program.files.has('new.js')).toBe(false)
  f.writePeer([{ kind: 'create-file', path: 'new.js', source: 'Candidate' }])
  await expect(call('playbook_program_edit', replace('new.js', 'Changed'))).rejects.toMatchObject({ code: 'not-observed' })
})

test('SQL failure rolls back every file and a busy database is not retried', async () => {
  const f = fixture(), call = f.session(), db = f.rawConnection()
  await call('playbook_program_read', { path: 'a.js' }); await call('playbook_program_read', { path: 'b.js' })
  const before = f.snapshot(), attempts = vi.spyOn(f.storage, 'writeDraft')
  db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON draft_entries WHEN NEW.key='program/b.js' BEGIN SELECT RAISE(ABORT, 'forced failure'); END")
  await expect(call('playbook_program_edit', { operations: [...replace('a.js', 'Candidate').operations, ...replace('b.js', 'Candidate').operations] })).rejects.toMatchObject({ code: 'database-error' })
  expect(f.snapshot()).toEqual(before); expect(attempts).toHaveBeenCalledTimes(1)
  db.exec('DROP TRIGGER fail_second; BEGIN IMMEDIATE')
  try { await expect(call('playbook_program_edit', replace('a.js', 'Busy'))).rejects.toMatchObject({ code: 'busy' }) }
  finally { db.exec('ROLLBACK') }
  expect(attempts).toHaveBeenCalledTimes(2); expect(f.snapshot()).toEqual(before)
  await call('playbook_program_edit', replace('a.js', 'Saved after rollback'))
})

test('receipts and observations retain their committed snapshot when a later writer saves before the reply', async () => {
  const f = fixture(), call = f.session()
  await call('playbook_program_read', { path: 'a.js' })
  const write = f.storage.writeDraft.bind(f.storage)
  vi.spyOn(f.storage, 'writeDraft').mockImplementationOnce(input => {
    const committed = write(input)
    f.writePeer([{ kind: 'replace-file', path: 'a.js', source: 'Later writer' }])
    return committed
  })
  await expect(call('playbook_program_edit', replace('a.js', 'My committed text'))).resolves.toMatchObject({ sequence: 2 })
  expect(f.snapshot().draft.sequence).toBe(3)
  await expect(call('playbook_program_edit', replace('a.js', 'Next edit'))).rejects.toMatchObject({ code: 'observation-stale' })
})

test('creation and path constraints reject collisions after a competing save', async () => {
  const f = fixture(), call = f.session(), write = f.storage.writeDraft.bind(f.storage)
  vi.spyOn(f.storage, 'writeDraft').mockImplementationOnce(input => {
    f.writePeer([{ kind: 'create-file', path: 'new.js', source: 'Other' }])
    return write(input)
  })
  await expect(call('playbook_program_edit', { operations: [{ kind: 'create-file', path: 'new.js', source: 'Candidate' }] })).rejects.toMatchObject({ code: 'already-exists' })
  const before = f.snapshot()
  await expect(call('playbook_program_edit', { operations: [{ kind: 'create-file', path: 'a.js/child', source: '' }] })).rejects.toThrow()
  expect(f.snapshot()).toEqual(before)
})

test('default-language observations are independent of metadata, while language deletion pins the whole batch', async () => {
  const f = fixture(), a = f.session(), b = f.session()
  await a('playbook_status', {}); await b('playbook_status', {})
  await a('playbook_text_edit', { operations: [{ kind: 'set-default-language', language: 'zh-CN' }] })
  await expect(b('playbook_text_edit', { operations: [{ kind: 'set-default-language', language: 'en' }] })).rejects.toMatchObject({ code: 'observation-stale' })
  await b('playbook_text_edit', { operations: [{ kind: 'set-metadata', target: { kind: 'catalog' }, metadata: { label: 'Shared catalog' } }] })
  const before = f.snapshot()
  await expect(a('playbook_text_edit', { operations: [{ kind: 'delete-language', language: 'en', expectedSequence: 2 }] })).rejects.toMatchObject({ code: 'conflict' })
  expect(f.snapshot()).toEqual(before)
  await a('playbook_text_edit', { operations: [{ kind: 'delete-language', language: 'en', expectedSequence: 3 }] })
  expect(f.snapshot().content.texts.entries.get('opening')!.translations.has('en')).toBe(false)
  expect(schemas.playbook_text_edit.safeParse({ operations: [{ kind: 'delete-language', language: 'zh-CN' }] }).success).toBe(false)
})

test('revision commits and restoration still reject a changed complete snapshot', async () => {
  const f = fixture(), call = f.session()
  const revision = f.repository.commitRevision({ playbookId: f.playbook.id, expectedSequence: 1, description: 'Before edits' }).revision
  f.writePeer([{ kind: 'replace-file', path: 'a.js', source: 'New' }])
  await expect(call('playbook_commit', { expectedSequence: 2, description: 'Stale' })).rejects.toMatchObject({ code: 'conflict' })
  await expect(call('playbook_restore', { expectedSequence: 2, revisionId: revision.id, selection: { kind: 'all' } })).rejects.toMatchObject({ code: 'conflict' })
  expect(f.repository.listRevisions(f.playbook.id).items).toHaveLength(1)
  expect(f.snapshot().content.program.files.get('a.js')!.source).toBe('New')
})


test('an observed translation removed by another writer is not silently recreated', async () => {
  const f = fixture(), call = f.session()
  await call('playbook_text_read', { key: 'opening', language: 'en' })
  f.writePeer([{ kind: 'delete-translation', key: 'opening', language: 'en' }])
  const before = f.snapshot()
  await expect(call('playbook_text_edit', translate('en', 'Stale replacement'))).rejects.toMatchObject({ code: 'observation-stale' })
  expect(f.snapshot()).toEqual(before)
  await expect(call('playbook_text_read', { key: 'opening', language: 'en' })).resolves.toMatchObject({ result: { kind: 'missing', reason: 'translation' } })
  await call('playbook_text_edit', translate('en', 'Explicit recreation'))
  f.writePeer([{ kind: 'delete-translation', key: 'opening', language: 'en' }])
  await call('playbook_text_read', { key: 'opening' })
  await call('playbook_text_edit', translate('en', 'After complete entry read'))
})
