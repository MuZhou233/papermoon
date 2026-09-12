/** This module owns the complete business KV format; no consumer constructs storage keys. */
import { encodeJson } from '@papermoon/story-storage/value'
import type { Content, JsonObject, JsonValue } from '@papermoon/story-storage'
import { CONTENT_FORMAT, CONTENT_VERSION } from './model.ts'
import type { ContentRecord, ContentSettings, Language, ProgramFile, StoryContent, TextEntry, Translation } from './model.ts'
import { fail, StoryError } from './error.ts'

export function identifier(value: string, location: string): void {
  if (typeof value !== 'string' || !value.length || !value.isWellFormed() || value.includes('\0')) fail('invalid-input', location, 'expected a nonempty Unicode identifier without NUL')
}
export function filePath(value: string): void {
  identifier(value, `program/${value}`)
  if (/^[a-z]:/i.test(value) || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) {
    fail('invalid-input', `program/${value}`, 'expected a canonical relative path')
  }
}
export function jsonValue(value: unknown, location: string): JsonValue {
  try { return JSON.parse(encodeJson(value)) as JsonValue } catch (cause) {
    throw new StoryError('invalid-content', 'expected a JSON-storable value', location, { cause })
  }
}
function object(value: JsonValue | undefined, location: string, required: string[], optional: string[] = []): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('invalid-content', location, 'expected an object')
  const result = value as JsonObject
  if (required.some(key => !Object.hasOwn(result, key)) || Object.keys(result).some(key => !required.includes(key) && !optional.includes(key))) {
    fail('invalid-content', location, 'missing or unknown fields')
  }
  return result
}
function string(value: JsonValue | undefined, location: string): string {
  if (typeof value !== 'string') fail('invalid-content', location, 'expected a string')
  return value
}
export function copyMetadata(value: JsonObject, location: string): JsonObject {
  const result = jsonValue(value, location)
  if (result === null || typeof result !== 'object' || Array.isArray(result)) fail('invalid-content', location, 'metadata must be an object')
  return result as JsonObject
}
function storedMetadata(value: JsonValue | undefined, location: string): JsonObject {
  if (value === undefined) fail('invalid-content', location, 'metadata is required')
  return copyMetadata(value as JsonObject, location)
}

/** Parse one record for targeted reads and SQL-filtered comparison; relations are checked by full decoding. */
export function decodeRecord(recordKey: string, raw: JsonValue): ContentRecord {
  const value = jsonValue(raw, recordKey)
  if (recordKey === 'content') {
    const header = object(value, recordKey, ['format', 'version', 'metadata', 'programMetadata', 'catalogMetadata', 'defaultLanguage'])
    if (header.format !== CONTENT_FORMAT || header.version !== CONTENT_VERSION) fail('invalid-content', recordKey, 'unsupported content format or version')
    const defaultLanguage = string(header.defaultLanguage, recordKey + '/defaultLanguage')
    identifier(defaultLanguage, recordKey + '/defaultLanguage')
    return { kind: 'settings', value: { format: CONTENT_FORMAT, version: CONTENT_VERSION, defaultLanguage,
      metadata: storedMetadata(header.metadata, recordKey + '/metadata'),
      programMetadata: storedMetadata(header.programMetadata, recordKey + '/programMetadata'),
      catalogMetadata: storedMetadata(header.catalogMetadata, recordKey + '/catalogMetadata') } }
  }
  if (recordKey.startsWith('program/')) {
    const path = recordKey.slice(8); filePath(path)
    const file = object(value, recordKey, ['source', 'metadata'])
    return { kind: 'file', value: { path, source: string(file.source, recordKey + '/source'), metadata: storedMetadata(file.metadata, recordKey + '/metadata') } }
  }
  if (recordKey.startsWith('language/')) {
    const id = recordKey.slice(9); identifier(id, recordKey)
    const language = object(value, recordKey, ['metadata'])
    return { kind: 'language', value: { id, metadata: storedMetadata(language.metadata, recordKey + '/metadata') } }
  }
  if (recordKey.startsWith('text/')) {
    const key = recordKey.slice(5); identifier(key, recordKey)
    const entry = object(value, recordKey, ['metadata', 'translations'], ['description'])
    const translations = new Map<string, Translation>()
    const rawTranslations = entry.translations
    if (!rawTranslations || typeof rawTranslations !== 'object' || Array.isArray(rawTranslations)) fail('invalid-content', recordKey + '/translations', 'expected a translation object')
    for (const [id, rawTranslation] of Object.entries(rawTranslations)) {
      identifier(id, recordKey + '/translations')
      const translation = object(rawTranslation, recordKey + '/' + id, ['text', 'metadata'])
      translations.set(id, { text: string(translation.text, recordKey + '/' + id + '/text'), metadata: storedMetadata(translation.metadata, recordKey + '/' + id + '/metadata') })
    }
    return { kind: 'text', value: { key, metadata: storedMetadata(entry.metadata, recordKey + '/metadata'), translations,
      ...(Object.hasOwn(entry, 'description') ? { description: string(entry.description, recordKey + '/description') } : {}) } }
  }
  return fail('invalid-content', recordKey, 'unknown content record')
}

