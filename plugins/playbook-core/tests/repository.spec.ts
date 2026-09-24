import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { PlaybookStorage } from '@papermoon/playbook-storage'
import type { ContentRef, RevisionId } from '@papermoon/playbook-storage'
import { PlaybookRepository } from '../src/repository.ts'
import { encodeContent, readFile, readText } from '../src/index.ts'
import type { ComparisonCursor } from '../src/index.ts'
import { station, workshop } from './fixtures.ts'

const cleanups: Array<() => void> = []
afterEach(() => { vi.restoreAllMocks(); for (const cleanup of cleanups.splice(0).reverse()) cleanup() })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-core-'))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'playbook.sqlite'), storage = new PlaybookStorage({ path })
  cleanups.push(() => storage.close())
  const repository = new PlaybookRepository(storage), project = repository.createProject({ name: 'Playbooks', metadata: { owner: 'local' } })
  const playbook = repository.createPlaybook({ projectId: project.id, name: 'Empty', defaultLanguage: 'zh-CN', draftMetadata: { editor: 'draft' } })
  const ref = { kind: 'draft', playbookId: playbook.id } as const
  const current = () => repository.readSnapshot(ref)
  const seed = () => storage.writeDraft({ playbookId: playbook.id, expectedSequence: current().draft.sequence, changes: [...encodeContent(station())].map(([key, value]) => ({ kind: 'set', key, value })) })
  const commit = (description = 'Revision') => repository.commitRevision({ playbookId: playbook.id, expectedSequence: current().draft.sequence, description })
  const raw = () => { const db = new DatabaseSync(path); cleanups.push(() => db.close()); return db }
  return { path, storage, repository, project, playbook, ref, current, seed, commit, raw }
}
const rejects = (code: string, body: () => unknown) => expect(body).toThrow(expect.objectContaining({ code }))

