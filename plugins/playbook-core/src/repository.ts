/** Persistent business operations; only the storage service owns connections and transactions. */
import type {
  PlaybookStorage, PlaybookQuery, HistoryOptions, CommitInput, CommitResult, ContentRef, CopyInput, CreatePlaybookInput as StorageCreate,
  Draft, DraftWrite, JsonObject, NamedInput, NamedUpdate, PageOptions, ProjectId, PublicationId, ResolvedRef, RevisionId, PlaybookId,
} from '@papermoon/playbook-storage'
import type {
  PlaybookSnapshot, DraftSnapshot, RevisionSnapshot, ContentOperation, PlaybookContent, ContentPageOptions, TextSearch,
  RestoreSelection, CompareOptions, ComparisonCursor, ComparisonPage,
} from './model.ts'
import { createContent, decodeContent, decodeRecord, encodeContent } from './codec.ts'
import { applyOperations, restoreContent } from './operations.ts'
import * as queries from './queries.ts'
import { businessDifference, changedEntries } from './differences.ts'
import { fail } from './error.ts'
import { encodeJson } from '@papermoon/playbook-storage/value'

export interface CreatePlaybookInput extends Omit<StorageCreate, 'initialContent'> {
  defaultLanguage: string
  contentMetadata?: JsonObject
}
export interface EditDraftInput { playbookId: PlaybookId; expectedSequence: number; operations: readonly ContentOperation[]; metadata?: JsonObject }
export interface RestoreDraftInput { playbookId: PlaybookId; expectedSequence: number; revisionId: RevisionId; selection: RestoreSelection }
export interface PlaybookCommitResult extends CommitResult { content: PlaybookContent }

export class PlaybookRepository {
  constructor(private readonly storage: PlaybookStorage) {}

  createProject(input: NamedInput) { return this.storage.createProject(input) }
  getProject(id: ProjectId) { return this.storage.getProject(id) }
  listProjects(options: PageOptions = {}) { return this.storage.listProjects(options) }
  updateProject(id: ProjectId, input: NamedUpdate) { return this.storage.updateProject(id, input) }
  deleteProject(id: ProjectId): void { this.storage.deleteProject(id) }
  createPlaybook(input: CreatePlaybookInput) {
    const content = createContent({ defaultLanguage: input.defaultLanguage, metadata: input.contentMetadata })
    return this.storage.createPlaybook({ projectId: input.projectId, name: input.name, metadata: input.metadata,
      draftMetadata: input.draftMetadata, initialContent: encodeContent(content) })
  }
  queryPlaybooks(options: PlaybookQuery = {}) { return this.storage.queryPlaybooks(options) }
  getPlaybook(id: PlaybookId) { return this.storage.getPlaybook(id) }
  listPlaybooks(projectId: ProjectId, options: PageOptions = {}) { return this.storage.listPlaybooks(projectId, options) }
  updateScript(id: PlaybookId, input: NamedUpdate) { return this.storage.updateScript(id, input) }
  deletePlaybook(id: PlaybookId): void { this.storage.deletePlaybook(id) }
  copyPlaybook(input: CopyInput) {
    this.readSnapshot(input.source.kind === 'draft'
      ? { kind: 'draft', playbookId: input.sourcePlaybookId, sequence: input.source.expectedSequence }
      : { kind: 'revision', revisionId: input.source.revisionId })
    return this.storage.copyPlaybook(input)
  }

  readSnapshot(ref: Extract<ContentRef, { kind: 'draft' }>): DraftSnapshot
  readSnapshot(ref: Extract<ContentRef, { kind: 'revision' }>): RevisionSnapshot
  readSnapshot(ref: ContentRef): PlaybookSnapshot
  readSnapshot(ref: ContentRef): PlaybookSnapshot {
    const snapshot = this.storage.readSnapshot(ref)
    return { ...snapshot, content: decodeContent(snapshot.content) }
  }
  /** A persisted snapshot is returned only after the CAS write succeeds. */
  editDraft(input: EditDraftInput): DraftSnapshot {
    const before = this.readSnapshot({ kind: 'draft', playbookId: input.playbookId, sequence: input.expectedSequence })
    const content = applyOperations(before.content, input.operations)
    return this.saveCandidate(before, content, input.metadata)
  }
  private saveCandidate(before: DraftSnapshot, content: PlaybookContent, metadata?: JsonObject): DraftSnapshot {
    const input: DraftWrite = { playbookId: before.draft.playbookId, expectedSequence: before.draft.sequence,
      changes: changedEntries(encodeContent(before.content), encodeContent(content)), ...(metadata === undefined ? {} : { metadata }) }
    const draft = this.storage.writeDraft(input)
    return this.savedSnapshot(draft, content)
  }
  private savedSnapshot(draft: Draft, content: PlaybookContent): DraftSnapshot {
    return { kind: 'draft', ref: { kind: 'draft', playbookId: draft.playbookId, sequence: draft.sequence }, draft, content }
  }
  commitRevision(input: CommitInput): PlaybookCommitResult {
    if (!input.description.trim()) fail('invalid-input', 'description', 'revision description must not be blank')
    const snapshot = this.readSnapshot({ kind: 'draft', playbookId: input.playbookId, sequence: input.expectedSequence })
    return { ...this.storage.commitRevision(input), content: snapshot.content }
  }
  readRevisionAttachment(id: RevisionId, key: string) { return this.storage.readRevisionAttachment(id, key) }
  getRevision(id: RevisionId) { return this.storage.getRevision(id) }
  getHistoryEntry(id: PlaybookId, revisionId: RevisionId) { return this.storage.getHistoryEntry(id, revisionId) }
  listRevisions(id: PlaybookId, options: HistoryOptions = {}) { return this.storage.listRevisions(id, options) }
  restoreDraft(input: RestoreDraftInput): DraftSnapshot {
    const before = this.readSnapshot({ kind: 'draft', playbookId: input.playbookId, sequence: input.expectedSequence })
    const source = this.readSnapshot({ kind: 'revision', revisionId: input.revisionId })
    const content = restoreContent(before.content, source.content, input.selection)
    if (input.selection.kind !== 'all') return this.saveCandidate(before, content)
    return this.savedSnapshot(this.storage.restoreDraft(input), content)
  }
  registerPublication(input: { playbookId: PlaybookId; revisionId: RevisionId; metadata?: JsonObject }) { return this.storage.createPublication(input) }
  getPublication(id: PublicationId) { return this.storage.getPublication(id) }
  listPublications(filter: { playbookId?: PlaybookId; revisionId?: RevisionId }, options: PageOptions = {}) { return this.storage.listPublications(filter, options) }

