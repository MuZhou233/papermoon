/** Project and script ownership, immutable revisions and SQL-side content comparison. */
import { randomUUID } from 'node:crypto'
import type { SQLInputValue } from 'node:sqlite'
import { Connection } from './database.ts'
import { databaseError, invalid, StorageError } from './error.ts'
import { decode, decodeObject, encode, metadata, name, sequence, text } from './json.ts'
import type {
  CommitInput, CommitResult, ContentRead, ContentRef, CopyInput, Difference, DifferencePage, Draft,
  DraftWrite, EntryPage, EntryRead, HistoryEntry, JsonObject, KeyOptions, NamedInput, NamedUpdate,
  Page, PageOptions, Project, ProjectId, Publication, PublicationId, ResolvedRef, Revision, RevisionId, Script, ScriptId,
} from './types.ts'

type NamedRow = { id: string; name: string; metadata: string; created_at: string }
type ScriptRow = NamedRow & { project_id: ProjectId; origin: string | null }
type DraftRow = { script_id: ScriptId; sequence: number; base_revision_id: RevisionId | null }
type RevisionRow = { id: RevisionId; description: string; metadata: string; source: string; references_json: string; created_at: string }
type PublicationRow = { id: PublicationId; script_id: ScriptId; revision_id: RevisionId; metadata: string; created_at: string }
type EntryRow = { key: string; value: string }
const now = (): string => new Date().toISOString()
const projectFrom = (row: NamedRow): Project => ({ id: row.id as ProjectId, name: row.name, metadata: decodeObject(row.metadata), createdAt: row.created_at })
const scriptFrom = (row: ScriptRow): Script => ({ id: row.id as ScriptId, projectId: row.project_id as ProjectId, name: row.name, metadata: decodeObject(row.metadata), origin: row.origin === null ? null : decodeObject(row.origin), createdAt: row.created_at })
const draftFrom = (row: DraftRow): Draft => ({ scriptId: row.script_id, sequence: row.sequence, baseRevisionId: row.base_revision_id })
const revisionFrom = (row: RevisionRow): Revision => {
  const source = decodeObject(row.source)
  const references = decode(row.references_json)
  if (typeof source.projectId !== 'string' || typeof source.projectName !== 'string' || typeof source.scriptId !== 'string' || typeof source.scriptName !== 'string' ||
      !Number.isSafeInteger(source.draftSequence) || Number(source.draftSequence) < 0 || (source.baseRevisionId !== null && typeof source.baseRevisionId !== 'string') ||
      !Array.isArray(references) || references.some(value => typeof value !== 'string')) throw new StorageError('corrupt', 'invalid stored revision provenance')
  return { id: row.id, description: row.description, metadata: decodeObject(row.metadata), source: source as unknown as Revision['source'], references: references as RevisionId[], createdAt: row.created_at }
}
const publicationFrom = (row: PublicationRow): Publication => ({ id: row.id, scriptId: row.script_id, revisionId: row.revision_id, metadata: decodeObject(row.metadata), createdAt: row.created_at })
function requireRow<T>(row: T | undefined, entity: string): T {
  if (row === undefined) throw new StorageError('not-found', `${entity} does not exist`)
  return row
}
function pageSize(value: number | undefined): number {
  const result = value ?? 100
  if (!Number.isSafeInteger(result) || result < 1 || result > 1000) invalid('page limit must be an integer from 1 to 1000')
  return result
}
function page<T, Cursor>(rows: T[], limit: number, cursor: (row: T) => Cursor): Page<T, Cursor> {
  const more = rows.length > limit
  const items = more ? rows.slice(0, limit) : rows
  return { items, ...(more ? { next: cursor(items.at(-1)!) } : {}) }
}
function afterId(options: PageOptions): string | null {
  if (options.after !== undefined) text(options.after, 'after')
  return options.after ?? null
}
function keyQuery(options: KeyOptions): { sql: string; params: SQLInputValue[]; limit: number } {
  for (const field of ['after', 'lower', 'upper'] as const) if (options[field] !== undefined) text(options[field], field)
  const limit = pageSize(options.limit)
  return {
    sql: '(? IS NULL OR key > ?) AND (? IS NULL OR key >= ?) AND (? IS NULL OR key < ?)',
    params: [options.after ?? null, options.after ?? null, options.lower ?? null, options.lower ?? null, options.upper ?? null, options.upper ?? null],
    limit,
  }
}

