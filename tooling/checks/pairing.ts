/** Bilingual content records and structural comparison, independent of DSH. */
import { basename, dirname, join, posix } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { load, dump } from 'js-yaml'
import { gitBlobHash } from './archive-format.ts'
import { object, ownedPath } from './files.ts'
import { parseMarkdown, visitMarkdown } from './markdown.ts'
import { documentAnchors } from './links.ts'
import { markdownHeadingLines } from './markdown.ts'

export function pairPaths(source: string): { en: string; zh: string; meta: string } {
  if (!source.endsWith('.md') || source.endsWith('.zh.md')) throw new Error('pair source must be an English .md file')
  return { en: source, zh: source.replace(/\.md$/, '.zh.md'), meta: source.replace(/\.md$/, '.i18n.yaml') }
}

export function pairRecord(source: string, en: string, zh: string): string {
  const paths = pairPaths(source)
  return dump({ [basename(paths.en)]: gitBlobHash(Buffer.from(en)), [basename(paths.zh)]: gitBlobHash(Buffer.from(zh)) }, { sortKeys: true })
}

function canonicalLink(root: string, file: string, url: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url)) return url
  const [target = '', fragment] = url.split('#')
  const queryIndex = target.indexOf('?')
  const query = queryIndex < 0 ? '' : target.slice(queryIndex)
  const path = (queryIndex < 0 ? target : target.slice(0, queryIndex)) || basename(file)
  const resolved = posix.normalize(posix.join(dirname(file), decodeURIComponent(path)))
  const canonical = resolved.replace(/\.zh\.md$/, '.md') + query
  if (!fragment) return canonical
  const absolute = join(root, resolved)
  if (!existsSync(absolute) || !resolved.endsWith('.md')) return `${canonical}#${fragment}`
  const content = readFileSync(absolute, 'utf8')
  const anchors = [...documentAnchors(content)]
  const headingCount = markdownHeadingLines(content).length
  const index = anchors.indexOf(decodeURIComponent(fragment))
  return `${canonical}#${index >= 0 && index < headingCount ? `heading-${index}` : fragment}`
}

/** Compare structure and literal technical content, not translation quality. */
export function signature(root: string, file: string, content: string): string {
  const result: unknown[] = []
  const ownEn = file.replace(/\.zh\.md$/, '.md')
  visitMarkdown(parseMarkdown(content), node => {
    switch (node.type) {
      case 'heading': result.push(['heading', node.depth]); break
      case 'list': result.push(['list', node.ordered, node.start, node.children.length]); break
      case 'table': result.push(['table', node.children.map(row => row.children.length)]); break
      case 'code': result.push(['code', node.lang, node.meta, node.value]); break
      case 'inlineCode': result.push(['inline', node.value]); break
      case 'link': case 'image': case 'definition': {
        const value = canonicalLink(root, file, node.url)
        if (value !== ownEn) result.push([node.type, value])
        break
      }
      default: break
    }
  })
  return JSON.stringify(result)
}

export function checkPair(root: string, source: string, checkHashes = true): string[] {
  const { en, zh, meta } = pairPaths(source)
  const errors: string[] = []
  for (const file of [en, zh, meta]) if (!existsSync(ownedPath(root, file))) errors.push(`${file}: missing bilingual artifact`)
  if (errors.length) return errors
  const english = readFileSync(join(root, en), 'utf8')
  const chinese = readFileSync(join(root, zh), 'utf8')
  if (!english.includes(`English | [中文](${basename(zh)})`)) errors.push(`${en}: missing language switcher`)
  if (!chinese.includes(`[English](${basename(en)}) | 中文`)) errors.push(`${zh}: missing language switcher`)
  if (signature(root, en, english) !== signature(root, zh, chinese)) errors.push(`${source}: bilingual structure, code, or links differ`)
  if (checkHashes) {
    try {
      const record = object(load(readFileSync(join(root, meta), 'utf8')), meta)
      const expected = object(load(pairRecord(source, english, chinese)), meta)
      if (Object.keys(record).length !== 2 || Object.entries(expected).some(([key, hash]) => record[key] !== hash)) {
        errors.push(`${meta}: stale bilingual hashes; review both sides before recording`)
      }
    } catch (error) { errors.push(`${meta}: ${String(error)}`) }
  }
  return errors
}

export function recordPair(root: string, source: string): void {
  if (source.startsWith('.agents/notes/archived/')) throw new Error('archived pairs cannot be recorded again')
  const { en, zh, meta } = pairPaths(source)
  const english = readFileSync(ownedPath(root, en), 'utf8')
  const chinese = readFileSync(ownedPath(root, zh), 'utf8')
  if (!english.includes(`English | [中文](${basename(zh)})`) || !chinese.includes(`[English](${basename(en)}) | 中文`)) throw new Error(`${source}: missing language switcher`)
  if (signature(root, en, english) !== signature(root, zh, chinese)) throw new Error(`${source}: bilingual structure differs`)
  writeFileSync(ownedPath(root, meta), pairRecord(source, english, chinese))
}
