import { describe, expect, it } from 'vitest'
import type { MetadataTarget, PlaybookContent } from '../src/index.ts'
import { applyOperations, createContent, decodeContent, encodeContent, listMissingTranslations, lookupTranslation, readFile, readText, restoreContent, searchProgram, searchTexts, listFiles, listTexts } from '../src/index.ts'
import { station, workshop } from './fixtures.ts'

const rejects = (code: string, body: () => unknown) => expect(body).toThrow(expect.objectContaining({ code }))
describe('authored content', () => {
  it('creates a structurally complete empty document without source or translation requirements', () => {
    const content = createContent({ defaultLanguage: 'zh-CN' })
    expect(content.program.files.size).toBe(0)
    expect(content.texts.entries.size).toBe(0)
    expect(content.texts.languages.get('zh-CN')).toEqual({ id: 'zh-CN', metadata: {} })
    expect(decodeContent(encodeContent(content))).toEqual(content)
    rejects('invalid-input', () => createContent({ defaultLanguage: '' }))
  })
  it('round-trips independent file/text organizations and preserves source, metadata and Unicode', () => {
    for (const initial of [station(), workshop()]) {
      const content = applyOperations(initial, [{ kind: 'create-file', path: '原文', source: '\r\n\ud800\0\n' }])
      expect(decodeContent(encodeContent(content))).toEqual(content)
      expect(readFile(content, '原文').source).toBe('\r\n\ud800\0\n')
    }
  })
  it('detaches candidates and metadata without modifying input snapshots', () => {
    const content = station(), metadata = { tags: ['first'] }
    const result = applyOperations(content, [
      { kind: 'replace-file', path: 'entry.mjs', source: '' },
      { kind: 'set-metadata', target: { kind: 'content' }, metadata },
    ])
    metadata.tags.push('later')
    expect(content.metadata).toEqual({ kind: 'station' })
    expect(readFile(content, 'entry.mjs').source).toContain('unfinished')
    expect(result.metadata).toEqual({ tags: ['first'] })
    const records = new Map(encodeContent(content))
    ;(records.get('content') as { metadata: { kind: string } }).metadata.kind = 'changed'
    expect(content.metadata).toEqual({ kind: 'station' })
  })
  it('replaces metadata for every authored entity and preserves it across renames', () => {
    let content = station()
    const targets: MetadataTarget[] = [{ kind: 'content' }, { kind: 'program' }, { kind: 'catalog' }, { kind: 'file', path: 'entry.mjs' },
      { kind: 'language', language: 'en' }, { kind: 'text', key: 'greeting' }, { kind: 'translation', key: 'greeting', language: 'en' }]
    for (const target of targets) content = applyOperations(content, [{ kind: 'set-metadata', target, metadata: { only: target.kind } }])
    expect(content.metadata).toEqual({ only: 'content' })
    expect(content.program.metadata).toEqual({ only: 'program' })
    expect(content.texts.metadata).toEqual({ only: 'catalog' })
    expect(content.texts.languages.get('en')?.metadata).toEqual({ only: 'language' })
    content = applyOperations(content, [{ kind: 'rename-file', path: 'entry.mjs', to: 'main.js' }, { kind: 'rename-text', key: 'greeting', to: 'welcome' }])
    expect(readFile(content, 'main.js').metadata).toEqual({ only: 'file' })
    expect(readText(content, 'welcome').metadata).toEqual({ only: 'text' })
    expect(readText(content, 'welcome').translations.get('en')?.metadata).toEqual({ only: 'translation' })
    expect(readFile(content, 'main.js').source).toContain('t("greeting")')
  })
  it('rejects noncanonical paths and file/directory collisions without imposing an extension', () => {
    const content = createContent({ defaultLanguage: 'x' })
    for (const path of ['', '/root', 'C:/root', 'c:root', 'a\\b', 'a//b', './a', 'a/..', 'a/', 'a\0', '\ud800']) {
      rejects('invalid-input', () => applyOperations(content, [{ kind: 'create-file', path, source: '' }]))
    }
    rejects('invalid-content', () => applyOperations(content, [{ kind: 'create-file', path: 'a', source: '' }, { kind: 'create-file', path: 'a/b', source: '' }]))
    const valid = applyOperations(content, [{ kind: 'create-file', path: 'a', source: '' }, { kind: 'create-file', path: 'a/b', source: '' }, { kind: 'delete-file', path: 'a' }])
    expect(listFiles(valid).items.map(file => file.path)).toEqual(['a/b'])
    const cased = applyOperations(valid, [{ kind: 'create-file', path: 'A', source: '' }])
    expect(cased.program.files.size).toBe(2)
    rejects('already-exists', () => applyOperations(cased, [{ kind: 'rename-file', path: 'A', to: 'a/b' }]))
    rejects('not-found', () => applyOperations(cased, [{ kind: 'delete-file', path: 'missing' }]))
  })
  it('requires known formats and complete records rather than repairing data', () => {
    const records = new Map(encodeContent(station()))
    for (const invalid of [new Map(), new Map([...records].filter(([key]) => key !== 'content')),
      new Map(records).set('unexpected', {}),
      new Map(records).set('program/bad', { source: 'valid' }), new Map(records).set('text/bad', { metadata: {}, translations: { en: { text: 1, metadata: {} } } }),
      new Map(records).set('language/en', { metadata: {}, unknown: 1 }),
      new Map(records).set('text/bad', { metadata: {}, translations: { unknown: { text: '', metadata: {} } } })]) {
      rejects('invalid-content', () => decodeContent(invalid))
    }
    const noDefault = new Map(records); noDefault.delete('language/zh-CN')
    rejects('invalid-content', () => decodeContent(noDefault))
  })
  it('validates metadata JSON without evaluating accessors or accepting lossy values', () => {
    const accessor = Object.defineProperty({}, 'unsafe', { enumerable: true, get() { throw new Error('must not run') } })
    const cycle: Record<string, unknown> = {}; cycle.self = cycle
    for (const metadata of [NaN, [], { value: undefined }, accessor, cycle]) {
      rejects('invalid-content', () => createContent({ defaultLanguage: 'x', metadata: metadata as PlaybookContent['metadata'] }))
    }
    const special = applyOperations(createContent({ defaultLanguage: '__proto__' }), [
      { kind: 'create-text', key: '__proto__' }, { kind: 'set-translation', key: '__proto__', language: '__proto__', text: 'literal' },
    ])
    expect(lookupTranslation(decodeContent(encodeContent(special)), '__proto__', '__proto__')).toMatchObject({ kind: 'found', translation: { text: 'literal' } })
  })
})

