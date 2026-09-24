import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { spawnSync } from 'node:child_process'
import { PlaybookStorage, StorageError, STORAGE_APPLICATION_ID } from '../src/index.ts'
import type { ContentRef, JsonValue, RevisionId } from '../src/index.ts'
import { encode, decode } from '../src/json.ts'
import { apply, serviceKey } from '../src/plugin.ts'
import type { StorageHost } from '../src/plugin.ts'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup() })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-storage-'))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'playbook.sqlite')
  const store = new PlaybookStorage({ path }); cleanups.push(() => store.close())
  const project = store.createProject({ name: 'Station' })
  const playbook = store.createPlaybook({ projectId: project.id, name: 'Cooperation' })
  const raw = () => { const db = new DatabaseSync(path); cleanups.push(() => db.close()); return db }
  const put = (values: Record<string, JsonValue>) => store.writeDraft({ playbookId: playbook.id, expectedSequence: store.getDraft(playbook.id).sequence, changes: Object.entries(values).map(([key, value]) => ({ kind: 'set', key, value })) })
  const commit = (description = '') => store.commitRevision({ playbookId: playbook.id, expectedSequence: store.getDraft(playbook.id).sequence, description })
  return { directory, path, store, project, playbook, raw, put, commit }
}
function fails(code: StorageError['code'], operation: () => unknown) { expect(operation).toThrow(expect.objectContaining({ code })) }

// These are consumer data examples, not declarations interpreted by the repository.
const mixedContent = {
  'code/main.js': 'export default {\n  unfinished: ',
  'copy/start': { purpose: 'opening message', locales: { 'zh-CN': '门缓缓打开。', en: 'The door opens.' } },
  'custom/list': [null, true, 2, { unordered: 'value' }],
  'nullable': null,
} satisfies Record<string, JsonValue>

describe('JSON values', () => {
  it('preserves exact text and array order while canonicalizing object members', () => {
    expect(encode({ b: 2, a: { z: 3, y: 4 } })).toBe(encode({ a: { y: 4, z: 3 }, b: 2 }))
    const values = [null, false, 1, -0, 'a\r\nb\n', '\ud800', [1, 2], JSON.parse('{"__proto__":{"x":1}}')]
    for (const value of values) expect(decode(encode(value))).toEqual(value === 0 ? 0 : value)
    const shared = { value: 1 }
    expect(decode(encode([shared, shared]))).toEqual([shared, shared])
  })
  it('rejects values JSON would otherwise silently change or omit', () => {
    const cycle: { self?: unknown } = {}; cycle.self = cycle
    const hidden = Object.defineProperty({}, 'hidden', { value: 1 })
    const accessor = Object.defineProperty({}, 'get', { enumerable: true, get: () => { throw new Error('must not execute') } })
    const extraArray = Object.assign([1], { extra: true })
    const sparse: number[] = []; sparse.length = 2
    for (const value of [undefined, NaN, Infinity, 1n, () => 1, Symbol(), new Date(), new Map(), cycle, sparse, extraArray, hidden, accessor, { [Symbol()]: 1 }, { bad: undefined }]) {
      fails('invalid-input', () => encode(value))
    }
    fails('corrupt', () => decode('{"b":1,"a":2}'))
    fails('corrupt', () => decode('not json'))
  })
})

