/** Project and playbook ownership, immutable revisions and SQL-side content comparison. */
import { randomUUID, createHash } from 'node:crypto'
import type { SQLInputValue } from 'node:sqlite'
import { Connection } from './database.ts'
import { databaseError, invalid, StorageError } from './error.ts'
import { decode, decodeObject, encode, metadata, name, sequence, text } from './json.ts'
import type {
  RevisionAttachment, RevisionAttachments, PlaybookQuery, PlaybookSummary, HistoryOptions, CommitInput, CommitResult, CreatePlaybookInput, SnapshotRead, ContentRead, ContentRef, CopyInput, Difference, DifferencePage, Draft,
  DraftWrite, EntryPage, EntryRead, HistoryEntry, JsonObject, KeyOptions, NamedInput, NamedUpdate,
  Page, PageOptions, Project, ProjectId, Publication, PublicationId, ResolvedRef, Revision, RevisionId, Playbook, PlaybookId,
} from './types.ts'

type NamedRow = { id: string; name: string; metadata: string; created_at: string }
type PlaybookRow = NamedRow & { project_id: ProjectId; origin: string | null }
type DraftRow = { playbook_id: PlaybookId; sequence: number; base_revision_id: RevisionId | null; metadata: string }
type RevisionRow = { id: RevisionId; description: string; metadata: string; source: string; references_json: string; attachments: string; created_at: string }
type PublicationRow = { id: PublicationId; playbook_id: PlaybookId; revision_id: RevisionId; metadata: string; created_at: string }
type EntryRow = { key: string; value: string }
const now = (): string => new Date().toISOString()
const projectFrom = (row: NamedRow): Project => ({ id: row.id as ProjectId, name: row.name, metadata: decodeObject(row.metadata), createdAt: row.created_at })
const playbookFrom = (row: PlaybookRow): Playbook => ({ id: row.id as PlaybookId, projectId: row.project_id as ProjectId, name: row.name, metadata: decodeObject(row.metadata), origin: row.origin === null ? null : decodeObject(row.origin), createdAt: row.created_at })
const draftFrom = (row: DraftRow): Draft => ({ playbookId: row.playbook_id, sequence: row.sequence, baseRevisionId: row.base_revision_id, metadata: decodeObject(row.metadata) })
const revisionFrom = (row: RevisionRow): Revision => {
  const source = decodeObject(row.source)
  const references = decode(row.references_json)
  if (typeof source.projectId !== 'string' || typeof source.projectName !== 'string' || typeof source.playbookId !== 'string' || typeof source.playbookName !== 'string' ||
      !Number.isSafeInteger(source.draftSequence) || Number(source.draftSequence) < 0 || (source.baseRevisionId !== null && typeof source.baseRevisionId !== 'string') ||
      !Array.isArray(references) || references.some(value => typeof value !== 'string')) throw new StorageError('corrupt', 'invalid stored revision provenance')
  return { id: row.id, description: row.description, metadata: decodeObject(row.metadata), source: source as unknown as Revision['source'], references: references as RevisionId[], createdAt: row.created_at, attachments: attachmentManifest(row.attachments) }
}
function attachmentManifest(raw: string): RevisionAttachments {
  const parsed = decodeObject(raw)
  const items = parsed.items
  if (!parsed.metadata || typeof parsed.metadata !== 'object' || Array.isArray(parsed.metadata) || !Array.isArray(items))
    throw new StorageError('corrupt', 'invalid revision attachment manifest')
  const keys = new Set<string>()
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.key !== 'string' || !item.key ||
        typeof item.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(item.checksum) ||
        !item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata) || keys.has(item.key))
      throw new StorageError('corrupt', 'invalid revision attachment entry')
    keys.add(item.key)
  }
  return parsed as unknown as RevisionAttachments
}
const checksum = (value: string) => createHash('sha256').update(value).digest('hex')
const publicationFrom = (row: PublicationRow): Publication => ({ id: row.id, playbookId: row.playbook_id, revisionId: row.revision_id, metadata: decodeObject(row.metadata), createdAt: row.created_at })
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
export class PlaybookStorage {
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
  createPlaybook(input: CreatePlaybookInput): Playbook {
    name(input.name)
    const body = metadata(input.metadata)
    const draftBody = metadata(input.draftMetadata)
    const entries = [...(input.initialContent ?? [])].map(([key, value]) => { text(key, 'key'); return [key, encode(value)] as const })
    return this.db.transaction(true, () => {
      const playbook = this.insertPlaybook(input.projectId, input.name, body, null, draftBody)
      for (const [key, value] of entries) this.db.run('INSERT INTO draft_entries VALUES (?, ?, ?)', playbook.id, key, value)
      return playbook
    })
  }
  getPlaybook(id: PlaybookId): Playbook { return this.db.transaction(false, () => this.playbook(id)) }
  listPlaybooks(projectId: ProjectId, options: PageOptions = {}): Page<Playbook> {
    const limit = pageSize(options.limit); const after = afterId(options)
    return this.db.transaction(false, () => {
      this.project(projectId)
      return page(this.db.all<PlaybookRow>('SELECT * FROM playbooks WHERE project_id = ? AND (? IS NULL OR id > ?) ORDER BY id LIMIT ?', projectId, after, after, limit + 1).map(playbookFrom), limit, row => row.id)
    })
  }
  queryPlaybooks(options: PlaybookQuery = {}): Page<PlaybookSummary> {
    const limit = pageSize(options.limit), after = afterId(options)
    if (options.query !== undefined) text(options.query, 'query')
    return this.db.transaction(false, () => {
      const rows = this.db.all<PlaybookRow & { project_name: string; latest_ordinal: number }>(`
        SELECT s.*, p.name AS project_name,
          COALESCE((SELECT MAX(ordinal) FROM playbook_revisions WHERE playbook_id=s.id),0) AS latest_ordinal
        FROM playbooks s JOIN projects p ON p.id=s.project_id
        WHERE (? IS NULL OR s.project_id=?) AND (? IS NULL OR s.id>?)
          AND instr(lower(s.name),lower(?))>0
        ORDER BY s.id LIMIT ?`, options.projectId ?? null, options.projectId ?? null,
        after, after, options.query ?? '', limit+1)
      return page(rows.map(row => ({ ...playbookFrom(row), projectName: row.project_name, latestOrdinal: row.latest_ordinal })), limit, row => row.id)
    })
  }
  updateScript(id: PlaybookId, input: NamedUpdate): Playbook {
    if (input.name !== undefined) name(input.name)
    const body = input.metadata === undefined ? undefined : metadata(input.metadata)
    return this.db.transaction(true, () => {
      this.playbook(id)
      if (input.name !== undefined) this.db.run('UPDATE playbooks SET name = ? WHERE id = ?', input.name, id)
      if (body !== undefined) this.db.run('UPDATE playbooks SET metadata = ? WHERE id = ?', body, id)
      return this.playbook(id)
    })
  }
  deletePlaybook(id: PlaybookId): void {
    this.db.transaction(true, () => {
      this.playbook(id)
      this.db.run('DELETE FROM playbooks WHERE id = ?', id)
      this.collectUnreferencedRevisions()
    })
  }