describe('persistent authoring', () => {
  it('creates a valid empty draft, commits incomplete content and registers publication without compilation', () => {
    const f = fixture()
    expect(f.current().draft).toMatchObject({ sequence: 0, metadata: { editor: 'draft' } })
    expect(f.current().content.program.files.size).toBe(0)
    const first = f.commit('  First  ')
    expect(first.revision.description).toBe('  First  ')
    expect(first.entry.ordinal).toBe(1)
    f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 1, operations: [{ kind: 'create-file', path: 'anything.ext', source: 'broken syntax {' }, { kind: 'create-text', key: 'untranslated' }] })
    const next = f.commit()
    expect(next.entry.ordinal).toBe(2)
    const publication = f.repository.registerPublication({ playbookId: f.playbook.id, revisionId: next.revision.id, metadata: { reason: 'internal' } })
    expect(f.repository.getPublication(publication.id)).toEqual(publication)
    expect(f.repository.registerPublication({ playbookId: f.playbook.id, revisionId: next.revision.id }).id).not.toBe(publication.id)
    expect(f.repository.listPublications({ playbookId: f.playbook.id }).items).toHaveLength(2)
    rejects('invalid-input', () => f.commit(' \n '))
    expect(f.repository.listRevisions(f.playbook.id).items).toHaveLength(2)
    expect(f.repository.readSnapshot({ kind: 'revision', revisionId: first.revision.id }).content.program.files.size).toBe(0)
  })
  it('writes a program/text batch once, preserves snapshots and rejects invalid final states atomically', () => {
    const f = fixture(), before = f.current()
    const changed = f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 0, metadata: { editor: 'manual' }, operations: [
      { kind: 'create-file', path: 'main.js', source: 't("key")' }, { kind: 'create-text', key: 'key' }, { kind: 'set-translation', key: 'key', language: 'zh-CN', text: '文案' },
    ] })
    expect(changed.ref).toMatchObject({ sequence: 1 })
    expect(changed.draft.metadata).toEqual({ editor: 'manual' })
    expect(before.content.program.files.size).toBe(0)
    rejects('invalid-content', () => f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 1, metadata: {}, operations: [
      { kind: 'replace-file', path: 'main.js', source: 'bad candidate' }, { kind: 'delete-language', language: 'zh-CN' },
    ] }))
    expect(f.current()).toEqual(changed)
    const noop = f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 1, operations: [] })
    expect(noop.draft.sequence).toBe(2)
    rejects('conflict', () => f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 1, operations: [] }))
  })
  it('rejects an interleaved writer at the final CAS without saving its candidate', () => {
    const f = fixture(), second = new PlaybookStorage({ path: f.path }); cleanups.push(() => second.close())
    const original = f.storage.writeDraft.bind(f.storage)
    vi.spyOn(f.storage, 'writeDraft').mockImplementationOnce(input => {
      second.writeDraft({ playbookId: f.playbook.id, expectedSequence: 0, changes: [], metadata: { other: true } })
      return original(input)
    })
    rejects('conflict', () => f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'candidate', source: 'must not commit' }] }))
    expect(f.current().draft.metadata).toEqual({ other: true })
    expect(f.current().content.program.files.size).toBe(0)
  })
  it('keeps owner metadata and content in one read transaction under connection contention', () => {
    const f = fixture(), second = new PlaybookStorage({ path: f.path }); cleanups.push(() => second.close())
    const connection = (f.storage as unknown as { db: { all: (...args: unknown[]) => unknown[] } }).db
    const all = connection.all.bind(connection)
    vi.spyOn(connection, 'all').mockImplementationOnce((...args) => {
      const rows = all(...args)
      rejects('busy', () => second.writeDraft({ playbookId: f.playbook.id, expectedSequence: 0, changes: [], metadata: { mixed: true } }))
      return rows
    })
    expect(f.current().draft).toMatchObject({ sequence: 0, metadata: { editor: 'draft' } })
    expect(second.getDraft(f.playbook.id).sequence).toBe(0)
  })
  it('keeps revision/directory metadata immutable and owner management changes out of content differences', () => {
    const f = fixture(); f.seed()
    const first = f.repository.commitRevision({ playbookId: f.playbook.id, expectedSequence: 1, description: 'First', metadata: { revision: true }, historyMetadata: { directory: true } })
    f.repository.updateProject(f.project.id, { name: 'Renamed', metadata: { replaced: true } })
    f.repository.updateScript(f.playbook.id, { name: 'Renamed', metadata: { management: true } })
    f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 2, metadata: { editor: 'changed' }, operations: [] })
    const next = f.commit('Second')
    expect(f.repository.getRevision(first.revision.id).metadata).toEqual({ revision: true })
    expect(f.repository.listRevisions(f.playbook.id).items[0]?.metadata).toEqual({ directory: true })
    expect(next.revision.metadata).toEqual({})
    expect(f.repository.compare({ kind: 'revision', revisionId: first.revision.id }, { kind: 'revision', revisionId: next.revision.id }).items).toEqual([])
    expect(f.repository.getProject(f.project.id).metadata).toEqual({ replaced: true })
    expect(f.repository.getPlaybook(f.playbook.id).metadata).toEqual({ management: true })
  })
  it('restores full or partial content with different provenance and without resetting draft metadata', () => {
    const f = fixture(); f.seed(); const first = f.commit()
    f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 2, operations: [{ kind: 'replace-file', path: 'entry.mjs', source: 'changed' }, { kind: 'set-description', key: 'greeting', description: 'Changed purpose' }] })
    const second = f.commit()
    const partial = f.repository.restoreDraft({ playbookId: f.playbook.id, expectedSequence: 4, revisionId: first.revision.id, selection: { kind: 'text', key: 'greeting' } })
    expect(partial.draft.baseRevisionId).toBe(second.revision.id)
    expect(readText(partial.content, 'greeting').description).toBe('First greeting')
    expect(readFile(partial.content, 'entry.mjs').source).toBe('changed')
    const full = f.repository.restoreDraft({ playbookId: f.playbook.id, expectedSequence: 5, revisionId: first.revision.id, selection: { kind: 'all' } })
    expect(full.draft.baseRevisionId).toBe(first.revision.id)
    expect(full.draft.metadata).toEqual({ editor: 'draft' })
    expect(full.content).toEqual(first.content)
    expect(f.repository.listRevisions(f.playbook.id).items).toHaveLength(2)
  })
  it('copies history by reference, preserves independent publication and survives deleting the source', () => {
    const f = fixture(); f.seed(); const first = f.commit(); const next = f.commit()
    f.repository.registerPublication({ playbookId: f.playbook.id, revisionId: first.revision.id, metadata: { one: 1 } })
    const project = f.repository.createProject({ name: 'Other' })
    const copy = f.repository.copyPlaybook({ sourcePlaybookId: f.playbook.id, source: { kind: 'revision', revisionId: first.revision.id }, targetProjectId: project.id, name: 'Copy', history: 'copy', publications: 'copy' })
    expect(f.repository.listRevisions(copy.id).items.map(item => item.revision.id)).toEqual([first.revision.id])
    expect(f.repository.listPublications({ playbookId: copy.id }).items[0]?.metadata).toEqual({ one: 1 })
    expect(f.raw().prepare('SELECT COUNT(*) AS n FROM revisions').get()).toMatchObject({ n: 2 })
    f.repository.deleteProject(f.project.id)
    expect(f.repository.readSnapshot({ kind: 'revision', revisionId: first.revision.id }).content).toEqual(first.content)
    rejects('not-found', () => f.repository.getRevision(next.revision.id))
    rejects('not-found', () => f.repository.registerPublication({ playbookId: copy.id, revisionId: next.revision.id }))
    f.repository.deletePlaybook(copy.id)
    rejects('not-found', () => f.repository.getRevision(first.revision.id))
  })
  it('rejects malformed stored business content at the owning decoder', () => {
    const f = fixture()
    f.storage.writeDraft({ playbookId: f.playbook.id, expectedSequence: 0, changes: [{ kind: 'delete', key: 'content' }] })
    rejects('invalid-content', () => f.current())
    rejects('invalid-content', () => f.commit())
    rejects('invalid-content', () => f.repository.compare(f.ref, f.ref))
    expect(f.repository.listRevisions(f.playbook.id).items).toEqual([])
  })
  it('retains results after reopening and exposes the storage closed failure', () => {
    const f = fixture(); f.seed(); const revision = f.commit()
    f.storage.close()
    rejects('closed', () => f.current())
    const reopened = new PlaybookStorage({ path: f.path }); cleanups.push(() => reopened.close())
    expect(new PlaybookRepository(reopened).readSnapshot({ kind: 'revision', revisionId: revision.revision.id }).content).toEqual(revision.content)
  })
})