/** All methods finish synchronously. Writes are atomic; read results do not alias stored state. */
export class StoryStorage {
  private readonly db: Connection
  constructor(config: { path: string }) {
    try { this.db = new Connection(config.path) } catch (error) { throw databaseError(error) }
  }
  /** Idempotently release the connection. Further operations throw closed. */
  close(): void { this.db.close() }

  createProject(input: NamedInput): Project {
    name(input.name)
    const body = metadata(input.metadata)
    return this.db.transaction(true, () => {
      const id = randomUUID() as ProjectId
      this.db.run('INSERT INTO projects VALUES (?, ?, ?, ?)', id, input.name, body, now())
      return this.project(id)
    })
  }
  getProject(id: ProjectId): Project { return this.db.transaction(false, () => this.project(id)) }
  /** ID order is stable across renames. Pagination does not promise a frozen catalog across calls. */
  listProjects(options: PageOptions = {}): Page<Project> {
    const limit = pageSize(options.limit); const after = afterId(options)
    return this.db.transaction(false, () => page(this.db.all<NamedRow>('SELECT * FROM projects WHERE (? IS NULL OR id > ?) ORDER BY id LIMIT ?', after, after, limit + 1).map(projectFrom), limit, row => row.id))
  }
  updateProject(id: ProjectId, input: NamedUpdate): Project {
    if (input.name !== undefined) name(input.name)
    const body = input.metadata === undefined ? undefined : metadata(input.metadata)
    return this.db.transaction(true, () => {
      this.project(id)
      if (input.name !== undefined) this.db.run('UPDATE projects SET name = ? WHERE id = ?', input.name, id)
      if (body !== undefined) this.db.run('UPDATE projects SET metadata = ? WHERE id = ?', body, id)
      return this.project(id)
    })
  }
  deleteProject(id: ProjectId): void {
    this.db.transaction(true, () => {
      this.project(id)
      this.db.run('DELETE FROM projects WHERE id = ?', id)
      this.collectUnreferencedRevisions()
    })
  }
  createScript(input: NamedInput & { projectId: ProjectId }): Script {
    name(input.name)
    const body = metadata(input.metadata)
    return this.db.transaction(true, () => this.insertScript(input.projectId, input.name, body, null))
  }
  getScript(id: ScriptId): Script { return this.db.transaction(false, () => this.script(id)) }
  listScripts(projectId: ProjectId, options: PageOptions = {}): Page<Script> {
    const limit = pageSize(options.limit); const after = afterId(options)
    return this.db.transaction(false, () => {
      this.project(projectId)
      return page(this.db.all<ScriptRow>('SELECT * FROM scripts WHERE project_id = ? AND (? IS NULL OR id > ?) ORDER BY id LIMIT ?', projectId, after, after, limit + 1).map(scriptFrom), limit, row => row.id)
    })
  }
  updateScript(id: ScriptId, input: NamedUpdate): Script {
    if (input.name !== undefined) name(input.name)
    const body = input.metadata === undefined ? undefined : metadata(input.metadata)
    return this.db.transaction(true, () => {
      this.script(id)
      if (input.name !== undefined) this.db.run('UPDATE scripts SET name = ? WHERE id = ?', input.name, id)
      if (body !== undefined) this.db.run('UPDATE scripts SET metadata = ? WHERE id = ?', body, id)
      return this.script(id)
    })
  }
  deleteScript(id: ScriptId): void {
    this.db.transaction(true, () => {
      this.script(id)
      this.db.run('DELETE FROM scripts WHERE id = ?', id)
      this.collectUnreferencedRevisions()
    })
  }