  getDraft(playbookId: PlaybookId): Draft { return this.db.transaction(false, () => this.draft(playbookId)) }
  /** Mutations run in order; an accepted batch, including an empty batch, advances sequence once. */
  writeDraft(input: DraftWrite): Draft {
    sequence(input.expectedSequence)
    const draftBody = input.metadata === undefined ? undefined : metadata(input.metadata)
    const changes = input.changes.map(change => {
      text(change.key, 'key')
      switch (change.kind) {
        case 'set': return { key: change.key, value: encode(change.value) }
        case 'delete': return { key: change.key, value: undefined }
        default: return invalid('unknown draft mutation')
      }
    })
    return this.db.transaction(true, () => {
      this.checkDraft(input.playbookId, input.expectedSequence)
      for (const change of changes) {
        if (change.value === undefined) this.db.run('DELETE FROM draft_entries WHERE playbook_id = ? AND key = ?', input.playbookId, change.key)
        else this.db.run('INSERT INTO draft_entries VALUES (?, ?, ?) ON CONFLICT(playbook_id, key) DO UPDATE SET value=excluded.value', input.playbookId, change.key, change.value)
      }
      if (draftBody !== undefined) this.db.run('UPDATE drafts SET metadata=? WHERE playbook_id=?', draftBody, input.playbookId)
      this.advanceDraft(input.playbookId)
      return this.draft(input.playbookId)
    })
  }
  /** Replace draft values from a retained revision without changing history membership. */
  restoreDraft(input: { playbookId: PlaybookId; expectedSequence: number; revisionId: RevisionId }): Draft {
    sequence(input.expectedSequence)
    return this.db.transaction(true, () => {
      this.checkDraft(input.playbookId, input.expectedSequence)
      this.revision(input.revisionId)
      this.db.run('DELETE FROM draft_entries WHERE playbook_id = ?', input.playbookId)
      this.db.run('INSERT INTO draft_entries SELECT ?, key, value FROM revision_entries WHERE revision_id = ?', input.playbookId, input.revisionId)
      this.advanceDraft(input.playbookId, input.revisionId)
      return this.draft(input.playbookId)
    })
  }
  /** Copy the complete draft into a new immutable revision; identical independent commits remain distinct. */
  commitRevision(input: CommitInput): CommitResult {
    sequence(input.expectedSequence); text(input.description, 'description')
    const body = metadata(input.metadata)
    const historyBody = metadata(input.historyMetadata)
    const references = input.references ?? []
    for (const reference of references) text(reference, 'reference')
    const referenceJson = encode(references)
    const keys = new Set<string>()
    const attachments = (input.attachments ?? []).map(item => {
      text(item.key, 'attachment key')
      if (keys.has(item.key)) invalid('duplicate attachment key')
      keys.add(item.key)
      const itemMetadata = decodeObject(metadata(item.metadata))
      const value = encode({ metadata: itemMetadata, value: item.value })
      return { key: item.key, checksum: checksum(value), metadata: itemMetadata, value }
    })
    const manifest = encode({ metadata: decodeObject(metadata(input.attachmentMetadata)), items: attachments.map(({ value: _value, ...item }) => item) })
    return this.db.transaction(true, () => {
      const draft = this.checkDraft(input.playbookId, input.expectedSequence)
      const playbook = this.playbook(input.playbookId); const project = this.project(playbook.projectId)
      const id = randomUUID() as RevisionId
      const source = encode({ projectId: project.id, projectName: project.name, playbookId: playbook.id, playbookName: playbook.name, draftSequence: draft.sequence, baseRevisionId: draft.baseRevisionId })
      this.db.run('INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?, ?)', id, input.description, body, source, referenceJson, manifest, now())
      for (const item of attachments) this.db.run('INSERT INTO revision_attachments VALUES (?, ?, ?)', id, item.key, item.value)
      this.db.run('INSERT INTO revision_entries SELECT ?, key, value FROM draft_entries WHERE playbook_id = ?', id, playbook.id)
      const ordinal = this.db.get<{ordinal: number}>('SELECT COALESCE(MAX(ordinal), 0) + 1 AS ordinal FROM playbook_revisions WHERE playbook_id = ?', playbook.id)!.ordinal
      sequence(ordinal)
      this.db.run('INSERT INTO playbook_revisions VALUES (?, ?, ?, ?)', playbook.id, ordinal, id, historyBody)
      this.advanceDraft(playbook.id, id)
      const revision = this.revision(id)
      return { revision, entry: { playbookId: playbook.id, ordinal, revision, metadata: decodeObject(historyBody) }, draft: this.draft(playbook.id) }
    })
  }
  /** Read the immutable body named by the manifest; an absent body is corruption, not an empty revision. */
  readRevisionAttachment(id: RevisionId, key: string): RevisionAttachment {
    return this.db.transaction(false, () => {
      const revision = this.revision(id)
      const info = revision.attachments.items.find(item => item.key === key)
      if (!info) throw new StorageError('not-found', 'attachment is not in the revision manifest')
      const row = this.db.get<{value: string}>('SELECT value FROM revision_attachments WHERE revision_id=? AND key=?', id, key)
      if (!row || checksum(row.value) !== info.checksum) throw new StorageError('corrupt', 'revision attachment is missing or damaged')
      const body = decodeObject(row.value)
      if (!Object.hasOwn(body, 'value') || encode(body.metadata!) !== encode(info.metadata)) throw new StorageError('corrupt', 'revision attachment metadata differs from its manifest')
      return { ...info, value: body.value! }
    })
  }
  getRevision(id: RevisionId): Revision { return this.db.transaction(false, () => this.revision(id)) }
  /** Read a revision's position in one playbook, including logically copied history. */
  getHistoryEntry(playbookId: PlaybookId, revisionId: RevisionId): HistoryEntry {
    return this.db.transaction(false, () => {
      this.playbook(playbookId)
      const membership = this.membership(playbookId, revisionId)
      return { playbookId, ordinal: membership.ordinal, revision: this.revision(revisionId), metadata: decodeObject(membership.metadata) }
    })
  }
  listRevisions(playbookId: PlaybookId, options: HistoryOptions = {}): Page<HistoryEntry, number> {
    const limit = pageSize(options.limit); const after = options.after ?? (options.descending ? Number.MAX_SAFE_INTEGER : 0); sequence(after)
    return this.db.transaction(false, () => {
      this.playbook(playbookId)
      const rows = this.db.all<RevisionRow & {ordinal: number; history_metadata: string}>(`SELECT r.*, h.ordinal, h.metadata AS history_metadata FROM playbook_revisions h JOIN revisions r ON r.id=h.revision_id WHERE h.playbook_id=? AND h.ordinal${options.descending ? '<' : '>'}? ORDER BY h.ordinal ${options.descending ? 'DESC' : 'ASC'} LIMIT ?`, playbookId, after, limit + 1)
      return page(rows.map(row => ({ playbookId, ordinal: row.ordinal, revision: revisionFrom(row), metadata: decodeObject(row.history_metadata) })), limit, row => row.ordinal)
    })
  }