describe('business queries and SQL comparison', () => {
  it('groups multiple translation changes with source and metadata differences', () => {
    const f = fixture(); f.seed(); const revision = f.commit()
    f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 2, operations: [
      { kind: 'set-translation', key: 'greeting', language: 'zh-CN', text: '修改', metadata: { reviewed: false } },
      { kind: 'delete-translation', key: 'greeting', language: 'en' }, { kind: 'set-description', key: 'greeting', description: 'New purpose' },
      { kind: 'replace-file', path: 'entry.mjs', source: 'next source' }, { kind: 'delete-file', path: 'rules/clock.ts' },
      { kind: 'create-file', path: 'new.any', source: '' }, { kind: 'set-default-language', language: 'en' },
      { kind: 'set-metadata', target: { kind: 'language', language: 'en' }, metadata: { label: 'Changed' } },
    ] })
    const left: ContentRef = { kind: 'revision', revisionId: revision.revision.id }
    const diff = f.repository.compare(left, f.ref)
    expect(diff.items.map(item => item.kind)).toContain('added')
    expect(diff.items.map(item => item.kind)).toContain('removed')
    const text = diff.items.find(item => item.after?.kind === 'text')
    expect(text?.fields).toEqual([['description'], ['translations', 'en'], ['translations', 'zh-CN', 'text'], ['translations', 'zh-CN', 'metadata']])
    expect(diff.items.find(item => item.after?.kind === 'settings')?.fields).toEqual([['defaultLanguage']])
    expect(f.repository.compare(left, f.ref, { scope: 'texts', limit: 1 }).items).toHaveLength(1)
    expect(f.repository.compare(left, f.ref, { scope: 'languages' }).items[0]?.fields).toEqual([['metadata']])
    const next = f.commit()
    expect(f.repository.compare(left, { kind: 'revision', revisionId: next.revision.id }).items).toEqual(diff.items)
    expect(f.repository.compare(left, left).items).toEqual([])
  })
  it('keeps diff cursors tied to both sources and scope, with SQL filtering rather than full reads', () => {
    const f = fixture(); const empty = f.commit(); f.seed()
    const fullRead = vi.spyOn(f.storage, 'readSnapshot')
    const first = f.repository.compare({ kind: 'revision', revisionId: empty.revision.id }, f.ref, { limit: 1 })
    expect(fullRead).not.toHaveBeenCalled()
    const seen = [...first.items]
    let page = first
    while (page.next) { page = f.repository.compare(first.left, first.right, { after: page.next, limit: 1 }); seen.push(...page.items) }
    expect(seen).toEqual(f.repository.compare(first.left, first.right).items)
    rejects('invalid-input', () => f.repository.compare(first.left, f.ref, { after: first.next }))
    rejects('invalid-input', () => f.repository.compare(first.left, first.right, { after: first.next, scope: 'texts' }))
    rejects('invalid-input', () => f.repository.compare(first.left, first.right, { after: 'broken' as ComparisonCursor }))
    f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 2, operations: [] })
    rejects('conflict', () => f.repository.compare(first.left, first.right, { after: first.next }))
  })
  it('pins list, search, missing-translation pages and subsequent detail reads', () => {
    const f = fixture(); f.seed()
    const files = f.repository.listFiles(f.ref, { limit: 1 })
    expect(f.repository.listFiles(files.ref, { after: files.next }).items).toHaveLength(1)
    const texts = f.repository.listTexts(f.ref, { limit: 1 })
    expect(f.repository.listTexts(texts.ref, { after: texts.next }).items[0]?.key).toBe('greeting')
    const search = f.repository.searchProgram(f.ref, 'export', { limit: 1 })
    expect(f.repository.searchProgram(search.ref, 'export', { after: search.next }).items).toHaveLength(1)
    expect(f.repository.searchTexts(f.ref, { query: 'Hello', language: 'en' }).items).toHaveLength(1)
    expect(f.repository.listLanguages(f.ref).items.map(item => item.id)).toEqual(['en', 'zh-CN'])
    expect(f.repository.readLanguage(f.ref, 'en').language.metadata).toEqual({ label: 'English' })
    expect(f.repository.listMissingTranslations(f.ref, 'en').items[0]?.key).toBe('alarm')
    expect(f.repository.lookupTranslation(f.ref, 'alarm', 'en').result).toEqual({ kind: 'missing', reason: 'translation' })
    expect(f.repository.readText(f.ref, 'greeting').entry.description).toBe('First greeting')
    rejects('invalid-input', () => f.repository.searchProgram(f.ref, 'export', { after: search.next }))
    f.repository.editDraft({ playbookId: f.playbook.id, expectedSequence: 1, operations: [] })
    rejects('conflict', () => f.repository.listFiles(files.ref, { after: files.next }))
    rejects('conflict', () => f.repository.searchProgram(search.ref, 'export', { after: search.next }))
    rejects('conflict', () => f.repository.readFile(files.ref, 'entry.mjs'))
  })
  it('compares two playbooks and rejects later draft pages after either side changes', () => {
    const f = fixture(); f.seed()
    const second = f.storage.createPlaybook({ projectId: f.project.id, name: 'Workshop', initialContent: encodeContent(workshop()) })
    const right: ContentRef = { kind: 'draft', playbookId: second.id }
    const diff = f.repository.compare(f.ref, right, { limit: 1 })
    expect(diff.next).toBeDefined()
    f.repository.editDraft({ playbookId: second.id, expectedSequence: 0, operations: [] })
    rejects('conflict', () => f.repository.compare(diff.left, diff.right, { after: diff.next }))
    rejects('not-found', () => f.repository.readSnapshot({ kind: 'revision', revisionId: 'absent' as RevisionId }))
  })
})
