/** Session-owned observations. Only returned draft values and committed edits grant write authority. */
import type { PlaybookContent, ProgramFile, TextEntry } from '@papermoon/playbook-core'
import type { schemas } from './catalog.ts'

type ProgramOperation = ReturnType<typeof schemas.playbook_program_edit.parse>['operations'][number]
type TextOperation = ReturnType<typeof schemas.playbook_text_edit.parse>['operations'][number]
export type DraftToolOperation = ProgramOperation | TextOperation
type Target =
  | { kind: 'file'; path: string }
  | { kind: 'text'; key: string }
  | { kind: 'translation'; key: string; language: string }
  | { kind: 'language'; language: string }
  | { kind: 'program' | 'catalog' | 'default-language' }

/** Object member order does not change an observation; Map keys and values retain their identities. */
function identity(value: unknown): string {
  if (value === undefined) return 'absent'
  if (value instanceof Map) return identity(Object.fromEntries(value))
  if (Array.isArray(value)) return '[' + value.map(identity).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => JSON.stringify(key) + ':' + identity(item)).join(',') + '}'
  return JSON.stringify(value)
}
function key(target: Target): string { return identity(target) }
function value(content: PlaybookContent, target: Target): unknown {
  switch (target.kind) {
    case 'file': return content.program.files.get(target.path)
    case 'text': return content.texts.entries.get(target.key)
    case 'translation': return content.texts.entries.get(target.key)?.translations.get(target.language)
    case 'language': return content.texts.languages.get(target.language)
    case 'program': return content.program.metadata
    case 'catalog': return content.texts.metadata
    case 'default-language': return content.texts.defaultLanguage
  }
}
export class PlaybookObservationError extends Error {
  constructor(readonly code: 'not-observed' | 'observation-stale', target: Target) {
    super(`${code}: read the current draft object before changing it: ${key(target)}`)
  }
}

/** One instance belongs to exactly one live Agent scope and is discarded on unload or resume. */
export class PlaybookObservations {
  private observed = new Map<string, string>()
  private set(target: Target, current: unknown): void { this.observed.set(key(target), identity(current)) }
  file(file: ProgramFile): void { this.set({ kind: 'file', path: file.path }, file) }
  text(entry: TextEntry): void {
    this.set({ kind: 'text', key: entry.key }, entry)
    for (const id of this.observed.keys()) {
      const target = JSON.parse(id) as Target
      if (target.kind === 'translation' && target.key === entry.key && !entry.translations.has(target.language))
        this.set(target, undefined)
    }
    for (const [language, translation] of entry.translations)
      this.translation(entry.key, language, translation)
  }
  translation(textKey: string, language: string, translation: unknown): void {
    this.set({ kind: 'translation', key: textKey, language }, translation)
  }
  status(content: PlaybookContent): void {
    this.set({ kind: 'program' }, content.program.metadata)
    this.set({ kind: 'catalog' }, content.texts.metadata)
    this.set({ kind: 'default-language' }, content.texts.defaultLanguage)
    for (const [language, current] of content.texts.languages)
      this.set({ kind: 'language', language }, current)
  }
  clear(selection?: { kind: 'all' | 'program' | 'catalog' } | { kind: 'file'; path: string } | { kind: 'text'; key: string }): void {
    if (!selection || selection.kind === 'all') { this.observed.clear(); return }
    for (const id of this.observed.keys()) {
      const target = JSON.parse(id) as Target
      const affected = selection.kind === 'program' ? target.kind === 'file' || target.kind === 'program'
        : selection.kind === 'catalog' ? target.kind !== 'file' && target.kind !== 'program'
        : selection.kind === 'file' ? target.kind === 'file' && target.path === selection.path
        : selection.kind === 'text' && (target.kind === 'text' || target.kind === 'translation') && target.key === selection.key
      if (affected) this.observed.delete(id)
    }
  }

  /** Validate a complete batch without changing observations; the receipt runs only after persistence. */
  prepare(content: PlaybookContent, operations: readonly DraftToolOperation[]): (after: PlaybookContent) => void {
    const changed = new Map<string, Target>()
    const mark = (target: Target) => { changed.set(key(target), target) }
    const check = (target: Target, allowAbsent = false) => {
      if (changed.has(key(target))) return
      const current = value(content, target)
      const seen = this.observed.get(key(target))
      if (allowAbsent && current === undefined && seen === undefined) return
      if (seen === undefined) throw new PlaybookObservationError('not-observed', target)
      if (seen !== identity(current)) throw new PlaybookObservationError('observation-stale', target)
    }
    const markTranslation = (target: Extract<Target, { kind: 'translation' }>) => {
      mark(target)
      // A translation-only read must not grant authority over the rest of its entry.
    }
    let clearTexts = false
    for (const op of operations) {
      switch (op.kind) {
        case 'create-file': mark({ kind: 'file', path: op.path }); break
        case 'replace-file': case 'replace-text': case 'delete-file': {
          const target = { kind: 'file' as const, path: op.path }; check(target); mark(target); break
        }
        case 'rename-file': {
          const target = { kind: 'file' as const, path: op.path }; check(target); mark(target)
          mark({ kind: 'file', path: op.to }); break
        }
        case 'create-text': mark({ kind: 'text', key: op.key }); break
        case 'delete-text': case 'set-description': case 'rename-text': {
          const target = { kind: 'text' as const, key: op.key }; check(target); mark(target)
          if (op.kind === 'rename-text') mark({ kind: 'text', key: op.to })
          break
        }
        case 'set-translation': case 'delete-translation': {
          const target = { kind: 'translation' as const, key: op.key, language: op.language }
          if (!changed.has(key({ kind: 'text', key: op.key }))) check(target, op.kind === 'set-translation')
          markTranslation(target); break
        }
        case 'add-language': mark({ kind: 'language', language: op.language }); break
        case 'delete-language': clearTexts = true; mark({ kind: 'language', language: op.language }); break
        case 'set-default-language': { const target = { kind: 'default-language' as const }; check(target); mark(target); break }
        case 'set-metadata': check(op.target); mark(op.target); break
      }
    }
    return after => {
      if (clearTexts) {
        for (const id of this.observed.keys()) {
          const target = JSON.parse(id) as Target
          if (target.kind === 'text' || target.kind === 'translation') this.observed.delete(id)
        }
      }
      for (const target of changed.values()) {
        if (target.kind === 'text') {
          // Remove translations omitted by an entry delete, rename or replacement.
          for (const id of this.observed.keys()) {
            const previous = JSON.parse(id) as Target
            if (previous.kind === 'translation' && previous.key === target.key) this.observed.delete(id)
          }
          const entry = after.texts.entries.get(target.key)
          if (entry !== undefined) this.text(entry)
          else this.observed.delete(key(target))
        } else {
          this.set(target, value(after, target))
          if (target.kind === 'translation') {
            const entryTarget = { kind: 'text' as const, key: target.key }
            // Preserve complete-entry authority only when this batch started with a fresh complete observation.
            if (this.observed.get(key(entryTarget)) === identity(value(content, entryTarget)))
              this.set(entryTarget, value(after, entryTarget))
          }
        }
      }
    }
  }
}
