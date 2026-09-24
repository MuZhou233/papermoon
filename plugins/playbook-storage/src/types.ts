/** Persistent identities and the synchronous repository API's request/result data. */
export type Id<Kind extends string> = string & { readonly __kind: Kind }
export type ProjectId = Id<'project'>
export type PlaybookId = Id<'playbook'>
export type RevisionId = Id<'revision'>
export type PublicationId = Id<'publication'>
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject
export interface JsonObject { readonly [key: string]: JsonValue }
export type Content = ReadonlyMap<string, JsonValue>
export interface NamedInput { name: string; metadata?: JsonObject }
export interface NamedUpdate { name?: string; metadata?: JsonObject }
export interface Project { id: ProjectId; name: string; metadata: JsonObject; createdAt: string }
export interface Playbook {
  id: PlaybookId; projectId: ProjectId; name: string; metadata: JsonObject; createdAt: string
  /** Informational provenance; it does not retain the source. */
  origin: JsonObject | null
}
export interface Draft { playbookId: PlaybookId; sequence: number; baseRevisionId: RevisionId | null; metadata: JsonObject }
/** Immutable payloads accompany the revision without entering authored KV content. */
export interface RevisionAttachmentInput { key: string; value: JsonValue; metadata?: JsonObject }
export interface RevisionAttachmentInfo { key: string; checksum: string; metadata: JsonObject }
export interface RevisionAttachment extends RevisionAttachmentInfo { value: JsonValue }
export interface RevisionAttachments { metadata: JsonObject; items: readonly RevisionAttachmentInfo[] }
export interface Revision {
  id: RevisionId; description: string; metadata: JsonObject; createdAt: string; attachments: RevisionAttachments
  source: { projectId: ProjectId; projectName: string; playbookId: PlaybookId; playbookName: string; draftSequence: number; baseRevisionId: RevisionId | null }
  /** Informational references, not additional history or retention edges. */
  references: readonly RevisionId[]
}
export interface HistoryEntry { playbookId: PlaybookId; ordinal: number; revision: Revision; metadata: JsonObject }
export interface Publication { id: PublicationId; playbookId: PlaybookId; revisionId: RevisionId; metadata: JsonObject; createdAt: string }
export interface PageOptions<Cursor = string> { after?: Cursor; limit?: number }
export interface Page<T, Cursor = string> { items: T[]; next?: Cursor }
/** Keys use SQLite BINARY ordering. Lower is inclusive; upper and after are exclusive. */
export interface KeyOptions extends PageOptions { lower?: string; upper?: string }
/** Pass sequence to pin a draft read, including later pages and diff details. */
export type ContentRef = { kind: 'draft'; playbookId: PlaybookId; sequence?: number } | { kind: 'revision'; revisionId: RevisionId }
export type ResolvedRef = { kind: 'draft'; playbookId: PlaybookId; sequence: number } | { kind: 'revision'; revisionId: RevisionId }
export interface ContentRead { ref: ResolvedRef; content: Content }
export interface Entry { key: string; value: JsonValue }
export type EntryValue = { exists: false } | { exists: true; value: JsonValue }
export interface EntryRead { ref: ResolvedRef; entry: EntryValue }
export interface EntryPage extends Page<Entry> { ref: ResolvedRef }
export type Change = { kind: 'set'; key: string; value: JsonValue } | { kind: 'delete'; key: string }
export interface DraftWrite { playbookId: PlaybookId; expectedSequence: number; changes: readonly Change[]; metadata?: JsonObject }
export interface CommitInput {
  playbookId: PlaybookId; expectedSequence: number; description: string; metadata?: JsonObject; historyMetadata?: JsonObject; references?: readonly RevisionId[]
  attachments?: readonly RevisionAttachmentInput[]; attachmentMetadata?: JsonObject
}
export interface CommitResult { revision: Revision; entry: HistoryEntry; draft: Draft }
export interface CopyInput {
  sourcePlaybookId: PlaybookId
  source: { kind: 'draft'; expectedSequence: number } | { kind: 'revision'; revisionId: RevisionId }
  targetProjectId: ProjectId
  name: string
  metadata?: JsonObject
  draftMetadata?: JsonObject
  history: 'copy' | 'none'
  publications: 'copy' | 'none'
}
export interface Difference { key: string; kind: 'added' | 'removed' | 'modified'; before: EntryValue; after: EntryValue }
export interface DifferencePage extends Page<Difference> { left: ResolvedRef; right: ResolvedRef }
/** Initial values and draft attributes are committed with the playbook at sequence zero. */
export interface CreatePlaybookInput extends NamedInput { projectId: ProjectId; initialContent?: Content; draftMetadata?: JsonObject }
/** Owner attributes and values observed in one database read transaction. */
export type SnapshotRead =
  | { kind: 'draft'; ref: Extract<ResolvedRef, { kind: 'draft' }>; draft: Draft; content: Content }
  | { kind: 'revision'; ref: Extract<ResolvedRef, { kind: 'revision' }>; revision: Revision; content: Content }

/** Catalog queries stay metadata-only and use stable ID order across renames. */
export interface PlaybookQuery extends PageOptions { projectId?: ProjectId; query?: string }
export interface PlaybookSummary extends Playbook { projectName: string; latestOrdinal: number }
export interface HistoryOptions extends PageOptions<number> { descending?: boolean }
