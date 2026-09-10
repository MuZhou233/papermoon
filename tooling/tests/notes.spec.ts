import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { activeNoteErrors, baselineManifest, checkNotes, archiveArtifacts } from '../checks/notes.ts'
import { archiveNote, main, moveNote, template } from '../checks/note-cli.ts'
import { pairRecord, recordPair } from '../checks/pairing.ts'
import { extendArchiveManifest, renderArchiveManifest } from '../checks/archive-format.ts'
import { addNote, commit, fixture, put } from './helpers.ts'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
const make = (): string => { const root = fixture(); roots.push(root); return root }

describe('Note lifecycle', () => {
  it('checks an unborn repository and rejects an explicitly missing baseline', () => {
    const root = make(); addNote(root)
    expect(checkNotes(root)).toEqual([])
    expect(() => baselineManifest(root, 'missing')).toThrow()
  })
  it('creates all lifecycle templates without pretending their unfinished content is ready', () => {
    const root = make()
    for (const state of ['proposed', 'implemented', 'rejected']) {
      main(['new', '--class', 'process', '--slug', state, '--title', state, '--title-zh', '决定', '--status', state, '--reason', 'Another direction', '--date', '2026-09-11'], root)
    }
    expect(checkNotes(root).filter(e => e.includes('unfinished'))).toHaveLength(6)
    expect(() => main(['new', '--class', 'wrong', '--slug', 'x', '--title', 'X', '--title-zh', '文'], root)).toThrow()
  })
  it('validates prepared implementation and rewrites active references in both languages', () => {
    const root = make(); const path = addNote(root, 'proposed')
    put(root, 'README.md', `# Reference\n\n[Decision](${path})\n`)
    const stem = '2026-09-11-decision'
    const pair = template('implemented', 'A decision', '一项决定', stem)
    expect(() => moveNote(root, path, 'implemented', pair.en, pair.zh)).toThrow(/unfinished/)
    expect(existsSync(join(root, path))).toBe(true)
    const next = moveNote(root, path, 'implemented', pair.en.replaceAll('<!-- fill -->', 'The selected option.'), pair.zh.replaceAll('<!-- fill -->', '选定的方案。'))
    expect(existsSync(join(root, path))).toBe(false)
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain(next)
    expect(checkNotes(root)).toEqual([])
    expect(() => moveNote(root, next, 'rejected', '', '')).toThrow(/only proposed/)
  })
  it('requires a rejection reason and detects invalid classes, dates, statuses and orphan artifacts', () => {
    const root = make(); const path = addNote(root, 'rejected')
    const text = readFileSync(join(root, path), 'utf8')
    expect(activeNoteErrors(path, text.replace('Status: rejected — A different direction', 'Status: rejected')).join()).toContain('status')
    expect(activeNoteErrors(path.replace('/process/', '/wrong/'), text).join()).toContain('class')
    expect(activeNoteErrors(path.replace('2026-09-11', '2026-02-30'), text).join()).toContain('date')
    const chinese = readFileSync(join(root, path.replace(/\.md$/, '.zh.md')), 'utf8')
    expect(activeNoteErrors(path, chinese.replace('## 问题', '## 随意标题'), 'zh').join()).toContain('Problem')
    rmSync(join(root, path))
    expect(checkNotes(root).join()).toContain('orphan')
  })
  it('freezes a complete archive and detects rewriting both content and its seals', () => {
    const root = make(); const path = addNote(root); commit(root)
    const original = readFileSync(join(root, path), 'utf8')
    const archived = archiveNote(root, path, '2026-09-11')
    expect(readFileSync(join(root, archived), 'utf8')).toBe(original.replace('Status: implemented\n', 'Status: implemented\nArchived: 2026-09-11\n'))
    expect(checkNotes(root)).toEqual([])
    const sealedCommit = commit(root)
    expect(() => recordPair(root, archived)).toThrow(/archived/)
    const en = readFileSync(join(root, archived), 'utf8').replace('maintenance decision', 'different decision')
    const zh = readFileSync(join(root, archived.replace(/\.md$/, '.zh.md')), 'utf8')
    writeFileSync(join(root, archived), en)
    put(root, archived.replace(/\.md$/, '.i18n.yaml'), pairRecord(archived, en, zh))
    const forged = extendArchiveManifest({ version: 1, files: {} }, archiveArtifacts(root))
    put(root, '.agents/notes/archived/manifest.json', renderArchiveManifest(forged.files))
    expect(checkNotes(root, sealedCommit).join()).toContain('sealed manifest hash changed')
    put(root, '.agents/notes/archived/manifest.json', '{"version":1,"files":{}}\n')
    expect(checkNotes(root, sealedCommit).join()).toContain('sealed manifest entry is missing')
  })
  it('rejects proposed archival, invalid archive dates and stale pairs without deleting sources', () => {
    const root = make(); const proposed = addNote(root, 'proposed'); const implemented = addNote(root, 'implemented', 'second')
    expect(() => archiveNote(root, proposed, '2026-09-11')).toThrow(/only implemented/)
    expect(() => archiveNote(root, implemented, '2026-02-30')).toThrow(/date/)
    expect(existsSync(join(root, implemented))).toBe(true)
    put(root, implemented, readFileSync(join(root, implemented), 'utf8') + 'A change.\n')
    expect(() => archiveNote(root, implemented, '2026-09-11')).toThrow(/hash/)
  })
})
