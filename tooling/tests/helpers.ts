import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { git } from '../repository/patches.ts'
import { pairRecord } from '../checks/pairing.ts'
import { template } from '../checks/note-cli.ts'
import type { NoteState } from '../checks/note-types.ts'

export function put(root: string, path: string, content: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
export function fixture(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'papermoon-test-')))
  git(root, ['init', '-q'])
  put(root, '.agents/notes/archived/manifest.json', '{"version":1,"files":{}}\n')
  return root
}
export function commit(root: string): string {
  git(root, ['add', '.'])
  git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture'])
  return git(root, ['rev-parse', 'HEAD']).trim()
}
export function addNote(root: string, state: NoteState = 'implemented', slug = 'decision'): string {
  const stem = `2026-09-11-${slug}`
  const path = `.agents/notes/${state}/process/${stem}.md`
  const pair = template(state, 'A decision', '一项决定', stem, 'A different direction')
  const en = pair.en.replaceAll('<!-- fill -->', 'An explicit maintenance decision.')
  const zh = pair.zh.replaceAll('<!-- fill -->', '一项明确的维护决定。')
  put(root, path, en); put(root, path.replace(/\.md$/, '.zh.md'), zh)
  put(root, path.replace(/\.md$/, '.i18n.yaml'), pairRecord(path, en, zh))
  return path
}