  copyPlaybook(input: CopyInput): Playbook {
    name(input.name)
    if (!['copy', 'none'].includes(input.history) || !['copy', 'none'].includes(input.publications)) invalid('copy scopes must be explicit')
    if (input.publications === 'copy' && input.history === 'none') invalid('publications require copied history')
    const body = input.metadata === undefined ? undefined : metadata(input.metadata)
    const draftBody = input.draftMetadata === undefined ? undefined : metadata(input.draftMetadata)
    if (input.source.kind === 'draft') sequence(input.source.expectedSequence)
    else if (input.source.kind !== 'revision') invalid('unknown copy source')
    return this.db.transaction(true, () => {
      const source = this.playbook(input.sourcePlaybookId)
      let base: RevisionId | null; let lastOrdinal: number; let valuesSql: string; let valueOwner: string
      let draftSequence: number | null = null
      let sourceDraftMetadata = metadata()
      if (input.source.kind === 'draft') {
        const draft = this.checkDraft(source.id, input.source.expectedSequence)
        base = draft.baseRevisionId; draftSequence = draft.sequence; sourceDraftMetadata = metadata(draft.metadata)
        lastOrdinal = this.db.get<{n: number}>('SELECT COALESCE(MAX(ordinal), 0) AS n FROM playbook_revisions WHERE playbook_id=?', source.id)!.n
        valuesSql = 'SELECT key, value FROM draft_entries WHERE playbook_id=?'; valueOwner = source.id
      } else {
        const membership = this.membership(source.id, input.source.revisionId)
        base = input.source.revisionId; lastOrdinal = membership.ordinal
        valuesSql = 'SELECT key, value FROM revision_entries WHERE revision_id=?'; valueOwner = input.source.revisionId
      }
      const target = this.insertPlaybook(input.targetProjectId, input.name, body ?? metadata(source.metadata), encode({ projectId: source.projectId, playbookId: source.id, playbookName: source.name, kind: input.source.kind, revisionId: base, draftSequence }), draftBody ?? sourceDraftMetadata)
      this.db.run(`INSERT INTO draft_entries SELECT ?, key, value FROM (${valuesSql})`, target.id, valueOwner)
      this.db.run('UPDATE drafts SET base_revision_id=? WHERE playbook_id=?', base, target.id)
      if (input.history === 'copy') this.db.run('INSERT INTO playbook_revisions SELECT ?, ordinal, revision_id, metadata FROM playbook_revisions WHERE playbook_id=? AND ordinal<=?', target.id, source.id, lastOrdinal)
      if (input.publications === 'copy') {
        const rows = this.db.all<PublicationRow>('SELECT p.* FROM publications p JOIN playbook_revisions h ON h.playbook_id=p.playbook_id AND h.revision_id=p.revision_id WHERE p.playbook_id=? AND h.ordinal<=? ORDER BY p.id', source.id, lastOrdinal)
        for (const row of rows) this.db.run('INSERT INTO publications VALUES (?, ?, ?, ?, ?)', randomUUID(), target.id, row.revision_id, row.metadata, row.created_at)
      }
      return this.playbook(target.id)
    })
  }