describe('drafts and immutable revisions', () => {
  it('stores code and localized copy as ordinary keys, including unfinished source', () => {
    const f = fixture(); const draft = f.put(mixedContent)
    const read = f.store.readContent({ kind: 'draft', playbookId: f.playbook.id, sequence: draft.sequence })
    expect(Object.fromEntries(read.content)).toEqual(mixedContent)
    expect(f.store.listRevisions(f.playbook.id).items).toEqual([])
    const committed = f.commit('')
    expect(committed.entry.ordinal).toBe(1)
    expect(committed.draft).toEqual({ playbookId: f.playbook.id, sequence: 2, baseRevisionId: committed.revision.id, metadata: {} })
    expect(Object.fromEntries(f.store.readContent({ kind: 'revision', revisionId: committed.revision.id }).content)).toEqual(mixedContent)
    f.put({ 'copy/start': { locales: { en: 'Revised' } } })
    expect(f.store.readEntry({ kind: 'revision', revisionId: committed.revision.id }, 'copy/start').entry).toEqual({ exists: true, value: mixedContent['copy/start'] })
    const second = f.commit('Next')
    f.store.restoreDraft({ playbookId: f.playbook.id, expectedSequence: second.draft.sequence, revisionId: committed.revision.id })
    const third = f.commit('Return to first')
    expect(third.entry.ordinal).toBe(3)
    expect(third.revision.source.baseRevisionId).toBe(committed.revision.id)
    expect(f.store.listRevisions(f.playbook.id).items.map(x => x.revision.id)).toEqual([committed.revision.id, second.revision.id, third.revision.id])
    expect(third.revision.id).not.toBe(committed.revision.id)
  })
  it('does not give callers a mutable alias and distinguishes missing from null', () => {
    const f = fixture(); f.put({ a: { b: [1] }, nullable: null, '__proto__.literal': true, '': false })
    const ref: ContentRef = { kind: 'draft', playbookId: f.playbook.id }
    const read = f.store.readContent(ref)
    ;(read.content.get('a') as { b: number[] }).b.push(2)
    expect(f.store.readEntry(ref, 'a').entry).toEqual({ exists: true, value: { b: [1] } })
    expect(f.store.readEntry(ref, 'nullable').entry).toEqual({ exists: true, value: null })
    expect(f.store.readEntry(ref, 'missing').entry).toEqual({ exists: false })
    expect(f.store.readEntry(ref, '').entry).toEqual({ exists: true, value: false })
    const draft = f.store.getDraft(f.playbook.id)
    f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: draft.sequence, changes: [{ kind: 'set', key: 'nullable', value: 1 }, { kind: 'delete', key: 'nullable' }] })
    expect(f.store.readEntry(ref, 'nullable').entry).toEqual({ exists: false })
    fails('conflict', () => f.store.readContent(read.ref))
  })
  it('keeps identity and historical provenance across renames and uses metadata replacement', () => {
    const f = fixture(); const first = f.commit()
    const project = f.store.updateProject(f.project.id, { name: 'Renamed', metadata: { genre: 'experimental' } })
    const playbook = f.store.updateScript(f.playbook.id, { name: 'Reworked', metadata: { role: 'candidate' } })
    expect(project.id).toBe(f.project.id); expect(playbook.id).toBe(f.playbook.id)
    expect(f.store.getRevision(first.revision.id).source.projectName).toBe('Station')
    expect(f.store.getRevision(first.revision.id).source.playbookName).toBe('Cooperation')
    expect(f.store.updateProject(project.id, { metadata: {} }).metadata).toEqual({})
    expect(f.store.updateScript(playbook.id, { metadata: {} }).metadata).toEqual({})
    fails('invalid-input', () => f.store.createProject({ name: ' ' }))
    fails('invalid-input', () => f.store.createProject({ name: '\ud800' }))
  })
  it('paginates metadata without embedding revision content', () => {
    const f = fixture(); const revisions = [f.commit(), f.commit(), f.commit()]
    const first = f.store.listRevisions(f.playbook.id, { limit: 2 })
    expect(first.items.map(x => x.ordinal)).toEqual([1, 2]); expect(first.next).toBe(2)
    const second = f.store.listRevisions(f.playbook.id, { limit: 2, after: first.next })
    expect(second.items[0]?.revision.id).toBe(revisions[2]!.revision.id); expect(second.next).toBeUndefined()
    expect(second.items[0]?.revision).not.toHaveProperty('content')
    f.store.createProject({ name: 'Other' })
    const projects = f.store.listProjects({ limit: 1 })
    expect(f.store.listProjects({ limit: 1, after: projects.next }).items).toHaveLength(1)
    f.store.createPlaybook({ projectId: f.project.id, name: 'Other' })
    const playbooks = f.store.listPlaybooks(f.project.id, { limit: 1 })
    expect(f.store.listPlaybooks(f.project.id, { limit: 1, after: playbooks.next }).items).toHaveLength(1)
    fails('invalid-input', () => f.store.listProjects({ limit: 0 }))
  })
})