  readFile(ref: ContentRef, path: string) { const snapshot = this.readSnapshot(ref); return { ref: snapshot.ref, file: queries.readFile(snapshot.content, path) } }
  readText(ref: ContentRef, key: string) { const snapshot = this.readSnapshot(ref); return { ref: snapshot.ref, entry: queries.readText(snapshot.content, key) } }
  readLanguage(ref: ContentRef, language: string) { const snapshot = this.readSnapshot(ref); return { ref: snapshot.ref, language: queries.readLanguage(snapshot.content, language) } }
  lookupTranslation(ref: ContentRef, key: string, language: string) { const snapshot = this.readSnapshot(ref); return { ref: snapshot.ref, result: queries.lookupTranslation(snapshot.content, key, language) } }
  listFiles(ref: ContentRef, options: ContentPageOptions = {}) { const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listFiles(snapshot.content, options) } }
  listTexts(ref: ContentRef, options: ContentPageOptions = {}) { const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listTexts(snapshot.content, options) } }
  listLanguages(ref: ContentRef, options: ContentPageOptions = {}) { const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listLanguages(snapshot.content, options) } }
  listMissingTranslations(ref: ContentRef, language: string, options: ContentPageOptions = {}) { const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listMissingTranslations(snapshot.content, language, options) } }
  searchProgram(ref: ContentRef, query: string, options: ContentPageOptions = {}) { const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.searchProgram(snapshot.content, query, options) } }
  searchTexts(ref: ContentRef, search: TextSearch, options: ContentPageOptions = {}) { const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.searchTexts(snapshot.content, search, options) } }
  private pageSnapshot(ref: ContentRef, options: ContentPageOptions): PlaybookSnapshot {
    this.requirePinnedPage(ref, options.after)
    queries.pageLimit(options)
    return this.readSnapshot(ref)
  }
  private requirePinnedPage(ref: ContentRef, after: string | undefined): void {
    if (after !== undefined && ref.kind === 'draft' && ref.sequence === undefined) fail('invalid-input', 'ref', 'draft pagination requires the previously returned sequence')
  }

  /** Only headers and changed KV records are loaded; SQL retains filtering and pagination. */
  compare(leftRef: ContentRef, rightRef: ContentRef, options: CompareOptions = {}): ComparisonPage {
    this.requirePinnedPage(leftRef, options.after); this.requirePinnedPage(rightRef, options.after)
    const left = this.headerRef(leftRef), right = this.headerRef(rightRef), scope = options.scope ?? 'all'
    const ranges = { all: {}, settings: { lower: 'content', upper: 'contenu' }, program: { lower: 'program/', upper: 'program0' }, languages: { lower: 'language/', upper: 'language0' }, texts: { lower: 'text/', upper: 'text0' } }
    let after: string | undefined
    if (options.after !== undefined) {
      let cursor: unknown
      try { cursor = JSON.parse(options.after) } catch { fail('invalid-input', 'after', 'invalid comparison cursor') }
      if (!cursor || typeof cursor !== 'object' || !('position' in cursor) || typeof cursor.position !== 'string' || !('request' in cursor) ||
        encodeJson(cursor.request) !== encodeJson({ left, right, scope })) fail('invalid-input', 'after', 'comparison cursor belongs to another request')
      after = cursor.position
    }
    const page = this.storage.compare(left, right, { ...ranges[scope], after, limit: queries.pageLimit(options) })
    return { left: page.left, right: page.right, items: page.items.map(businessDifference),
      ...(page.next === undefined ? {} : { next: JSON.stringify({ request: { left, right, scope }, position: page.next }) as ComparisonCursor }) }
  }
  private headerRef(ref: ContentRef): ResolvedRef {
    const read = this.storage.readEntry(ref, 'content')
    if (!read.entry.exists) fail('invalid-content', 'content', 'content header is required')
    const header = decodeRecord('content', read.entry.value)
    if (header.kind !== 'settings') fail('invalid-content', 'content', 'invalid content header')
    const languageKey = 'language/' + header.value.defaultLanguage
    const language = this.storage.readEntry(read.ref, languageKey)
    if (!language.entry.exists) fail('invalid-content', languageKey, 'default language must be registered')
    decodeRecord(languageKey, language.entry.value)
    return read.ref
  }
}