  getDraft(scriptId: ScriptId): Draft { return this.db.transaction(false, () => this.draft(scriptId)) }
  /** Mutations run in order; an accepted batch, including an empty batch, advances sequence once. */
  writeDraft(input: DraftWrite): Draft {
    sequence(input.expectedSequence)
    const changes = input.changes.map(change => {
      text(change.key, 'key')
      switch (change.kind) {
        case 'set': return { key: change.key, value: encode(change.value) }
        case 'delete': return { key: change.key, value: undefined }
        default: return invalid('unknown draft mutation')
      }
    })
    return this.db.transaction(true, () => {
      this.checkDraft(input.scriptId, input.expectedSequence)
      for (const change of changes) {
        if (change.value === undefined) this.db.run('DELETE FROM draft_entries WHERE script_id = ? AND key = ?', input.scriptId, change.key)
        else this.db.run('INSERT INTO draft_entries VALUES (?, ?, ?) ON CONFLICT(script_id, key) DO UPDATE SET value=excluded.value', input.scriptId, change.key, change.value)
      }
      this.advanceDraft(input.scriptId)
      return this.draft(input.scriptId)
    })
  }
  /** Replace draft values from a retained revision without changing history membership. */
  restoreDraft(input: { scriptId: ScriptId; expectedSequence: number; revisionId: RevisionId }): Draft {
    sequence(input.expectedSequence)
    return this.db.transaction(true, () => {
      this.checkDraft(input.scriptId, input.expectedSequence)
      this.revision(input.revisionId)
      this.db.run('DELETE FROM draft_entries WHERE script_id = ?', input.scriptId)
      this.db.run('INSERT INTO draft_entries SELECT ?, key, value FROM revision_entries WHERE revision_id = ?', input.scriptId, input.revisionId)
      this.advanceDraft(input.scriptId, input.revisionId)
      return this.draft(input.scriptId)
    })
  }
  /** Copy the complete draft into a new immutable revision; identical independent commits remain distinct. */
  commitRevision(input: CommitInput): CommitResult {
    sequence(input.expectedSequence); text(input.description, 'description')
    const body = metadata(input.metadata)
    const references = input.references ?? []
    for (const reference of references) text(reference, 'reference')
    const referenceJson = encode(references)
    return this.db.transaction(true, () => {
      const draft = this.checkDraft(input.scriptId, input.expectedSequence)
      const script = this.script(input.scriptId); const project = this.project(script.projectId)
      const id = randomUUID() as RevisionId
      const source = encode({ projectId: project.id, projectName: project.name, scriptId: script.id, scriptName: script.name, draftSequence: draft.sequence, baseRevisionId: draft.baseRevisionId })
      this.db.run('INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?)', id, input.description, body, source, referenceJson, now())
      this.db.run('INSERT INTO revision_entries SELECT ?, key, value FROM draft_entries WHERE script_id = ?', id, script.id)
      const ordinal = this.db.get<{ordinal: number}>('SELECT COALESCE(MAX(ordinal), 0) + 1 AS ordinal FROM script_revisions WHERE script_id = ?', script.id)!.ordinal
      sequence(ordinal)
      this.db.run('INSERT INTO script_revisions VALUES (?, ?, ?)', script.id, ordinal, id)
      this.advanceDraft(script.id, id)
      const revision = this.revision(id)
      return { revision, entry: { scriptId: script.id, ordinal, revision }, draft: this.draft(script.id) }
    })
  }
  getRevision(id: RevisionId): Revision { return this.db.transaction(false, () => this.revision(id)) }
  listRevisions(scriptId: ScriptId, options: PageOptions<number> = {}): Page<HistoryEntry, number> {
    const limit = pageSize(options.limit); const after = options.after ?? 0; sequence(after)
    return this.db.transaction(false, () => {
      this.script(scriptId)
      const rows = this.db.all<RevisionRow & {ordinal: number}>('SELECT r.*, h.ordinal FROM script_revisions h JOIN revisions r ON r.id=h.revision_id WHERE h.script_id=? AND h.ordinal>? ORDER BY h.ordinal LIMIT ?', scriptId, after, limit + 1)
      return page(rows.map(row => ({ scriptId, ordinal: row.ordinal, revision: revisionFrom(row) })), limit, row => row.ordinal)
    })
  }