describe('copy, publication and retention', () => {
  it('copies reference prefixes and independent drafts without duplicating revision bodies', () => {
    const f = fixture(); f.put({ value: 'first' }); const first = f.commit('first')
    f.put({ value: 'second' }); const second = f.commit('second')
    f.put({ value: 'uncommitted' })
    const published = f.store.createPublication({ playbookId: f.playbook.id, revisionId: first.revision.id, metadata: { release: 'A' } })
    f.store.createPublication({ playbookId: f.playbook.id, revisionId: second.revision.id })
    const raw = f.raw()
    const before = raw.prepare('SELECT COUNT(*) AS n FROM revision_entries').get()
    const targetProject = f.store.createProject({ name: 'Different work' })
    const copy = f.store.copyPlaybook({ sourcePlaybookId: f.playbook.id, source: { kind: 'revision', revisionId: first.revision.id }, targetProjectId: targetProject.id, name: 'Alternative', history: 'copy', publications: 'copy' })
    expect(raw.prepare('SELECT COUNT(*) AS n FROM revision_entries').get()).toEqual(before)
    expect(f.store.listRevisions(copy.id).items.map(x => x.revision.id)).toEqual([first.revision.id])
    expect(f.store.readEntry({ kind: 'draft', playbookId: copy.id }, 'value').entry).toEqual({ exists: true, value: 'first' })
    const copiedPublication = f.store.listPublications({ playbookId: copy.id }).items[0]!
    expect(copiedPublication.id).not.toBe(published.id)
    expect(copiedPublication.metadata).toEqual(published.metadata)
    expect(copiedPublication.createdAt).toBe(published.createdAt)
    f.store.writeDraft({ playbookId: copy.id, expectedSequence: 0, changes: [{ kind: 'set', key: 'value', value: 'independent' }] })
    const copiedCommit = f.store.commitRevision({ playbookId: copy.id, expectedSequence: 1, description: 'new direction' })
    expect(copiedCommit.entry.ordinal).toBe(2)
    expect(f.store.listRevisions(f.playbook.id).items[1]?.revision.id).toBe(second.revision.id)
    f.store.deleteProject(f.project.id)
    expect(f.store.getRevision(first.revision.id).source.playbookId).toBe(f.playbook.id)
    expect(f.store.getPublication(copiedPublication.id).playbookId).toBe(copy.id)
    fails('not-found', () => f.store.getPublication(published.id))
    fails('not-found', () => f.store.getRevision(second.revision.id))
    f.store.deletePlaybook(copy.id)
    expect(raw.prepare('SELECT COUNT(*) AS n FROM revisions').get()).toMatchObject({ n: 0 })
    expect(raw.prepare('SELECT COUNT(*) AS n FROM revision_entries').get()).toMatchObject({ n: 0 })
  })
  it('copies current drafts with explicit scopes and preserves source sequence', () => {
    const f = fixture(); f.put({ value: 1 }); const original = f.commit()
    f.put({ value: 2 }); const draft = f.store.getDraft(f.playbook.id)
    const base = { sourcePlaybookId: f.playbook.id, source: { kind: 'draft' as const, expectedSequence: draft.sequence }, targetProjectId: f.project.id, name: 'Copy' }
    const full = f.store.copyPlaybook({ ...base, history: 'copy', publications: 'none' })
    const onlyContent = f.store.copyPlaybook({ ...base, history: 'none', publications: 'none' })
    expect(f.store.getDraft(f.playbook.id)).toEqual(draft)
    expect(f.store.listRevisions(full.id).items[0]?.revision.id).toBe(original.revision.id)
    expect(f.store.listRevisions(onlyContent.id).items).toEqual([])
    expect(f.store.readEntry({ kind: 'draft', playbookId: onlyContent.id }, 'value').entry).toEqual({ exists: true, value: 2 })
    expect(f.store.commitRevision({ playbookId: onlyContent.id, expectedSequence: 0, description: '' }).entry.ordinal).toBe(1)
    fails('invalid-input', () => f.store.copyPlaybook({ ...base, history: 'none', publications: 'copy' }))
    fails('conflict', () => f.store.copyPlaybook({ ...base, source: { kind: 'draft', expectedSequence: 0 }, history: 'copy', publications: 'none' }))
    fails('not-found', () => f.store.copyPlaybook({ ...base, sourcePlaybookId: onlyContent.id, source: { kind: 'revision', revisionId: original.revision.id }, history: 'copy', publications: 'none' }))
  })
  it('requires local history for publication and does not retain informational references', () => {
    const f = fixture(); f.put({ value: 1 }); const original = f.commit()
    const other = f.store.createPlaybook({ projectId: f.project.id, name: 'Unrelated' })
    fails('not-found', () => f.store.createPublication({ playbookId: other.id, revisionId: original.revision.id }))
    f.store.restoreDraft({ playbookId: other.id, expectedSequence: 0, revisionId: original.revision.id })
    expect(f.store.listRevisions(other.id).items).toEqual([])
    const next = f.store.commitRevision({ playbookId: other.id, expectedSequence: 1, description: '', references: [original.revision.id] })
    const publications = [f.store.createPublication({ playbookId: other.id, revisionId: next.revision.id }), f.store.createPublication({ playbookId: other.id, revisionId: next.revision.id })]
    const first = f.store.listPublications({ revisionId: next.revision.id }, { limit: 1 })
    expect(f.store.listPublications({ playbookId: other.id }, { limit: 1, after: first.next }).items).toHaveLength(1)
    expect(publications[0]!.id).not.toBe(publications[1]!.id)
    f.store.deletePlaybook(f.playbook.id)
    fails('not-found', () => f.store.getRevision(original.revision.id))
    expect(f.store.getRevision(next.revision.id).references).toEqual([original.revision.id])
    expect(f.store.readEntry({ kind: 'draft', playbookId: other.id }, 'value').entry).toEqual({ exists: true, value: 1 })
  })
})