/** Decodes all records and cross-record relationships without adding missing defaults. */
export function decodeContent(records: Content): StoryContent {
  try {
    let header: ContentSettings | undefined
    const files = new Map<string, ProgramFile>(), languages = new Map<string, Language>(), entries = new Map<string, TextEntry>()
    for (const [recordKey, raw] of records) {
      const record = decodeRecord(recordKey, raw)
      switch (record.kind) {
        case 'settings': header = record.value; break
        case 'file': files.set(record.value.path, record.value); break
        case 'language': languages.set(record.value.id, record.value); break
        case 'text': entries.set(record.value.key, record.value); break
      }
    }
    if (!header) fail('invalid-content', 'content', 'content header is required')
    for (const path of files.keys()) {
      const parts = path.split('/')
      for (let end = 1; end < parts.length; end++) if (files.has(parts.slice(0, end).join('/'))) fail('invalid-content', `program/${path}`, 'a parent path is a file')
    }
    if (!languages.has(header.defaultLanguage)) fail('invalid-content', 'content/defaultLanguage', 'default language must be registered')
    for (const entry of entries.values()) for (const id of entry.translations.keys()) {
      if (!languages.has(id)) fail('invalid-content', `text/${entry.key}/${id}`, 'translation language is not registered')
    }
    return { format: CONTENT_FORMAT, version: CONTENT_VERSION, metadata: header.metadata,
      program: { files, metadata: header.programMetadata },
      texts: { defaultLanguage: header.defaultLanguage, languages, entries, metadata: header.catalogMetadata } }
  } catch (error) {
    if (error instanceof StoryError && error.code !== 'invalid-content') throw new StoryError('invalid-content', error.message, error.location, { cause: error })
    throw error
  }
}

/** Encodes detached JSON values and verifies the resulting complete business structure. */
export function encodeContent(content: StoryContent): Content {
  const records = new Map<string, JsonValue>()
  records.set('content', jsonValue({ format: content.format, version: content.version, metadata: content.metadata,
    programMetadata: content.program.metadata, catalogMetadata: content.texts.metadata, defaultLanguage: content.texts.defaultLanguage }, 'content'))
  for (const [path, file] of content.program.files) {
    if (path !== file.path) fail('invalid-content', `program/${path}`, 'file path differs from its map key')
    records.set('program/' + path, jsonValue({ source: file.source, metadata: file.metadata }, 'program/' + path))
  }
  for (const [id, language] of content.texts.languages) {
    if (id !== language.id) fail('invalid-content', `language/${id}`, 'language identity differs from its map key')
    records.set('language/' + id, jsonValue({ metadata: language.metadata }, 'language/' + id))
  }
  for (const [key, entry] of content.texts.entries) {
    if (key !== entry.key) fail('invalid-content', `text/${key}`, 'text identity differs from its map key')
    records.set('text/' + key, jsonValue({ metadata: entry.metadata, translations: Object.fromEntries(entry.translations),
      ...(entry.description === undefined ? {} : { description: entry.description }) }, 'text/' + key))
  }
  decodeContent(records)
  return records
}

export function createContent(input: { defaultLanguage: string; metadata?: JsonObject }): StoryContent {
  identifier(input.defaultLanguage, 'defaultLanguage')
  return decodeContent(encodeContent({ format: CONTENT_FORMAT, version: CONTENT_VERSION, metadata: input.metadata ?? {},
    program: { metadata: {}, files: new Map() },
    texts: { metadata: {}, defaultLanguage: input.defaultLanguage,
      languages: new Map([[input.defaultLanguage, { id: input.defaultLanguage, metadata: {} }]]), entries: new Map() } }))
}