  copyScript(input: CopyInput): Script {
    name(input.name)
    if (!['copy', 'none'].includes(input.history) || !['copy', 'none'].includes(input.publications)) invalid('copy scopes must be explicit')
    if (input.publications === 'copy' && input.history === 'none') invalid('publications require copied history')
    const body = input.metadata === undefined ? undefined : metadata(input.metadata)
    if (input.source.kind === 'draft') sequence(input.source.expectedSequence)
    else if (input.source.kind !== 'revision') invalid('unknown copy source')
    return this.db.transaction(true, () => {
      const source = this.script(input.sourceScriptId)
      let base: RevisionId | null; let lastOrdinal: number; let valuesSql: string; let valueOwner: string
      let draftSequence: number | null = null
      if (input.source.kind === 'draft') {
        const draft = this.checkDraft(source.id, input.source.expectedSequence)
        base = draft.baseRevisionId; draftSequence = draft.sequence
        lastOrdinal = this.db.get<{n: number}>('SELECT COALESCE(MAX(ordinal), 0) AS n FROM script_revisions WHERE script_id=?', source.id)!.n
        valuesSql = 'SELECT key, value FROM draft_entries WHERE script_id=?'; valueOwner = source.id
      } else {
        const membership = this.membership(source.id, input.source.revisionId)
        base = input.source.revisionId; lastOrdinal = membership.ordinal
        valuesSql = 'SELECT key, value FROM revision_entries WHERE revision_id=?'; valueOwner = input.source.revisionId
      }
      const target = this.insertScript(input.targetProjectId, input.name, body ?? metadata(source.metadata), encode({ projectId: source.projectId, scriptId: source.id, scriptName: source.name, kind: input.source.kind, revisionId: base, draftSequence }))
      this.db.run(`INSERT INTO draft_entries SELECT ?, key, value FROM (${valuesSql})`, target.id, valueOwner)
      this.db.run('UPDATE drafts SET base_revision_id=? WHERE script_id=?', base, target.id)
      if (input.history === 'copy') this.db.run('INSERT INTO script_revisions SELECT ?, ordinal, revision_id FROM script_revisions WHERE script_id=? AND ordinal<=?', target.id, source.id, lastOrdinal)
      if (input.publications === 'copy') {
        const rows = this.db.all<PublicationRow>('SELECT p.* FROM publications p JOIN script_revisions h ON h.script_id=p.script_id AND h.revision_id=p.revision_id WHERE p.script_id=? AND h.ordinal<=? ORDER BY p.id', source.id, lastOrdinal)
        for (const row of rows) this.db.run('INSERT INTO publications VALUES (?, ?, ?, ?, ?)', randomUUID(), target.id, row.revision_id, row.metadata, row.created_at)
      }
      return this.script(target.id)
    })
  }

