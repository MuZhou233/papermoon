/** Snapshot queries use exact language identities and stable UTF-8 key ordering. */
import type { ContentPageOptions, ContentPage, PlaybookContent, TranslationLookup, TextSearch, SearchMatch, ProgramMatch, TextMatch } from './model.ts'
import { fail } from './error.ts'
import { requireItem } from './operations.ts'

const encoder = new TextEncoder()
export function binaryCompare(left: string, right: string): number {
  const a = encoder.encode(left), b = encoder.encode(right)
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!
  return a.length - b.length
}
export function pageLimit(options: ContentPageOptions): number {
  const limit = options.limit ?? 100
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) fail('invalid-input', 'limit', 'page limit must be an integer from 1 to 1000')
  return limit
}
export function pageItems<T>(items: Iterable<T>, key: (value: T) => string, options: ContentPageOptions = {}): ContentPage<T> {
  const limit = pageLimit(options)
  const ordered = [...items].filter(item => options.after === undefined || binaryCompare(key(item), options.after) > 0).sort((a, b) => binaryCompare(key(a), key(b)))
  const page = ordered.slice(0, limit)
  return { items: page, ...(ordered.length > limit ? { next: key(page.at(-1)!) } : {}) }
}
export function readFile(content: PlaybookContent, path: string) { return requireItem(content.program.files, path, 'program/' + path) }
export function readText(content: PlaybookContent, key: string) { return requireItem(content.texts.entries, key, 'text/' + key) }
export function readLanguage(content: PlaybookContent, language: string) { return requireItem(content.texts.languages, language, 'language/' + language) }
export function listFiles(content: PlaybookContent, options: ContentPageOptions = {}) { return pageItems(content.program.files.values(), file => file.path, options) }
export function listTexts(content: PlaybookContent, options: ContentPageOptions = {}) { return pageItems(content.texts.entries.values(), entry => entry.key, options) }
export function listLanguages(content: PlaybookContent, options: ContentPageOptions = {}) { return pageItems(content.texts.languages.values(), language => language.id, options) }
export function lookupTranslation(content: PlaybookContent, key: string, language: string): TranslationLookup {
  if (!content.texts.languages.has(language)) return { kind: 'missing', reason: 'language' }
  const entry = content.texts.entries.get(key)
  if (!entry) return { kind: 'missing', reason: 'entry' }
  const translation = entry.translations.get(language)
  return translation ? { kind: 'found', translation } : { kind: 'missing', reason: 'translation' }
}
export function listMissingTranslations(content: PlaybookContent, language: string, options: ContentPageOptions = {}) {
  readLanguage(content, language)
  return pageItems([...content.texts.entries.values()].filter(entry => !entry.translations.has(language)), entry => entry.key, options)
}
/** Match offsets are non-overlapping UTF-16 offsets in the original string. */
function offsets(text: string, query: string): number[] {
  const results: number[] = []
  for (let index = text.indexOf(query); index !== -1; index = text.indexOf(query, index + query.length)) results.push(index)
  return results
}
function queryText(query: string): void { if (!query.length) fail('invalid-input', 'query', 'search text must not be empty') }
export function searchProgram(content: PlaybookContent, query: string, options: ContentPageOptions = {}): ContentPage<ProgramMatch> {
  queryText(query)
  const matches: ProgramMatch[] = []
  for (const file of content.program.files.values()) {
    const found = offsets(file.source, query)
    if (found.length) matches.push({ path: file.path, matches: [{ field: 'source', offsets: found }] })
  }
  return pageItems(matches, result => result.path, options)
}
export function searchTexts(content: PlaybookContent, search: TextSearch, options: ContentPageOptions = {}): ContentPage<TextMatch> {
  queryText(search.query)
  if (search.language !== undefined) readLanguage(content, search.language)
  const fields = search.fields ?? ['key', 'description', 'translation']
  const results: TextMatch[] = []
  for (const entry of content.texts.entries.values()) {
    const matches: SearchMatch[] = []
    const add = (text: string, field: SearchMatch['field'], language?: string) => {
      const found = offsets(text, search.query)
      if (found.length) matches.push({ field, offsets: found, ...(language === undefined ? {} : { language }) })
    }
    if (fields.includes('key')) add(entry.key, 'key')
    if (fields.includes('description') && entry.description !== undefined) add(entry.description, 'description')
    if (fields.includes('translation')) for (const [language, translation] of [...entry.translations].sort(([a], [b]) => binaryCompare(a, b))) {
      if (search.language === undefined || search.language === language) add(translation.text, 'translation', language)
    }
    if (matches.length) results.push({ key: entry.key, matches })
  }
  return pageItems(results, result => result.key, options)
}
