/** Persistent business operations; only the storage service owns connections and transactions. */
import type {
  PlaybookStorage, PlaybookQuery, HistoryOptions, CommitInput, CommitResult, ContentRef, CopyInput, CreatePlaybookInput as StorageCreate,
  Draft, DraftWrite, JsonObject, NamedInput, NamedUpdate, PageOptions, ProjectId, PublicationId, ResolvedRef, RevisionId, PlaybookId,
} from '@papermoon/playbook-storage'
import type {
  PlaybookSnapshot, DraftSnapshot, RevisionSnapshot, ContentOperation, PlaybookContent, ContentPageOptions, TextSearch,
  RestoreSelection, CompareOptions, ComparisonCursor, ComparisonPage,
} from './model.ts'
import { capabilities, projectContent, operationCapability, type Capability, type ManagedState, type PlaybookPolicy } from './access.ts'
import { createContent, decodeContent, decodeRecord, encodeContent } from './codec.ts'
import { applyOperations, restoreContent } from './operations.ts'
import * as queries from './queries.ts'
import { businessDifference, changedEntries } from './differences.ts'
import { fail } from './error.ts'
import { encodeJson } from '@papermoon/playbook-storage/value'

export interface CreatePlaybookInput extends Omit<StorageCreate, 'initialContent'> {
  defaultLanguage: string
  systemMode?: 'plain' | 'script'
  openingMode?: 'plain' | 'script'
  contentMetadata?: JsonObject
}
export interface EditDraftInput { playbookId: PlaybookId; expectedSequence: number; operations: readonly ContentOperation[]; metadata?: JsonObject }
export interface RestoreDraftInput { playbookId: PlaybookId; expectedSequence: number; revisionId: RevisionId; selection: RestoreSelection }
export interface PlaybookCommitResult extends CommitResult { content: PlaybookContent }