  createPublication(input: { playbookId: PlaybookId; revisionId: RevisionId; metadata?: JsonObject }): Publication {
    const body = metadata(input.metadata)
    return this.db.transaction(true, () => {
      this.membership(input.playbookId, input.revisionId)
      const id = randomUUID() as PublicationId
      this.db.run('INSERT INTO publications VALUES (?, ?, ?, ?, ?)', id, input.playbookId, input.revisionId, body, now())
      return this.publication(id)
    })
  }
  getPublication(id: PublicationId): Publication { return this.db.transaction(false, () => this.publication(id)) }
  listPublications(filter: { playbookId?: PlaybookId; revisionId?: RevisionId }, options: PageOptions = {}): Page<Publication> {
    const limit = pageSize(options.limit); const after = afterId(options)
    return this.db.transaction(false, () => {
      if (filter.playbookId !== undefined) this.playbook(filter.playbookId)
      if (filter.revisionId !== undefined) this.revision(filter.revisionId)
      const rows = this.db.all<PublicationRow>('SELECT * FROM publications WHERE (? IS NULL OR playbook_id=?) AND (? IS NULL OR revision_id=?) AND (? IS NULL OR id>?) ORDER BY id LIMIT ?', filter.playbookId ?? null, filter.playbookId ?? null, filter.revisionId ?? null, filter.revisionId ?? null, after, after, limit + 1)
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
  /** Read the owner and its complete values under the same transaction. */
  readSnapshot(input: ContentRef): SnapshotRead {
    return this.db.transaction(false, () => {
      const ref = this.resolveRef(input)
      const source = this.contentSource(ref)
      const rows = this.db.all<EntryRow>(`SELECT key, value FROM ${source.table} WHERE ${source.owner}=? ORDER BY key`, source.id)
      const content = new Map(rows.map(row => [row.key, decode(row.value)]))
      return ref.kind === 'draft'
        ? { kind: 'draft', ref, draft: this.draft(ref.playbookId), content }
        : { kind: 'revision', ref, revision: this.revision(ref.revisionId), content }
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
  private playbook(id: PlaybookId): Playbook { text(id, 'playbook ID'); return playbookFrom(requireRow(this.db.get<PlaybookRow>('SELECT * FROM playbooks WHERE id=?', id), 'playbook')) }
  private revision(id: RevisionId): Revision { text(id, 'revision ID'); return revisionFrom(requireRow(this.db.get<RevisionRow>('SELECT * FROM revisions WHERE id=?', id), 'revision')) }
  private publication(id: PublicationId): Publication { text(id, 'publication ID'); return publicationFrom(requireRow(this.db.get<PublicationRow>('SELECT * FROM publications WHERE id=?', id), 'publication')) }
  private draft(id: PlaybookId): Draft { text(id, 'playbook ID'); return draftFrom(requireRow(this.db.get<DraftRow>('SELECT * FROM drafts WHERE playbook_id=?', id), 'draft')) }
  private checkDraft(id: PlaybookId, expected: number): Draft {
    const draft = this.draft(id)
    if (draft.sequence !== expected) throw new StorageError('conflict', `draft sequence changed: expected ${expected}, found ${draft.sequence}`)
    return draft
  }
  private advanceDraft(id: PlaybookId, base?: RevisionId): void {
    const current = this.draft(id)
    sequence(current.sequence + 1)
    this.db.run('UPDATE drafts SET sequence=sequence+1, base_revision_id=? WHERE playbook_id=?', base ?? current.baseRevisionId, id)
  }
  private membership(playbookId: PlaybookId, revisionId: RevisionId): {ordinal: number; metadata: string} {
    text(playbookId, 'playbook ID'); text(revisionId, 'revision ID')
    return requireRow(this.db.get<{ordinal: number; metadata: string}>('SELECT ordinal, metadata FROM playbook_revisions WHERE playbook_id=? AND revision_id=?', playbookId, revisionId), 'playbook revision')
  }
  private insertPlaybook(projectId: ProjectId, playbookName: string, body: string, origin: string | null, draftBody: string): Playbook {
    this.project(projectId)
    const id = randomUUID() as PlaybookId
    this.db.run('INSERT INTO playbooks VALUES (?, ?, ?, ?, ?, ?)', id, projectId, playbookName, body, origin, now())
    this.db.run('INSERT INTO drafts VALUES (?, 0, NULL, ?)', id, draftBody)
    return this.playbook(id)
  }
  private collectUnreferencedRevisions(): void {
    this.db.run('DELETE FROM revisions WHERE NOT EXISTS (SELECT 1 FROM playbook_revisions h WHERE h.revision_id=revisions.id)')
  }
  private resolveRef(ref: ContentRef, continuing = false): ResolvedRef {
    if (ref.kind === 'revision') { this.revision(ref.revisionId); return { kind: 'revision', revisionId: ref.revisionId } }
    if (ref.kind !== 'draft') invalid('unknown content reference')
    if (continuing && ref.sequence === undefined) invalid('draft pagination requires the sequence returned by the first page')
    if (ref.sequence !== undefined) sequence(ref.sequence)
    const draft = ref.sequence === undefined ? this.draft(ref.playbookId) : this.checkDraft(ref.playbookId, ref.sequence)
    return { kind: 'draft', playbookId: ref.playbookId, sequence: draft.sequence }
  }
  private contentSource(ref: ResolvedRef): { table: string; owner: string; id: string } {
    return ref.kind === 'draft' ? { table: 'draft_entries', owner: 'playbook_id', id: ref.playbookId } : { table: 'revision_entries', owner: 'revision_id', id: ref.revisionId }
  }
}