  createPublication(input: { scriptId: ScriptId; revisionId: RevisionId; metadata?: JsonObject }): Publication {
    const body = metadata(input.metadata)
    return this.db.transaction(true, () => {
      this.membership(input.scriptId, input.revisionId)
      const id = randomUUID() as PublicationId
      this.db.run('INSERT INTO publications VALUES (?, ?, ?, ?, ?)', id, input.scriptId, input.revisionId, body, now())
      return this.publication(id)
    })
  }
  getPublication(id: PublicationId): Publication { return this.db.transaction(false, () => this.publication(id)) }
  listPublications(filter: { scriptId?: ScriptId; revisionId?: RevisionId }, options: PageOptions = {}): Page<Publication> {
    const limit = pageSize(options.limit); const after = afterId(options)
    return this.db.transaction(false, () => {
      if (filter.scriptId !== undefined) this.script(filter.scriptId)
      if (filter.revisionId !== undefined) this.revision(filter.revisionId)
      const rows = this.db.all<PublicationRow>('SELECT * FROM publications WHERE (? IS NULL OR script_id=?) AND (? IS NULL OR revision_id=?) AND (? IS NULL OR id>?) ORDER BY id LIMIT ?', filter.scriptId ?? null, filter.scriptId ?? null, filter.revisionId ?? null, filter.revisionId ?? null, after, after, limit + 1)
      return page(rows.map(publicationFrom), limit, row => row.id)
    })
  }

  readContent(input: ContentRef): ContentRead {
    return this.db.transaction(false, () => {
      const ref = this.resolveRef(input); const source = this.contentSource(ref)
      const rows = this.db.all<EntryRow>(`SELECT key, value FROM ${source.table} WHERE ${source.owner}=? ORDER BY key`, source.id)
      return { ref, content: new Map(rows.map(row => [row.key, decode(row.value)])) }
    })
  }
  readEntry(input: ContentRef, key: string): EntryRead {
    text(key, 'key')
    return this.db.transaction(false, () => {
      const ref = this.resolveRef(input); const source = this.contentSource(ref)
      const row = this.db.get<{value: string}>(`SELECT value FROM ${source.table} WHERE ${source.owner}=? AND key=?`, source.id, key)
      return { ref, entry: row ? { exists: true, value: decode(row.value) } : { exists: false } }
    })
  }
  listEntries(input: ContentRef, options: KeyOptions = {}): EntryPage {
    const query = keyQuery(options)
    return this.db.transaction(false, () => {
      const ref = this.resolveRef(input, options.after !== undefined); const source = this.contentSource(ref)
      const rows = this.db.all<EntryRow>(`SELECT key, value FROM ${source.table} WHERE ${source.owner}=? AND ${query.sql} ORDER BY key LIMIT ?`, source.id, ...query.params, query.limit + 1)
      return { ref, ...page(rows.map(row => ({ key: row.key, value: decode(row.value) })), query.limit, row => row.key) }
    })
  }
  /** Compare exact KV values in one read transaction. Reuse returned refs to pin further pages/details. */
  compare(leftInput: ContentRef, rightInput: ContentRef, options: KeyOptions = {}): DifferencePage {
    const query = keyQuery(options)
    return this.db.transaction(false, () => {
      const left = this.resolveRef(leftInput, options.after !== undefined); const right = this.resolveRef(rightInput, options.after !== undefined)
      if (left.kind === 'revision' && right.kind === 'revision' && left.revisionId === right.revisionId) return { left, right, items: [] }
      const a = this.contentSource(left); const b = this.contentSource(right)
      const rows = this.db.all<{key: string; before_value: string | null; after_value: string | null}>(`
        WITH a AS (SELECT key, value FROM ${a.table} WHERE ${a.owner}=? AND ${query.sql}),
             b AS (SELECT key, value FROM ${b.table} WHERE ${b.owner}=? AND ${query.sql})
        SELECT COALESCE(a.key,b.key) AS key, a.value AS before_value, b.value AS after_value
          FROM a FULL OUTER JOIN b ON a.key=b.key
         WHERE a.key IS NULL OR b.key IS NULL OR a.value<>b.value
         ORDER BY key LIMIT ?`, a.id, ...query.params, b.id, ...query.params, query.limit + 1)
      const changes: Difference[] = rows.map(row => ({
        key: row.key,
        kind: row.before_value === null ? 'added' : row.after_value === null ? 'removed' : 'modified',
        before: row.before_value === null ? { exists: false } : { exists: true, value: decode(row.before_value) },
        after: row.after_value === null ? { exists: false } : { exists: true, value: decode(row.after_value) },
      }))
      return { left, right, ...page(changes, query.limit, row => row.key) }
    })
  }