describe('languages, restoration and search', () => {
  it('distinguishes empty translations and each missing reason without fallback', () => {
    const content = station()
    expect(lookupTranslation(content, 'alarm', 'zh-CN')).toMatchObject({ kind: 'found', translation: { text: '' } })
    expect(lookupTranslation(content, 'alarm', 'en')).toEqual({ kind: 'missing', reason: 'translation' })
    expect(lookupTranslation(content, 'missing', 'en')).toEqual({ kind: 'missing', reason: 'entry' })
    for (const language of ['zh', 'ZH-CN', 'unknown']) expect(lookupTranslation(content, 'greeting', language)).toEqual({ kind: 'missing', reason: 'language' })
    expect(listMissingTranslations(content, 'en').items.map(entry => entry.key)).toEqual(['alarm'])
  })
  it('changes language registrations atomically and deletes only that language’s translations', () => {
    const content = station()
    rejects('invalid-content', () => applyOperations(content, [{ kind: 'delete-language', language: 'zh-CN' }]))
    const updated = applyOperations(content, [{ kind: 'delete-language', language: 'zh-CN' }, { kind: 'set-default-language', language: 'en' }])
    expect(updated.texts.defaultLanguage).toBe('en')
    expect(readText(updated, 'alarm').translations.size).toBe(0)
    expect(readText(updated, 'greeting').translations.size).toBe(1)
    rejects('invalid-content', () => applyOperations(updated, [{ kind: 'delete-language', language: 'en' }]))
    const deferred = applyOperations(updated, [{ kind: 'set-translation', key: 'alarm', language: 'fr', text: 'Alarme' }, { kind: 'add-language', language: 'fr' }])
    expect(lookupTranslation(deferred, 'alarm', 'fr')).toMatchObject({ kind: 'found' })
  })
  it('edits usage descriptions and translations without resetting unrelated metadata', () => {
    const initial = station()
    const content = applyOperations(initial, [{ kind: 'set-description', key: 'greeting', description: '' }, { kind: 'set-translation', key: 'greeting', language: 'zh-CN', text: '修改' }])
    expect(readText(content, 'greeting').description).toBe('')
    expect(readText(content, 'greeting').translations.get('zh-CN')?.metadata).toEqual({ reviewed: true })
    const removed = applyOperations(content, [{ kind: 'set-description', key: 'greeting', description: null }, { kind: 'delete-translation', key: 'greeting', language: 'en' }, { kind: 'delete-text', key: 'alarm' }])
    expect(readText(removed, 'greeting').description).toBeUndefined()
    expect(listTexts(removed).items).toHaveLength(1)
  })
  it('restores selected content and metadata, rejecting missing objects and implicit languages', () => {
    const original = station(), other = workshop()
    expect(restoreContent(other, original, { kind: 'all' })).toEqual(original)
    const program = restoreContent(other, original, { kind: 'program' })
    expect(program.program).toEqual(original.program); expect(program.texts).toEqual(other.texts)
    const catalog = restoreContent(other, original, { kind: 'catalog' })
    expect(catalog.texts).toEqual(original.texts); expect(catalog.program).toEqual(other.program)
    expect(readFile(restoreContent(other, original, { kind: 'file', path: 'entry.mjs' }), 'entry.mjs')).toEqual(readFile(original, 'entry.mjs'))
    rejects('invalid-content', () => restoreContent(other, original, { kind: 'text', key: 'greeting' }))
    const prepared = applyOperations(other, [{ kind: 'add-language', language: 'zh-CN' }, { kind: 'add-language', language: 'en' }])
    expect(readText(restoreContent(prepared, original, { kind: 'text', key: 'greeting' }), 'greeting')).toEqual(readText(original, 'greeting'))
    rejects('not-found', () => restoreContent(other, original, { kind: 'file', path: 'absent' }))
  })
  it('returns literal source offsets and text fields in grouped, stable pages', () => {
    const content = station()
    expect(searchProgram(content, 'export').items).toHaveLength(2)
    expect(searchProgram(content, 'export').items[0]?.matches[0]?.offsets).toEqual([0])
    const match = searchTexts(content, { query: 'greeting' })
    expect(match.items[0]?.matches.map(hit => hit.field)).toEqual(['key', 'description'])
    expect(searchTexts(content, { query: 'Hello', language: 'en' }).items[0]?.matches[0]).toMatchObject({ field: 'translation', language: 'en', offsets: [0] })
    expect(searchTexts(content, { query: '你好', language: 'en' }).items).toEqual([])
    const page = listTexts(content, { limit: 1 })
    expect(listTexts(content, { after: page.next, limit: 1 }).items.map(entry => entry.key)).toEqual(['greeting'])
    rejects('invalid-input', () => searchProgram(content, ''))
    rejects('invalid-input', () => listTexts(content, { limit: 0 }))
    const unicode = applyOperations(createContent({ defaultLanguage: 'x' }), ['😀', '\ue000', '中'].map(path => ({ kind: 'create-file' as const, path, source: '' })))
    expect(listFiles(unicode).items.map(file => file.path)).toEqual(['中', '\ue000', '😀'])
  })
})
