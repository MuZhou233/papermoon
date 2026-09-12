/** Ordered in-memory edits validate their final content before returning a detached candidate. */
import type { JsonObject } from './model.ts'
import type { ContentOperation, StoryContent, RestoreSelection, TextEntry } from './model.ts'
import { copyMetadata, decodeContent, encodeContent, filePath, identifier } from './codec.ts'
import { fail } from './error.ts'

export function requireItem<T>(items: ReadonlyMap<string, T>, key: string, location: string): T {
  const value = items.get(key)
  if (value === undefined) fail('not-found', location, 'object does not exist')
  return value
}
function requireAbsent(items: ReadonlyMap<string, unknown>, key: string, location: string): void {
  if (items.has(key)) fail('already-exists', location, 'object already exists')
}
function impossible(value: never): never { return fail('invalid-input', 'operation', `unknown operation: ${String(value)}`) }

export function applyOperations(content: StoryContent, operations: readonly ContentOperation[]): StoryContent {
  const original = decodeContent(encodeContent(content))
  let metadata = original.metadata, programMetadata = original.program.metadata, catalogMetadata = original.texts.metadata
  let defaultLanguage = original.texts.defaultLanguage
  const files = new Map(original.program.files), languages = new Map(original.texts.languages), entries = new Map(original.texts.entries)
  const entry = (key: string) => requireItem(entries, key, 'text/' + key)
  const updateTranslationMetadata = (key: string, language: string, body: JsonObject) => {
    const current = entry(key), translations = new Map(current.translations)
    const translation = requireItem(translations, language, `text/${key}/${language}`)
    translations.set(language, { ...translation, metadata: body }); entries.set(key, { ...current, translations })
  }
  for (const operation of operations) {
    switch (operation.kind) {
      case 'create-file':
        filePath(operation.path); requireAbsent(files, operation.path, 'program/' + operation.path)
        files.set(operation.path, { path: operation.path, source: operation.source, metadata: operation.metadata ?? {} })
        break
      case 'replace-file':
        files.set(operation.path, { ...requireItem(files, operation.path, 'program/' + operation.path), source: operation.source })
        break
      case 'delete-file':
        requireItem(files, operation.path, 'program/' + operation.path); files.delete(operation.path)
        break
      case 'rename-file': {
        filePath(operation.to)
        const file = requireItem(files, operation.path, 'program/' + operation.path)
        if (operation.to !== operation.path) requireAbsent(files, operation.to, 'program/' + operation.to)
        files.delete(operation.path); files.set(operation.to, { ...file, path: operation.to })
        break
      }
      case 'add-language':
        identifier(operation.language, 'language'); requireAbsent(languages, operation.language, 'language/' + operation.language)
        languages.set(operation.language, { id: operation.language, metadata: operation.metadata ?? {} })
        break
      case 'delete-language':
        requireItem(languages, operation.language, 'language/' + operation.language); languages.delete(operation.language)
        for (const [key, current] of entries) {
          const translations = new Map(current.translations); translations.delete(operation.language)
          entries.set(key, { ...current, translations })
        }
        break
      case 'set-default-language': defaultLanguage = operation.language; break
      case 'create-text':
        identifier(operation.key, 'text'); requireAbsent(entries, operation.key, 'text/' + operation.key)
        entries.set(operation.key, { key: operation.key, metadata: operation.metadata ?? {}, translations: new Map(),
          ...(operation.description === undefined ? {} : { description: operation.description }) })
        break
      case 'delete-text': entry(operation.key); entries.delete(operation.key); break
      case 'rename-text': {
        identifier(operation.to, 'text')
        const current = entry(operation.key)
        if (operation.to !== operation.key) requireAbsent(entries, operation.to, 'text/' + operation.to)
        entries.delete(operation.key); entries.set(operation.to, { ...current, key: operation.to })
        break
      }
      case 'set-description': {
        const current = entry(operation.key)
        entries.set(operation.key, { key: current.key, metadata: current.metadata, translations: current.translations,
          ...(operation.description === null ? {} : { description: operation.description }) })
        break
      }
      case 'set-translation': {
        identifier(operation.language, 'language')
        const current = entry(operation.key), translations = new Map(current.translations)
        translations.set(operation.language, { text: operation.text, metadata: operation.metadata ?? translations.get(operation.language)?.metadata ?? {} })
        entries.set(operation.key, { ...current, translations })
        break
      }
      case 'delete-translation': {
        const current = entry(operation.key), translations = new Map(current.translations)
        requireItem(translations, operation.language, `text/${operation.key}/${operation.language}`)
        translations.delete(operation.language); entries.set(operation.key, { ...current, translations })
        break
      }
      case 'set-metadata': {
        const target = operation.target, body = copyMetadata(operation.metadata, 'metadata')
        switch (target.kind) {
          case 'content': metadata = body; break
          case 'program': programMetadata = body; break
          case 'catalog': catalogMetadata = body; break
          case 'file': files.set(target.path, { ...requireItem(files, target.path, 'program/' + target.path), metadata: body }); break
          case 'language': languages.set(target.language, { ...requireItem(languages, target.language, 'language/' + target.language), metadata: body }); break
          case 'text': entries.set(target.key, { ...entry(target.key), metadata: body }); break
          case 'translation': updateTranslationMetadata(target.key, target.language, body); break
          default: impossible(target)
        }
        break
      }
      default: impossible(operation)
    }
  }
  return decodeContent(encodeContent({ ...original, metadata, program: { metadata: programMetadata, files },
    texts: { metadata: catalogMetadata, defaultLanguage, languages, entries } }))
}

/** Partial restoration keeps unrelated content; it never infers new language registrations. */
export function restoreContent(target: StoryContent, source: StoryContent, selection: RestoreSelection): StoryContent {
  const left = decodeContent(encodeContent(target)), right = decodeContent(encodeContent(source))
  let candidate: StoryContent
  switch (selection.kind) {
    case 'all': candidate = right; break
    case 'program': candidate = { ...left, program: right.program }; break
    case 'catalog': candidate = { ...left, texts: right.texts }; break
    case 'file': {
      const files = new Map(left.program.files)
      files.set(selection.path, requireItem(right.program.files, selection.path, 'program/' + selection.path))
      candidate = { ...left, program: { ...left.program, files } }; break
    }
    case 'text': {
      const entries = new Map<string, TextEntry>(left.texts.entries)
      entries.set(selection.key, requireItem(right.texts.entries, selection.key, 'text/' + selection.key))
      candidate = { ...left, texts: { ...left.texts, entries } }; break
    }
    default: return impossible(selection)
  }
  return decodeContent(encodeContent(candidate))
}
