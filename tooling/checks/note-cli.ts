/** Note mutations validate prepared content before updating owned files. */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { AGENT_NOTE_CLASSES, NOTE_STATES, noteHeadings, chineseHeadings, type NoteState } from './note-types.ts'
import { activeNoteErrors, archiveArtifacts, archiveManifestPath, checkNotes } from './notes.ts'
import { extendArchiveManifest, parseArchiveManifest, renderArchiveManifest, validateArchiveArtifacts } from './archive-format.ts'
import { repoFiles, ownedPath, isArchivedAgentNotePath } from './files.ts'
import { pairPaths, pairRecord, signature } from './pairing.ts'
import { markdownDestination, parseMarkdown, visitMarkdown } from './markdown.ts'

export function template(state: NoteState, title: string, titleZh: string, stem: string, reason = ''): { en: string; zh: string } {
  const status = state === 'rejected' ? `rejected — ${reason}` : state
  const body = (zh: boolean): string => noteHeadings[state].map(h => `## ${zh ? chineseHeadings[h] : h}\n\n<!-- fill -->`).join('\n\n')
  return {
    en: `# Agent Note: ${title}\n\nStatus: ${status}\n\nEnglish | [中文](${stem}.zh.md)\n\n${body(false)}\n`,
    zh: `# Agent Note: ${titleZh}\n\nStatus: ${status}\n\n[English](${stem}.md) | 中文\n\n${body(true)}\n`,
  }
}