describe('database-side differences', () => {
  it('returns values and presence for all change kinds, with stable key ranges', () => {
    const f = fixture(); f.put({ same: { a: 1, b: 2 }, changed: 1, removed: null, nullable: null, text: 'a\r\nb' }); const first = f.commit()
    f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: first.draft.sequence, changes: [
      { kind: 'set', key: 'same', value: { b: 2, a: 1 } }, { kind: 'set', key: 'changed', value: '1' }, { kind: 'set', key: 'added', value: null }, { kind: 'delete', key: 'removed' },
    ] })
    const diff = f.store.compare({ kind: 'revision', revisionId: first.revision.id }, { kind: 'draft', playbookId: f.playbook.id }, { limit: 2 })
    expect(diff.items).toEqual([
      { key: 'added', kind: 'added', before: { exists: false }, after: { exists: true, value: null } },
      { key: 'changed', kind: 'modified', before: { exists: true, value: 1 }, after: { exists: true, value: '1' } },
    ])
    expect(diff.next).toBe('changed')
    fails('invalid-input', () => f.store.compare(diff.left, { kind: 'draft', playbookId: f.playbook.id }, { after: diff.next }))
    fails('invalid-input', () => f.store.listEntries({ kind: 'draft', playbookId: f.playbook.id }, { after: 'changed' }))
    const rest = f.store.compare(diff.left, diff.right, { after: diff.next })
    expect(rest.items).toEqual([{ key: 'removed', kind: 'removed', before: { exists: true, value: null }, after: { exists: false } }])
    expect(rest.next).toBeUndefined()
    expect(f.store.compare(diff.left, diff.right, { lower: 'changed', upper: 'removed' }).items.map(x => x.key)).toEqual(['changed'])
    expect(f.store.readEntry(diff.right, 'changed').entry).toEqual({ exists: true, value: '1' })
    const entries = f.store.listEntries(diff.right, { lower: 'changed', upper: 'text', limit: 1 })
    expect(entries.items[0]?.key).toBe('changed')
    expect(f.store.listEntries(entries.ref, { lower: 'changed', upper: 'text', after: entries.next }).items.map(x => x.key)).toEqual(['nullable', 'same'])
    f.put({ changed: 2 })
    fails('conflict', () => f.store.compare(diff.left, diff.right, { after: diff.next }))
    fails('conflict', () => f.store.readEntry(diff.right, 'changed'))
    fails('conflict', () => f.store.listEntries(entries.ref))
  })
  it('compares cross-playbook drafts/revisions without changing drafts or history', () => {
    const f = fixture(); f.put({ value: 1 }); const first = f.commit()
    const other = f.store.createPlaybook({ projectId: f.project.id, name: 'Other' })
    f.store.writeDraft({ playbookId: other.id, expectedSequence: 0, changes: [{ kind: 'set', key: 'value', value: 2 }] })
    expect(f.store.compare({ kind: 'draft', playbookId: f.playbook.id }, { kind: 'draft', playbookId: other.id }).items[0]?.kind).toBe('modified')
    const second = f.store.commitRevision({ playbookId: other.id, expectedSequence: 1, description: '' })
    expect(f.store.compare({ kind: 'revision', revisionId: first.revision.id }, { kind: 'revision', revisionId: second.revision.id }).items[0]?.after).toEqual({ exists: true, value: 2 })
    expect(f.store.compare({ kind: 'revision', revisionId: first.revision.id }, { kind: 'revision', revisionId: first.revision.id }).items).toEqual([])
    expect(f.store.getDraft(f.playbook.id)).toEqual(first.draft)
    fails('not-found', () => f.store.compare({ kind: 'revision', revisionId: 'missing' as RevisionId }, { kind: 'revision', revisionId: 'missing' as RevisionId }))
  })
})

