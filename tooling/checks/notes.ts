/** Active Note rules and frozen-archive checks against a trusted Git baseline. */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoFiles, isArchivedAgentNotePath } from './files.ts'
import { AGENT_NOTE_CLASSES, noteHeadings, chineseHeadings, type NoteState } from './note-types.ts'
import { markdownHeadingLines } from './markdown.ts'
import { checkPair } from './pairing.ts'
import { parseArchiveManifest, validateArchiveArtifacts, validateArchiveManifestExtension, extendArchiveManifest, type ArchiveManifest } from './archive-format.ts'

export const archiveManifestPath = '.agents/notes/archived/manifest.json'
const emptyManifest = (): ArchiveManifest => ({ version: 1, files: {} })

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr.trim())
  return result.stdout
}

export function baselineManifest(root: string, baseline?: string): ArchiveManifest {
  const probe = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' })
  if (!baseline && probe.status !== 0) {
    git(root, ['rev-parse', '--git-dir'])
    const symbolic = git(root, ['symbolic-ref', '-q', 'HEAD']).trim()
    const unborn = spawnSync('git', ['show-ref', '--verify', '--quiet', symbolic], { cwd: root })
    if (unborn.status !== 1) throw new Error('cannot establish an unborn repository')
    return emptyManifest()
  }
  const ref = baseline ?? 'HEAD'
  git(root, ['cat-file', '-e', `${ref}^{commit}`])
  if (!git(root, ['ls-tree', '--name-only', ref, '--', archiveManifestPath]).trim()) return emptyManifest()
  return parseArchiveManifest(git(root, ['show', `${ref}:${archiveManifestPath}`]))
}

export function activeNoteErrors(path: string, content: string, locale: 'en' | 'zh' = 'en'): string[] {
  const errors: string[] = []
  const match = /^\.agents\/notes\/(proposed|implemented|rejected)\/([^/]+)\/(\d{4}-\d{2}-\d{2})-[a-z0-9][a-z0-9-]*\.md$/.exec(path)
  if (!match) return [`${path}: expected lifecycle/class/YYYY-MM-DD-topic.md`]
  const state = match[1] as NoteState
  if (!(AGENT_NOTE_CLASSES as readonly string[]).includes(match[2]!)) errors.push(`${path}: unknown Note class`)
  const date = new Date(`${match[3]}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[3]) errors.push(`${path}: invalid proposal date`)
  const lines = content.split('\n')
  if (!/^# Agent Note: \S/.test(lines[0] ?? '') || lines[1] !== '') errors.push(`${path}: invalid Note title header`)
  const status = lines[2] ?? ''
  if (state === 'rejected' ? !/^Status: rejected — \S/.test(status) : status !== `Status: ${state}`) errors.push(`${path}: status does not match lifecycle`)
  const headings = markdownHeadingLines(content).filter(h => h.depth === 2).map(h => h.text)
  const translated = (heading: string): string => locale === 'zh' ? chineseHeadings[heading] ?? heading : heading
  if (headings[0] !== translated('Problem')) errors.push(`${path}: first section must be Problem`)
  for (const heading of noteHeadings[state]) if (!headings.includes(translated(heading))) errors.push(`${path}: missing ${heading}`)
  if (state === 'implemented' && headings.some(h => ['Proposal', 'Plan', 'Migration plan', 'Acceptance criteria'].map(translated).includes(h))) errors.push(`${path}: implemented Note contains proposal sections`)
  if (content.includes('<!-- fill -->')) errors.push(`${path}: template is unfinished`)
  return errors
}

export function archiveArtifacts(root: string): Map<string, Buffer> {
  return new Map(repoFiles(root).filter(isArchivedAgentNotePath).map(path => [path.slice('.agents/notes/archived/'.length), readFileSync(join(root, path))]))
}

export function checkNotes(root: string, baseline?: string): string[] {
  const errors: string[] = []
  for (const path of repoFiles(root).filter(p => p.startsWith('.agents/notes/'))) {
    if (isArchivedAgentNotePath(path) || path === archiveManifestPath || /\/(?:README(?:\.zh)?\.md|README\.i18n\.yaml|AGENTS\.md)$/.test(path)) continue
    if (!/^\.agents\/notes\/(proposed|implemented|rejected)\//.test(path)) { errors.push(`${path}: unrecognized Note lifecycle`); continue }
    if (path.endsWith('.zh.md') || path.endsWith('.i18n.yaml')) {
      const en = path.replace(/(?:\.zh\.md|\.i18n\.yaml)$/, '.md')
      if (!existsSync(join(root, en))) errors.push(`${path}: orphan bilingual artifact`)
      continue
    }
    if (!path.endsWith('.md')) { errors.push(`${path}: unexpected Note artifact`); continue }
    const content = readFileSync(join(root, path), 'utf8')
    errors.push(...activeNoteErrors(path, content), ...checkPair(root, path))
    const zhPath = path.replace(/\.md$/, '.zh.md')
    if (existsSync(join(root, zhPath))) {
      const translatedContent = readFileSync(join(root, zhPath), 'utf8')
      errors.push(...activeNoteErrors(path, translatedContent, 'zh').map(error => error.replace(path, zhPath)))
      const zhHeader = translatedContent.split('\n')
      if (!/^# Agent Note: \S/.test(zhHeader[0] ?? '') || zhHeader[2] !== content.split('\n')[2]) errors.push(`${zhPath}: translated header/status differs`)
    }
  }
  try {
    const current = parseArchiveManifest(readFileSync(join(root, archiveManifestPath), 'utf8'))
    errors.push(...validateArchiveManifestExtension(baselineManifest(root, baseline), current))
    const artifacts = archiveArtifacts(root)
    errors.push(...validateArchiveArtifacts(artifacts))
    const extended = extendArchiveManifest(current, artifacts)
    errors.push(...extended.errors, ...extended.added.map(path => `${path}: archive artifact is not sealed`))
  } catch (error) { errors.push(`archive: ${String(error)}`) }
  return errors
}