function save(root: string, path: string, content: string): void {
  const target = ownedPath(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function freeTargets(root: string, path: string): void {
  for (const value of Object.values(pairPaths(path))) if (existsSync(ownedPath(root, value))) throw new Error(`destination exists: ${value}`)
}

function savePair(root: string, path: string, en: string, zh: string): void {
  const paths = pairPaths(path)
  save(root, paths.en, en); save(root, paths.zh, zh); save(root, paths.meta, pairRecord(path, en, zh))
}

/** Rebase active relative Markdown links without reserializing their prose. */
export function rebaseLinks(content: string, from: string, to: string, moves: Map<string, string>): string {
  const edits: Array<{ start: number; end: number; replacement: string }> = []
  visitMarkdown(parseMarkdown(content), node => {
    if (node.type !== 'link' && node.type !== 'image' && node.type !== 'definition') return
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(node.url)) return
    const [path = '', ...suffix] = node.url.split(/(?=[?#])/)
    const oldTarget = posix.normalize(posix.join(dirname(from), decodeURIComponent(path)))
    const newTarget = moves.get(oldTarget) ?? oldTarget
    if (from === to && newTarget === oldTarget) return
    const destination = markdownDestination(content, node)
    edits.push({ ...destination, replacement: encodeURI(posix.relative(dirname(to), newTarget)) + suffix.join('') })
  })
  for (const edit of edits.sort((a, b) => b.start - a.start)) content = content.slice(0, edit.start) + edit.replacement + content.slice(edit.end)
  return content
}

function updateIncoming(root: string, moves: Map<string, string>, excluded: Set<string>): void {
  const changedSources = new Set<string>()
  for (const path of repoFiles(root).filter(p => p.endsWith('.md') && !isArchivedAgentNotePath(p) && !excluded.has(p))) {
    const content = readFileSync(join(root, path), 'utf8')
    const next = rebaseLinks(content, path, path, moves)
    if (content === next) continue
    save(root, path, next)
    changedSources.add(path.replace(/\.zh\.md$/, '.md'))
  }
  // Only destinations changed. Refresh existing pairing records for those edits.
  for (const path of changedSources) {
    const pair = pairPaths(path)
    if (existsSync(join(root, pair.meta)) && existsSync(join(root, pair.zh))) {
      save(root, pair.meta, pairRecord(path, readFileSync(join(root, path), 'utf8'), readFileSync(join(root, pair.zh), 'utf8')))
    }
  }
}

export function moveNote(root: string, path: string, state: 'implemented' | 'rejected', en: string, zh: string): string {
  if (!path.startsWith('.agents/notes/proposed/')) throw new Error('only proposed Notes may transition; supersede implemented decisions with a new Note')
  const destination = path.replace('/proposed/', `/${state}/`)
  freeTargets(root, destination)
  for (const source of Object.values(pairPaths(path))) readFileSync(ownedPath(root, source))
  const errors = [...activeNoteErrors(destination, en), ...activeNoteErrors(destination, zh, 'zh')]
  if (zh.split('\n')[2] !== en.split('\n')[2] || !/^# Agent Note: \S/.test(zh)) errors.push('translated Note status/title is invalid')
  if (signature(root, destination, en) !== signature(root, destination.replace(/\.md$/, '.zh.md'), zh)) errors.push('prepared bilingual structure differs')
  if (errors.length) throw new Error(errors.join('\n'))
  const old = pairPaths(path); const next = pairPaths(destination)
  const moves = new Map([[old.en, next.en], [old.zh, next.zh]])
  en = rebaseLinks(en, old.en, next.en, moves)
  zh = rebaseLinks(zh, old.zh, next.zh, moves)
  savePair(root, destination, en, zh)
  for (const source of Object.values(old)) rmSync(ownedPath(root, source))
  updateIncoming(root, moves, new Set([next.en, next.zh]))
  return destination
}

export function archiveNote(root: string, path: string, date: string, baseline?: string): string {
  if (!path.startsWith('.agents/notes/implemented/')) throw new Error('only implemented Notes may be archived')
  const existingErrors = checkNotes(root, baseline)
  if (existingErrors.length) throw new Error(existingErrors.join('\n'))
  const nextPath = path.replace('/implemented/', '/archived/')
  freeTargets(root, nextPath)
  const old = pairPaths(path); const next = pairPaths(nextPath)
  const archived = (source: string): string => readFileSync(ownedPath(root, source), 'utf8').replace('Status: implemented\n', `Status: implemented\nArchived: ${date}\n`)
  const en = archived(old.en); const zh = archived(old.zh)
  const meta = pairRecord(nextPath, en, zh)
  const artifacts = archiveArtifacts(root)
  for (const [file, content] of [[next.en, en], [next.zh, zh], [next.meta, meta]]) artifacts.set(file!.slice('.agents/notes/archived/'.length), Buffer.from(content!))
  const errors = validateArchiveArtifacts(artifacts)
  const manifest = parseArchiveManifest(readFileSync(join(root, archiveManifestPath), 'utf8'))
  const sealed = extendArchiveManifest(manifest, artifacts)
  if (errors.length || sealed.errors.length) throw new Error([...errors, ...sealed.errors].join('\n'))
  savePair(root, nextPath, en, zh)
  save(root, archiveManifestPath, renderArchiveManifest(sealed.files))
  for (const source of Object.values(old)) rmSync(ownedPath(root, source))
  updateIncoming(root, new Map([[old.en, next.en], [old.zh, next.zh]]), new Set())
  return nextPath
}

export function main(args: string[], root = process.cwd()): void {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    class: { type: 'string' }, date: { type: 'string' }, slug: { type: 'string' }, title: { type: 'string' },
    'title-zh': { type: 'string' }, status: { type: 'string' }, to: { type: 'string' }, english: { type: 'string' }, chinese: { type: 'string' }, reason: { type: 'string' }, help: { type: 'boolean' },
  } })
  if (values.help) { console.log('note new --class <class> --slug <slug> --title <English> --title-zh <Chinese> [--status proposed|implemented|rejected] [--date YYYY-MM-DD] [--reason text]\nnote transition <English-note.md> --to implemented|rejected --english <prepared.md> --chinese <prepared.zh.md>\nnote archive <English-note.md> [--date YYYY-MM-DD]'); return }
  const [command, path] = positionals
  if (positionals.length > (command === 'new' ? 1 : 2)) throw new Error('unexpected positional arguments')
  const date = values.date ?? new Date().toISOString().slice(0, 10)
  if (command === 'new') {
    const state = values.status ?? 'proposed'
    if (!(NOTE_STATES as readonly string[]).includes(state) || !(AGENT_NOTE_CLASSES as readonly string[]).includes(values.class ?? '') || !/^[a-z0-9][a-z0-9-]*$/.test(values.slug ?? '') || !values.title?.trim() || !values['title-zh']?.trim() || [values.title, values['title-zh'], values.reason].some(v => v?.includes('\n'))) throw new Error('new requires a valid class, slug and single-line bilingual titles')
    if (state === 'rejected' && !values.reason?.trim()) throw new Error('rejected Notes need --reason')
    const stem = `${date}-${values.slug}`
    const target = `.agents/notes/${state}/${values.class}/${stem}.md`
    const pair = template(state as NoteState, values.title, values['title-zh'], stem, values.reason)
    const errors = activeNoteErrors(target, pair.en).filter(e => !e.includes('template is unfinished'))
    if (errors.length) throw new Error(errors.join('\n'))
    freeTargets(root, target); savePair(root, target, pair.en, pair.zh)
    console.log(`${target}\nFill the marked sections and review both languages before recording.`)
  } else if (command === 'transition' && path && (values.to === 'implemented' || values.to === 'rejected') && values.english && values.chinese) {
    console.log(moveNote(root, path, values.to, readFileSync(resolve(root, values.english), 'utf8'), readFileSync(resolve(root, values.chinese), 'utf8')))
  } else if (command === 'archive' && path) {
    console.log(archiveNote(root, path, date, process.env.PAPERMOON_ARCHIVE_BASE_REF))
  } else throw new Error('invalid note command; run pnpm note --help')
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)) } catch (error) { console.error(String(error)); process.exitCode = 1 }
}
