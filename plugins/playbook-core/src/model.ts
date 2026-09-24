/** Authored content is independent of compilation, sessions and persistence implementations. */
import type { Draft, JsonObject, ResolvedRef, Revision } from '@papermoon/playbook-storage'
export type { JsonObject, JsonValue, Project, ProjectId, Playbook, PlaybookId, Draft, Revision, RevisionId, HistoryEntry, Publication, PublicationId, ContentRef, ResolvedRef } from '@papermoon/playbook-storage'
export const CONTENT_FORMAT = 'papermoon.playbook'
export interface ProgramFile { readonly path: string; readonly source: string; readonly metadata: JsonObject }
export interface Program { readonly metadata: JsonObject; readonly files: ReadonlyMap<string, ProgramFile> }
export interface Language { readonly id: string; readonly metadata: JsonObject }
export interface Translation { readonly text: string; readonly metadata: JsonObject }
export interface TextEntry {
  readonly key: string
  readonly description?: string
  readonly metadata: JsonObject
  readonly translations: ReadonlyMap<string, Translation>
}
export interface TextCatalog {
  readonly defaultLanguage: string
  readonly metadata: JsonObject
  readonly languages: ReadonlyMap<string, Language>
  readonly entries: ReadonlyMap<string, TextEntry>
}
export interface PlaybookContent {
  readonly format: typeof CONTENT_FORMAT
  readonly metadata: JsonObject
  readonly program: Program
  readonly texts: TextCatalog
}
export type PlaybookSnapshot =
  | { readonly kind: 'draft'; readonly ref: Extract<ResolvedRef, { kind: 'draft' }>; readonly draft: Draft; readonly content: PlaybookContent }
  | { readonly kind: 'revision'; readonly ref: Extract<ResolvedRef, { kind: 'revision' }>; readonly revision: Revision; readonly content: PlaybookContent }
export type DraftSnapshot = Extract<PlaybookSnapshot, { kind: 'draft' }>
export type RevisionSnapshot = Extract<PlaybookSnapshot, { kind: 'revision' }>
/** Metadata is replaced as a whole; omitted metadata on new entities becomes an empty object. */
export type MetadataTarget =
  | { kind: 'content' | 'program' | 'catalog' }
  | { kind: 'file'; path: string }
  | { kind: 'language'; language: string }
  | { kind: 'text'; key: string }
  | { kind: 'translation'; key: string; language: string }
export type ContentOperation =
  | { kind: 'create-file'; path: string; source: string; metadata?: JsonObject }
  | { kind: 'replace-file'; path: string; source: string }
  | { kind: 'delete-file'; path: string }
  | { kind: 'rename-file'; path: string; to: string }
  | { kind: 'add-language'; language: string; metadata?: JsonObject }
  | { kind: 'delete-language'; language: string }
  | { kind: 'set-default-language'; language: string }
  | { kind: 'create-text'; key: string; description?: string; metadata?: JsonObject }
  | { kind: 'delete-text'; key: string }
  | { kind: 'rename-text'; key: string; to: string }
  | { kind: 'set-description'; key: string; description: string | null }
  | { kind: 'set-translation'; key: string; language: string; text: string; metadata?: JsonObject }
  | { kind: 'delete-translation'; key: string; language: string }
  | { kind: 'set-metadata'; target: MetadataTarget; metadata: JsonObject }
/** A source is a retained revision; restoring a missing object is an error, not a deletion. */
export type RestoreSelection = { kind: 'all' | 'program' | 'catalog' } | { kind: 'file'; path: string } | { kind: 'text'; key: string }
export interface ContentPageOptions { after?: string; limit?: number }
export interface ContentPage<T> { items: T[]; next?: string }
export interface LocatedPage<T> extends ContentPage<T> { ref: ResolvedRef }
export interface SearchMatch { field: 'source' | 'key' | 'description' | 'translation'; language?: string; offsets: number[] }
export interface ProgramMatch { path: string; matches: SearchMatch[] }
export interface TextMatch { key: string; matches: SearchMatch[] }
export interface TextSearch { query: string; language?: string; fields?: readonly ('key' | 'description' | 'translation')[] }
export type TranslationLookup =
  | { kind: 'found'; translation: Translation }
  | { kind: 'missing'; reason: 'language' | 'entry' | 'translation' }
export interface ContentSettings {
  readonly format: typeof CONTENT_FORMAT
  readonly metadata: JsonObject; readonly programMetadata: JsonObject; readonly catalogMetadata: JsonObject
  readonly defaultLanguage: string
}
export type ContentRecord =
  | { kind: 'settings'; value: ContentSettings }
  | { kind: 'file'; value: ProgramFile }
  | { kind: 'language'; value: Language }
  | { kind: 'text'; value: TextEntry }
export interface ContentDifference {
  kind: 'added' | 'removed' | 'modified'
  before: ContentRecord | null
  after: ContentRecord | null
  /** Paths address changed fields within the grouped entity; metadata is compared as a whole. */
  fields: readonly (readonly string[])[]
}
/** Returned by comparison; callers reuse it without interpreting its storage position. */
export type ComparisonCursor = string & { readonly __kind: 'comparison-cursor' }
export interface CompareOptions { scope?: 'all' | 'settings' | 'program' | 'languages' | 'texts'; after?: ComparisonCursor; limit?: number }
export interface ComparisonPage {
  left: ResolvedRef; right: ResolvedRef; items: ContentDifference[]; next?: ComparisonCursor
}