interface Policies { policies: Map<string, PlaybookPolicy>; listeners: Set<(id: PlaybookId) => void> }
export class PlaybookRepository {
  constructor(private readonly storage: PlaybookStorage, private readonly policies: Policies = { policies: new Map(), listeners: new Set() }, private readonly authority = false) {}
  /** Register a trusted host policy and obtain its protected-write controller. Disposal leaves managed saves closed until a provider returns. */
  registerPolicy(name: string, policy: PlaybookPolicy) {
    if (this.policies.policies.has(name)) fail('already-exists', 'policy', 'policy is already registered')
    this.policies.policies.set(name, policy)
    this.notifyAll()
    return { repository: new PlaybookRepository(this.storage, this.policies, true), dispose: () => { if (this.policies.policies.get(name) === policy) { this.policies.policies.delete(name); this.notifyAll() } } }
  }
  subscribe(listener: (id: PlaybookId) => void) { this.policies.listeners.add(listener); return () => { this.policies.listeners.delete(listener) } }
  private notifyAll() { for (let page = this.storage.queryPlaybooks({ limit: 1000 }); ; ) { for (const item of page.items) this.notify(item.id); if (!page.next) break; page = this.storage.queryPlaybooks({ after: page.next, limit: 1000 }) } }
  private notify(id: PlaybookId) { for (const listener of this.policies.listeners) listener(id) }
  managed(id: PlaybookId): ManagedState | null {
    const raw: unknown = this.storage.getDraft(id).metadata.$managed
    const value = raw as Record<string, unknown> | undefined
    if (value === undefined) return null
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.policy !== 'string' || typeof value.binding !== 'string' || !value.state || typeof value.state !== 'object' || Array.isArray(value.state)) fail('invalid-content', 'managed', 'invalid managed Playbook state')
    return value as unknown as ManagedState
  }
  presentation(id: PlaybookId) { const managed = this.managed(id); return managed ? this.policies.policies.get(managed.policy)?.presentation?.(managed) : undefined }
  /** Resolve current capabilities on every call; an unavailable managed policy grants none. */
  access(id: PlaybookId): readonly Capability[] {
    const managed = this.managed(id)
    return managed ? this.policies.policies.get(managed.policy)?.capabilities(managed) ?? [] : capabilities
  }
  require(id: PlaybookId, ...scopes: Capability[]) {
    if (!this.authority && scopes.some(scope => !this.access(id).includes(scope))) fail('forbidden', 'capability', 'this operation is unavailable at the current stage')
  }
  /** Enforce operation-specific policy in addition to capability admission, including policy availability. */
  authorize(id: PlaybookId, operation: string, input: JsonObject) {
    const managed = this.managed(id)
    if (!managed) return
    const policy = this.policies.policies.get(managed.policy)
    if (!policy) fail('forbidden', 'policy', 'the Playbook policy is unavailable')
    policy.authorize?.(managed, operation, { ...input, $baseRevisionId: this.storage.getDraft(id).baseRevisionId })
  }
  /** Execution readers are created after admission and stay inside host services. */
  executionRepository(id: PlaybookId): PlaybookRepository { this.require(id, 'performance'); return new PlaybookRepository(this.storage, this.policies, true) }
  private owner(ref: ContentRef): PlaybookId { return ref.kind === 'draft' ? ref.playbookId : this.storage.revisionOwner(ref.revisionId) }
  private snapshot(ref: ContentRef): PlaybookSnapshot { const value = this.storage.readSnapshot(ref); return { ...value, content: decodeContent(value.content) } }
  /** Return a valid, redacted snapshot for partial authoring access. Full snapshot reads require every content scope. */
  view(ref: Extract<ContentRef, { kind: 'draft' }>): DraftSnapshot
  view(ref: ContentRef): PlaybookSnapshot
  view(ref: ContentRef): PlaybookSnapshot {
    const id = this.owner(ref)
    if (ref.kind === 'revision') this.require(id, 'history')
    const snapshot = this.snapshot(ref)
    const content = projectContent(snapshot.content, this.access(id))
    return snapshot.kind === 'draft' ? { ...snapshot, content, draft: { ...snapshot.draft, metadata: this.access(id).includes('metadata') ? snapshot.draft.metadata : {} } } : { ...snapshot, content }
  }
  /** CAS update for orchestration only. Policy identity and storyline binding remain immutable. */
  updateManaged(id: PlaybookId, expectedSequence: number, value: ManagedState): Draft {
    if (!this.authority) fail('forbidden', 'managed', 'managed writes require a policy controller')
    const before = this.managed(id)
    if (!before || before.binding !== value.binding || before.policy !== value.policy) fail('forbidden', 'binding', 'the Playbook binding is immutable')
    const draft = this.storage.getDraft(id)
    const result = this.storage.writeDraft({ playbookId: id, expectedSequence, changes: [], metadata: { ...draft.metadata, $managed: value as unknown as JsonObject } })
    this.notify(id); return result
  }

  createProject(input: NamedInput) { return this.storage.createProject(input) }
  getProject(id: ProjectId) { return this.storage.getProject(id) }
  listProjects(options: PageOptions = {}) { return this.storage.listProjects(options) }
  updateProject(id: ProjectId, input: NamedUpdate) { return this.storage.updateProject(id, input) }
  deleteProject(id: ProjectId): void { this.storage.deleteProject(id) }
  createPlaybook(input: CreatePlaybookInput) {
    if (!this.authority && input.draftMetadata?.$managed !== undefined) fail('forbidden', 'managed', 'managed creation requires a policy controller')
    const content = createContent({ defaultLanguage: input.defaultLanguage, metadata: input.contentMetadata, systemMode: input.systemMode, openingMode: input.openingMode })
    return this.storage.createPlaybook({ projectId: input.projectId, name: input.name, metadata: input.metadata,
      draftMetadata: input.draftMetadata, initialContent: encodeContent(content) })
  }
  queryPlaybooks(options: PlaybookQuery = {}) { return this.storage.queryPlaybooks(options) }
  getPlaybook(id: PlaybookId) { return this.storage.getPlaybook(id) }
  listPlaybooks(projectId: ProjectId, options: PageOptions = {}) { return this.storage.listPlaybooks(projectId, options) }
  updateScript(id: PlaybookId, input: NamedUpdate) { if (input.metadata) this.require(id, 'metadata'); return this.storage.updateScript(id, input) }
  deletePlaybook(id: PlaybookId): void { this.storage.deletePlaybook(id) }
  copyPlaybook(input: CopyInput) {
    this.require(input.sourcePlaybookId, 'copy')
    if (!this.authority && input.draftMetadata?.$managed !== undefined) fail('forbidden', 'managed', 'managed state is protected')
    this.readSnapshot(input.source.kind === 'draft'
      ? { kind: 'draft', playbookId: input.sourcePlaybookId, sequence: input.source.expectedSequence }
      : { kind: 'revision', revisionId: input.source.revisionId })
    return this.storage.copyPlaybook(input)
  }

  readSnapshot(ref: Extract<ContentRef, { kind: 'draft' }>): DraftSnapshot
  readSnapshot(ref: Extract<ContentRef, { kind: 'revision' }>): RevisionSnapshot
  readSnapshot(ref: ContentRef): PlaybookSnapshot
  readSnapshot(ref: ContentRef): PlaybookSnapshot {
    this.require(this.owner(ref), 'system.read', 'opening.read', 'program.read', 'texts.read', 'metadata')
    if (ref.kind === 'revision') this.require(this.owner(ref), 'history')
    return this.snapshot(ref)
  }
  /** A persisted snapshot is returned only after the CAS write succeeds. */
  editDraft(input: EditDraftInput): DraftSnapshot {
    this.authorize(input.playbookId, 'draft.save', {})
    for (const operation of input.operations) this.require(input.playbookId, operationCapability(operation))
    if (input.metadata !== undefined && !this.authority) { this.require(input.playbookId, 'metadata'); if (input.metadata.$managed !== undefined) fail('forbidden', 'managed', 'managed state is protected') }
    const before = this.snapshot({ kind: 'draft', playbookId: input.playbookId, sequence: input.expectedSequence }) as DraftSnapshot
    const managed = this.managed(input.playbookId)
    const state = managed && this.policies.policies.get(managed.policy)?.saved?.(managed, input.operations)
    const savedMetadata = state ? { ...before.draft.metadata, $managed: { ...managed, state } as unknown as JsonObject } : managed && input.metadata !== undefined ? { ...input.metadata, $managed: before.draft.metadata.$managed! } : input.metadata
    const content = applyOperations(before.content, input.operations)
    return this.saveCandidate(before, content, savedMetadata)
  }
  private saveCandidate(before: DraftSnapshot, content: PlaybookContent, metadata?: JsonObject): DraftSnapshot {
    const input: DraftWrite = { playbookId: before.draft.playbookId, expectedSequence: before.draft.sequence,
      changes: changedEntries(encodeContent(before.content), encodeContent(content)), ...(metadata === undefined ? {} : { metadata }) }
    const draft = this.storage.writeDraft(input)
    this.notify(draft.playbookId)
    return this.savedSnapshot(draft, content)
  }
  private savedSnapshot(draft: Draft, content: PlaybookContent): DraftSnapshot {
    const allowed = this.authority ? capabilities : this.access(draft.playbookId)
    return { kind: 'draft', ref: { kind: 'draft', playbookId: draft.playbookId, sequence: draft.sequence }, draft: allowed.includes('metadata') ? draft : { ...draft, metadata: {} }, content: projectContent(content, allowed) }
  }
  commitRevision(input: CommitInput): PlaybookCommitResult {
    this.require(input.playbookId, 'commit')
    if (!this.authority && (input.tag !== undefined || String(input.historyMetadata?.tag ?? '').startsWith('story/') || input.draftMetadata?.$managed !== undefined || input.metadata?.$managed !== undefined)) fail('forbidden', 'managed', 'managed submission requires a policy controller')
    if (!input.description.trim()) fail('invalid-input', 'description', 'revision description must not be blank')
    const snapshot = input.sourceRevisionId ? this.snapshot({ kind: 'revision', revisionId: input.sourceRevisionId }) : this.snapshot({ kind: 'draft', playbookId: input.playbookId, sequence: input.expectedSequence })
    const result = { ...this.storage.commitRevision(input), content: snapshot.content }; this.notify(input.playbookId); return result
  }
  readRevisionAttachment(id: RevisionId, key: string) { this.require(this.storage.revisionOwner(id), 'history'); return this.storage.readRevisionAttachment(id, key) }
  getRevision(id: RevisionId) { this.require(this.storage.revisionOwner(id), 'history'); return this.storage.getRevision(id) }
  getHistoryEntry(id: PlaybookId, revisionId: RevisionId) { this.require(id, 'history'); return this.storage.getHistoryEntry(id, revisionId) }
  listRevisions(id: PlaybookId, options: HistoryOptions = {}) { this.require(id, 'history'); return this.storage.listRevisions(id, options) }
  restoreDraft(input: RestoreDraftInput): DraftSnapshot {
    this.require(input.playbookId, 'restore')
    const before = this.readSnapshot({ kind: 'draft', playbookId: input.playbookId, sequence: input.expectedSequence })
    const source = this.readSnapshot({ kind: 'revision', revisionId: input.revisionId })
    const content = restoreContent(before.content, source.content, input.selection)
    if (input.selection.kind !== 'all') return this.saveCandidate(before, content)
    return this.savedSnapshot(this.storage.restoreDraft(input), content)
  }
  registerPublication(input: { playbookId: PlaybookId; revisionId: RevisionId; metadata?: JsonObject }) { this.require(input.playbookId, 'history', 'metadata'); return this.storage.createPublication(input) }
  getPublication(id: PublicationId) { const value = this.storage.getPublication(id); this.require(value.playbookId, 'history', 'metadata'); return value }
  listPublications(filter: { playbookId?: PlaybookId; revisionId?: RevisionId }, options: PageOptions = {}) { if (filter.playbookId) this.require(filter.playbookId, 'history', 'metadata'); if (filter.revisionId) this.require(this.storage.revisionOwner(filter.revisionId), 'history', 'metadata'); const page = this.storage.listPublications(filter, options); for (const item of page.items) this.require(item.playbookId, 'history', 'metadata'); return page }

  readFile(ref: ContentRef, path: string) { this.require(this.owner(ref), 'program.read', ...(ref.kind === 'revision' ? ['history'] as const : [])); const snapshot = this.snapshot(ref); return { ref: snapshot.ref, file: queries.readFile(snapshot.content, path) } }
  readText(ref: ContentRef, key: string) { this.require(this.owner(ref), 'texts.read', ...(ref.kind === 'revision' ? ['history'] as const : [])); const snapshot = this.snapshot(ref); return { ref: snapshot.ref, entry: queries.readText(snapshot.content, key) } }
  readLanguage(ref: ContentRef, language: string) { this.require(this.owner(ref), 'texts.read', ...(ref.kind === 'revision' ? ['history'] as const : [])); const snapshot = this.snapshot(ref); return { ref: snapshot.ref, language: queries.readLanguage(snapshot.content, language) } }
  lookupTranslation(ref: ContentRef, key: string, language: string) { this.require(this.owner(ref), 'texts.read', ...(ref.kind === 'revision' ? ['history'] as const : [])); const snapshot = this.snapshot(ref); return { ref: snapshot.ref, result: queries.lookupTranslation(snapshot.content, key, language) } }
  listFiles(ref: ContentRef, options: ContentPageOptions = {}) { this.require(this.owner(ref), 'program.read'); const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listFiles(snapshot.content, options) } }
  listTexts(ref: ContentRef, options: ContentPageOptions = {}) { this.require(this.owner(ref), 'texts.read'); const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listTexts(snapshot.content, options) } }
  listLanguages(ref: ContentRef, options: ContentPageOptions = {}) { this.require(this.owner(ref), 'texts.read'); const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listLanguages(snapshot.content, options) } }
  listMissingTranslations(ref: ContentRef, language: string, options: ContentPageOptions = {}) { this.require(this.owner(ref), 'texts.read'); const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.listMissingTranslations(snapshot.content, language, options) } }
  searchProgram(ref: ContentRef, query: string, options: ContentPageOptions = {}) { this.require(this.owner(ref), 'program.read'); const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.searchProgram(snapshot.content, query, options) } }
  searchTexts(ref: ContentRef, search: TextSearch, options: ContentPageOptions = {}) { this.require(this.owner(ref), 'texts.read'); const snapshot = this.pageSnapshot(ref, options); return { ref: snapshot.ref, ...queries.searchTexts(snapshot.content, search, options) } }
  private pageSnapshot(ref: ContentRef, options: ContentPageOptions): PlaybookSnapshot {
    this.requirePinnedPage(ref, options.after)
    queries.pageLimit(options)
    if (ref.kind === 'revision') this.require(this.owner(ref), 'history')
    return this.snapshot(ref)
  }
  private requirePinnedPage(ref: ContentRef, after: string | undefined): void {
    if (after !== undefined && ref.kind === 'draft' && ref.sequence === undefined) fail('invalid-input', 'ref', 'draft pagination requires the previously returned sequence')
  }

  /** Only headers and changed KV records are loaded; SQL retains filtering and pagination. */
  compare(leftRef: ContentRef, rightRef: ContentRef, options: CompareOptions = {}): ComparisonPage {
    this.require(this.owner(leftRef), 'history'); this.require(this.owner(rightRef), 'history')
    this.requirePinnedPage(leftRef, options.after); this.requirePinnedPage(rightRef, options.after)
    const left = this.headerRef(leftRef), right = this.headerRef(rightRef), scope = options.scope ?? 'all'
    const ranges = { all: {}, systemPrompt: { lower: 'systemPrompt', upper: 'systemPrompu' }, opening: { lower: 'opening', upper: 'openinh' }, settings: { lower: 'content', upper: 'contenu' }, program: { lower: 'program/', upper: 'program0' }, languages: { lower: 'language/', upper: 'language0' }, texts: { lower: 'text/', upper: 'text0' } }
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