describe('atomicity, format and lifecycle', () => {
  it('applies durability and contention settings to the actual repository connection', () => {
    const f = fixture()
    // Observe connection-local pragmas on the owned connection, not on a new connection with different defaults.
    const connection = (f.store as unknown as { db: { db: DatabaseSync } }).db.db
    expect(connection.prepare('PRAGMA synchronous').get()).toMatchObject({ synchronous: 3 })
    expect(connection.prepare('PRAGMA foreign_keys').get()).toMatchObject({ foreign_keys: 1 })
    expect(connection.prepare('PRAGMA busy_timeout').get()).toMatchObject({ timeout: 0 })
    expect(connection.prepare('PRAGMA journal_mode').get()).toMatchObject({ journal_mode: 'delete' })
  })
  it('validates an entire batch before mutation and preserves unusual valid keys', () => {
    const f = fixture(); const draft = f.store.getDraft(f.playbook.id)
    fails('invalid-input', () => f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: draft.sequence, changes: [
      { kind: 'set', key: 'valid', value: 1 }, { kind: 'set', key: 'invalid', value: NaN },
    ] }))
    expect(f.store.getDraft(f.playbook.id)).toEqual(draft)
    expect(f.store.readContent({ kind: 'draft', playbookId: f.playbook.id }).content.size).toBe(0)
    fails('invalid-input', () => f.put({ [String.fromCharCode(0)]: 1 }))
    f.put({ 'a\\0b': 'value' + String.fromCharCode(0), '😀': 2, '中文': 3 })
    expect(f.store.readEntry({ kind: 'draft', playbookId: f.playbook.id }, 'a\\0b').entry).toEqual({ exists: true, value: 'value' + String.fromCharCode(0) })
    const onlyContent = f.store.copyPlaybook({ sourcePlaybookId: f.playbook.id, source: { kind: 'revision', revisionId: f.commit().revision.id }, targetProjectId: f.project.id, name: 'Content', history: 'none', publications: 'none' })
    expect(f.store.listRevisions(onlyContent.id).items).toEqual([])
    expect(f.store.readContent({ kind: 'draft', playbookId: onlyContent.id }).content.size).toBe(3)
  })

  it('rolls back a partial batch and a partially copied revision', () => {
    const f = fixture(); f.put({ a: 1, z: 2 }); const raw = f.raw()
    raw.exec("CREATE TRIGGER fail_draft BEFORE INSERT ON draft_entries WHEN NEW.key='fail' BEGIN SELECT RAISE(ABORT,'fixture'); END")
    const draft = f.store.getDraft(f.playbook.id)
    fails('database-error', () => f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: draft.sequence, changes: [{ kind: 'set', key: 'a', value: 3 }, { kind: 'set', key: 'fail', value: true }] }))
    expect(f.store.getDraft(f.playbook.id)).toEqual(draft)
    expect(f.store.readEntry({ kind: 'draft', playbookId: f.playbook.id }, 'a').entry).toEqual({ exists: true, value: 1 })
    raw.exec("CREATE TRIGGER fail_revision BEFORE INSERT ON revision_entries WHEN NEW.key='z' BEGIN SELECT RAISE(ABORT,'fixture'); END")
    fails('database-error', () => f.commit())
    expect(raw.prepare('SELECT COUNT(*) AS n FROM revisions').get()).toMatchObject({ n: 0 })
    expect(raw.prepare('SELECT COUNT(*) AS n FROM revision_entries').get()).toMatchObject({ n: 0 })
    expect(f.store.listRevisions(f.playbook.id).items).toEqual([])
    expect(f.store.getDraft(f.playbook.id)).toEqual(draft)
    raw.exec('DROP TRIGGER fail_revision'); expect(f.commit().entry.ordinal).toBe(1)
  })
  it('rolls back a copy if its publication fails after draft and history insertion', () => {
    const f = fixture(); f.put({ a: 1 }); const first = f.commit()
    f.store.createPublication({ playbookId: f.playbook.id, revisionId: first.revision.id })
    const raw = f.raw(); const playbooks = f.store.listPlaybooks(f.project.id)
    raw.exec("CREATE TRIGGER fail_publication BEFORE INSERT ON publications BEGIN SELECT RAISE(ABORT,'fixture'); END")
    fails('database-error', () => f.store.copyPlaybook({ sourcePlaybookId: f.playbook.id, source: { kind: 'revision', revisionId: first.revision.id }, targetProjectId: f.project.id, name: 'Copy', history: 'copy', publications: 'copy' }))
    expect(f.store.listPlaybooks(f.project.id)).toEqual(playbooks)
    expect(raw.prepare('SELECT COUNT(*) AS n FROM drafts').get()).toMatchObject({ n: 1 })
  })
  it('detects stale writers across independent connections and reports SQLite contention', () => {
    const f = fixture(); const second = new PlaybookStorage({ path: f.path }); cleanups.push(() => second.close())
    const old = second.getDraft(f.playbook.id)
    f.put({ value: 1 })
    fails('conflict', () => second.writeDraft({ playbookId: f.playbook.id, expectedSequence: old.sequence, changes: [] }))
    fails('conflict', () => second.commitRevision({ playbookId: f.playbook.id, expectedSequence: old.sequence, description: '' }))
    fails('conflict', () => second.restoreDraft({ playbookId: f.playbook.id, expectedSequence: old.sequence, revisionId: 'missing' as RevisionId }))
    expect(second.readEntry({ kind: 'draft', playbookId: f.playbook.id }, 'value').entry).toEqual({ exists: true, value: 1 })
    const raw = f.raw(); raw.exec('BEGIN IMMEDIATE')
    try { fails('busy', () => f.put({ value: 2 })) } finally { raw.exec('ROLLBACK') }
    const beforeCommit = f.store.getDraft(f.playbook.id)
    raw.exec('BEGIN'); raw.prepare('SELECT * FROM draft_entries').all()
    try { fails('busy', () => f.put({ value: 2 })) } finally { raw.exec('ROLLBACK') }
    expect(f.store.getDraft(f.playbook.id)).toEqual(beforeCommit)
    expect(second.readEntry({ kind: 'draft', playbookId: f.playbook.id }, 'value').entry).toEqual({ exists: true, value: 1 })
    f.put({ value: 3 })
    expect(second.readEntry({ kind: 'draft', playbookId: f.playbook.id }, 'value').entry).toEqual({ exists: true, value: 3 })
  })
  it('reopens durable data and refuses foreign, changed or damaged formats without replacement', () => {
    const f = fixture(); f.put(mixedContent); const revision = f.commit(); f.store.close()
    const reopened = new PlaybookStorage({ path: f.path }); reopened.close()
    const raw = f.raw()
    expect(raw.prepare('PRAGMA application_id').get()).toMatchObject({ application_id: STORAGE_APPLICATION_ID })
    expect(raw.prepare('PRAGMA journal_mode').get()).toMatchObject({ journal_mode: 'delete' })
    expect(raw.prepare('PRAGMA auto_vacuum').get()).toMatchObject({ auto_vacuum: 0 })
    const valid = new PlaybookStorage({ path: f.path }); cleanups.push(() => valid.close())
    expect(Object.fromEntries(valid.readContent({ kind: 'revision', revisionId: revision.revision.id }).content)).toEqual(mixedContent)
    const foreignPath = join(f.directory, 'foreign.sqlite'); const foreign = new DatabaseSync(foreignPath)
    foreign.exec('CREATE TABLE private_data (value TEXT)'); foreign.close()
    const foreignBytes = readFileSync(foreignPath)
    fails('format-mismatch', () => new PlaybookStorage({ path: foreignPath })); expect(readFileSync(foreignPath)).toEqual(foreignBytes)
    const damagedPath = join(f.directory, 'damaged.sqlite'); writeFileSync(damagedPath, 'not a database')
    fails('corrupt', () => new PlaybookStorage({ path: damagedPath })); expect(readFileSync(damagedPath, 'utf8')).toBe('not a database')
    fails('closed', () => f.store.getProject(f.project.id))
  })
  it('rejects incomplete schemas and broken foreign keys', () => {
    const f = fixture(); f.store.close(); const raw = f.raw()
    raw.exec('DROP TABLE publications')
    fails('format-mismatch', () => new PlaybookStorage({ path: f.path }))
    const g = fixture(); g.store.close(); const other = g.raw()
    other.exec('PRAGMA foreign_keys=OFF')
    other.prepare('INSERT INTO revision_entries VALUES (?, ?, ?)').run('missing', 'key', 'null')
    fails('corrupt', () => new PlaybookStorage({ path: g.path }))
  })
  it('rejects missing drafts, orphan revisions and history gaps without repairing them', () => {
    for (const corruption of [
      'DELETE FROM drafts',
      'DELETE FROM playbook_revisions',
      'DELETE FROM playbook_revisions WHERE ordinal=1',
    ]) {
      const f = fixture(); f.commit(); f.commit(); f.store.close()
      const raw = f.raw(); raw.exec(corruption)
      const bytes = readFileSync(f.path)
      fails('corrupt', () => new PlaybookStorage({ path: f.path }))
      expect(readFileSync(f.path)).toEqual(bytes)
    }
  })
  it('recovers committed data and discards an interrupted transaction after process exit', () => {
    const f = fixture(); f.put({ value: 'saved' }); f.commit(); f.store.close()
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      db.exec('BEGIN IMMEDIATE');
      db.prepare('UPDATE draft_entries SET value=?').run(JSON.stringify('uncommitted'));
      process.exit(23);
    `, f.path], { timeout: 10000, encoding: 'utf8' })
    expect(child.error).toBeUndefined(); expect(child.status).toBe(23)
    const reopened = new PlaybookStorage({ path: f.path }); cleanups.push(() => reopened.close())
    expect(reopened.readEntry({ kind: 'draft', playbookId: f.playbook.id }, 'value').entry).toEqual({ exists: true, value: 'saved' })
    expect(reopened.listRevisions(f.playbook.id).items).toHaveLength(1)
  })
  it('unregisters before closing and releases a database after registration failure', async () => {
    const f = fixture(); f.store.close()
    let stored: PlaybookStorage | undefined; let dispose: (() => void | Promise<void>) | undefined
    const host: StorageHost = {
      provide(key, value) { expect(key).toBe(serviceKey); stored = value; return () => { expect(value.listProjects().items).toHaveLength(1); stored = undefined } },
      effect(body) { const owned = [...body()]; dispose = async () => { for (const release of owned.reverse()) await release() } },
    }
    apply(host, { path: f.path }); const handle = stored!
    await dispose!(); expect(stored).toBeUndefined(); fails('closed', () => handle.listProjects())
    let failedHandle: PlaybookStorage | undefined
    expect(() => apply({ effect: body => { const owned: Array<() => void | Promise<void>> = []; try { for (const release of body()) owned.push(release) } catch (error) { for (const release of owned.reverse()) void release(); throw error } }, provide: (_, value) => { failedHandle = value; throw new Error('registration failed') } }, { path: f.path })).toThrow('registration failed')
    fails('closed', () => failedHandle!.listProjects())
  })
})


describe('owner metadata and atomic snapshots', () => {
  it('creates initial values and draft metadata at sequence zero and freezes directory metadata', () => {
    const f = fixture()
    const playbook = f.store.createPlaybook({ projectId: f.project.id, name: 'Initialized', initialContent: new Map([['initial', { ready: true }]]), draftMetadata: { editor: 'local' } })
    const snapshot = f.store.readSnapshot({ kind: 'draft', playbookId: playbook.id })
    expect(snapshot).toMatchObject({ kind: 'draft', ref: { sequence: 0 }, draft: { metadata: { editor: 'local' } } })
    expect(snapshot.content.get('initial')).toEqual({ ready: true })
    const committed = f.store.commitRevision({ playbookId: playbook.id, expectedSequence: 0, description: '', metadata: { commit: true }, historyMetadata: { catalog: true } })
    expect(committed.revision.metadata).toEqual({ commit: true })
    expect(committed.entry.metadata).toEqual({ catalog: true })
    expect(committed.draft.metadata).toEqual({ editor: 'local' })
    expect(f.store.listRevisions(playbook.id).items[0]?.metadata).toEqual({ catalog: true })
    expect(f.store.readSnapshot({ kind: 'revision', revisionId: committed.revision.id })).toMatchObject({ kind: 'revision', revision: { metadata: { commit: true } } })
    const copy = f.store.copyPlaybook({ sourcePlaybookId: playbook.id, source: { kind: 'revision', revisionId: committed.revision.id }, targetProjectId: f.project.id, name: 'History', history: 'copy', publications: 'none' })
    expect(f.store.getDraft(copy.id).metadata).toEqual({})
    expect(f.store.listRevisions(copy.id).items[0]?.metadata).toEqual({ catalog: true })
    const fromDraft = f.store.copyPlaybook({ sourcePlaybookId: playbook.id, source: { kind: 'draft', expectedSequence: 1 }, targetProjectId: f.project.id, name: 'Working', history: 'none', publications: 'none' })
    expect(f.store.getDraft(fromDraft.id).metadata).toEqual({ editor: 'local' })
    const override = f.store.copyPlaybook({ sourcePlaybookId: playbook.id, source: { kind: 'draft', expectedSequence: 1 }, targetProjectId: f.project.id, name: 'Override', history: 'copy', publications: 'none', draftMetadata: { own: true } })
    expect(f.store.getDraft(override.id).metadata).toEqual({ own: true })
  })
  it('replaces draft metadata with CAS and preserves it when restoring content', () => {
    const f = fixture(); f.put({ value: 1 }); const revision = f.commit()
    const draft = f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: revision.draft.sequence, changes: [{ kind: 'set', key: 'value', value: 2 }], metadata: { local: true } })
    expect(draft.metadata).toEqual({ local: true })
    fails('conflict', () => f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: revision.draft.sequence, changes: [], metadata: {} }))
    const restored = f.store.restoreDraft({ playbookId: f.playbook.id, expectedSequence: draft.sequence, revisionId: revision.revision.id })
    expect(restored.metadata).toEqual({ local: true })
    expect(f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: restored.sequence, changes: [], metadata: {} }).metadata).toEqual({})
  })
  it('rolls back initialization and content changes when owner writes fail', () => {
    const f = fixture(), raw = f.raw()
    raw.exec("CREATE TRIGGER reject_initial BEFORE INSERT ON draft_entries WHEN NEW.key='fail' BEGIN SELECT RAISE(ABORT,'fixture'); END")
    fails('database-error', () => f.store.createPlaybook({ projectId: f.project.id, name: 'Failed', draftMetadata: { initialized: true }, initialContent: new Map([['first', 1], ['fail', 2]]) }))
    expect(f.store.listPlaybooks(f.project.id).items).toHaveLength(1)
    expect(raw.prepare('SELECT COUNT(*) AS n FROM drafts').get()).toMatchObject({ n: 1 })
    raw.exec("CREATE TRIGGER reject_metadata BEFORE UPDATE ON drafts BEGIN SELECT RAISE(ABORT,'fixture'); END")
    fails('database-error', () => f.store.writeDraft({ playbookId: f.playbook.id, expectedSequence: 0, metadata: { changed: true }, changes: [{ kind: 'set', key: 'value', value: 1 }] }))
    expect(f.store.getDraft(f.playbook.id)).toMatchObject({ sequence: 0, metadata: {} })
    expect(f.store.readContent({ kind: 'draft', playbookId: f.playbook.id }).content.size).toBe(0)
  })
})

describe('immutable revision attachments', () => {
  it('shares attachment bodies and distinguishes an empty manifest from lost or corrupt data', () => {
    const f = fixture()
    const revision = f.store.commitRevision({ playbookId: f.playbook.id, expectedSequence: 0, description: 'Attached', attachments: [{ key: 'result', value: { opening: 'Hello' }, metadata: { type: 'text' } }] }).revision
    expect(f.store.readRevisionAttachment(revision.id, 'result').value).toEqual({ opening: 'Hello' })
    const db = f.raw()
    db.prepare('UPDATE revision_attachments SET value=? WHERE revision_id=?').run('{}', revision.id)
    fails('corrupt', () => f.store.readRevisionAttachment(revision.id, 'result'))
    db.prepare('DELETE FROM revision_attachments WHERE revision_id=?').run(revision.id)
    expect(f.store.getRevision(revision.id).attachments.items).toHaveLength(1)
    fails('corrupt', () => f.store.readRevisionAttachment(revision.id, 'result'))
    const empty = f.store.commitRevision({ playbookId: f.playbook.id, expectedSequence: 1, description: 'Empty' }).revision
    expect(empty.attachments.items).toEqual([])
    fails('not-found', () => f.store.readRevisionAttachment(empty.id, 'result'))
  })
  it('rolls back source, directory, attachments and draft position on an attachment write failure', () => {
    const f = fixture(), db = f.raw()
    db.exec("CREATE TRIGGER reject_attachment BEFORE INSERT ON revision_attachments BEGIN SELECT RAISE(ABORT, 'injected'); END")
    expect(() => f.store.commitRevision({ playbookId: f.playbook.id, expectedSequence: 0, description: 'Failed', attachments: [{ key: 'result', value: 'Hello' }] })).toThrow()
    expect(f.store.getDraft(f.playbook.id).sequence).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM revisions').get()).toMatchObject({ n: 0 })
    expect(f.store.listRevisions(f.playbook.id).items).toEqual([])
  })
})

it('shares attached revision bodies until their final directory reference is removed', () => {
  const f = fixture()
  const revision = f.store.commitRevision({ playbookId: f.playbook.id, expectedSequence: 0, description: 'Shared', attachments: [{ key: 'opening', value: 'Text' }] }).revision
  const copy = f.store.copyPlaybook({ sourcePlaybookId: f.playbook.id, source: { kind: 'revision', revisionId: revision.id }, targetProjectId: f.project.id, name: 'Copy', history: 'copy', publications: 'none' })
  const raw = f.raw()
  expect(raw.prepare('SELECT count(*) AS n FROM revision_attachments').get()).toMatchObject({ n: 1 })
  f.store.deletePlaybook(f.playbook.id)
  expect(f.store.readRevisionAttachment(revision.id, 'opening').value).toBe('Text')
  f.store.deletePlaybook(copy.id)
  expect(raw.prepare('SELECT count(*) AS n FROM revision_attachments').get()).toMatchObject({ n: 0 })
})