  private project(id: ProjectId): Project { text(id, 'project ID'); return projectFrom(requireRow(this.db.get<NamedRow>('SELECT * FROM projects WHERE id=?', id), 'project')) }
  private script(id: ScriptId): Script { text(id, 'script ID'); return scriptFrom(requireRow(this.db.get<ScriptRow>('SELECT * FROM scripts WHERE id=?', id), 'script')) }
  private revision(id: RevisionId): Revision { text(id, 'revision ID'); return revisionFrom(requireRow(this.db.get<RevisionRow>('SELECT * FROM revisions WHERE id=?', id), 'revision')) }
  private publication(id: PublicationId): Publication { text(id, 'publication ID'); return publicationFrom(requireRow(this.db.get<PublicationRow>('SELECT * FROM publications WHERE id=?', id), 'publication')) }
  private draft(id: ScriptId): Draft { text(id, 'script ID'); return draftFrom(requireRow(this.db.get<DraftRow>('SELECT * FROM drafts WHERE script_id=?', id), 'draft')) }
  private checkDraft(id: ScriptId, expected: number): Draft {
    const draft = this.draft(id)
    if (draft.sequence !== expected) throw new StorageError('conflict', `draft sequence changed: expected ${expected}, found ${draft.sequence}`)
    return draft
  }
  private advanceDraft(id: ScriptId, base?: RevisionId): void {
    const current = this.draft(id)
    sequence(current.sequence + 1)
    this.db.run('UPDATE drafts SET sequence=sequence+1, base_revision_id=? WHERE script_id=?', base ?? current.baseRevisionId, id)
  }
  private membership(scriptId: ScriptId, revisionId: RevisionId): {ordinal: number} {
    text(scriptId, 'script ID'); text(revisionId, 'revision ID')
    return requireRow(this.db.get<{ordinal: number}>('SELECT ordinal FROM script_revisions WHERE script_id=? AND revision_id=?', scriptId, revisionId), 'script revision')
  }
  private insertScript(projectId: ProjectId, scriptName: string, body: string, origin: string | null): Script {
    this.project(projectId)
    const id = randomUUID() as ScriptId
    this.db.run('INSERT INTO scripts VALUES (?, ?, ?, ?, ?, ?)', id, projectId, scriptName, body, origin, now())
    this.db.run('INSERT INTO drafts VALUES (?, 0, NULL)', id)
    return this.script(id)
  }
  private collectUnreferencedRevisions(): void {
    this.db.run('DELETE FROM revisions WHERE NOT EXISTS (SELECT 1 FROM script_revisions h WHERE h.revision_id=revisions.id)')
  }
  private resolveRef(ref: ContentRef, continuing = false): ResolvedRef {
    if (ref.kind === 'revision') { this.revision(ref.revisionId); return { kind: 'revision', revisionId: ref.revisionId } }
    if (ref.kind !== 'draft') invalid('unknown content reference')
    if (continuing && ref.sequence === undefined) invalid('draft pagination requires the sequence returned by the first page')
    if (ref.sequence !== undefined) sequence(ref.sequence)
    const draft = ref.sequence === undefined ? this.draft(ref.scriptId) : this.checkDraft(ref.scriptId, ref.sequence)
    return { kind: 'draft', scriptId: ref.scriptId, sequence: draft.sequence }
  }
  private contentSource(ref: ResolvedRef): { table: string; owner: string; id: string } {
    return ref.kind === 'draft' ? { table: 'draft_entries', owner: 'script_id', id: ref.scriptId } : { table: 'revision_entries', owner: 'revision_id', id: ref.revisionId }
  }
}
