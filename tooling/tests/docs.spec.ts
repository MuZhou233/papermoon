import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { checkDocs, excerptErrors, snippetErrors, skillErrors } from '../checks/docs.ts'
import { checkPair, pairRecord, recordPair } from '../checks/pairing.ts'
import { fixture, put } from './helpers.ts'
import { repoFiles } from '../checks/files.ts'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
function make(): string {
  const root = fixture(); roots.push(root)
  put(root, 'tsconfig.json', '{"compilerOptions":{"strict":true,"types":[],"skipLibCheck":true,"target":"ES2024","module":"NodeNext","moduleResolution":"NodeNext","noEmit":true}}')
  put(root, 'tooling/checks/config.json', '{"version":1,"exemptions":{},"budgets":{},"typeExcerpts":[]}')
  const source = resolve(import.meta.dirname, '../checks')
  const provenance = JSON.parse(readFileSync(join(source, 'provenance.json'), 'utf8')) as { files: Array<{path: string}> }
  for (const path of ['tooling/checks/provenance.json', 'tooling/checks/DSH-LICENSE', ...provenance.files.map(f => f.path)]) {
    const target = join(root, path)
    mkdirSync(resolve(target, '..'), { recursive: true })
    cpSync(resolve(import.meta.dirname, '../..', path), target)
  }
  return root
}
function pair(root: string, en = '# Guide\n\nEnglish | [中文](README.zh.md)\n\nText.\n', zh = '# 指南\n\n[English](README.md) | 中文\n\n正文。\n'): void {
  put(root, 'README.md', en); put(root, 'README.zh.md', zh); put(root, 'README.i18n.yaml', pairRecord('README.md', en, zh))
}
describe('main-repository documentation', () => {
  it('excludes the root DSH checkout and temporary files without hiding nested sources', async () => {
    const root = make(); pair(root)
    expect(await checkDocs(root)).toEqual([])
    put(root, 'dsh/README.md', '[broken](missing.md)')
    put(root, 'dsh/broken.ts', 'this is not valid code')
    put(root, 'tmp/README.md', '[broken](missing.md)')
    expect(await checkDocs(root)).toEqual([])
    expect(repoFiles(root)).not.toContain('dsh/README.md')
    expect(repoFiles(root)).not.toContain('tmp/README.md')
    put(root, 'plugins/example/dsh/README.md', 'owned source')
    put(root, 'plugins/example/tmp/README.md', 'owned source')
    expect(repoFiles(root)).toContain('plugins/example/dsh/README.md')
    expect(repoFiles(root)).toContain('plugins/example/tmp/README.md')
  })
  it('finds missing translations, stale hashes, broken consolidation links and unmatched structures', async () => {
    const root = make(); pair(root)
    put(root, 'README.md', '# Guide\n\nEnglish | [中文](README.zh.md)\n\n[Removed decision](gone.md)\n')
    expect((await checkDocs(root)).join()).toMatch(/broken target/)
    expect(checkPair(root, 'README.md').join()).toContain('hash')
    rmSync(join(root, 'README.zh.md'))
    expect(checkPair(root, 'README.md').join()).toContain('missing bilingual')
  })
  it('rejects divergent query parameters and cannot record missing switchers', () => {
    const root = make(); pair(root)
    const en = readFileSync(join(root, 'README.md'), 'utf8') + '\n[Read](target.md?mode=one)\n'
    const zh = readFileSync(join(root, 'README.zh.md'), 'utf8') + '\n[阅读](target.zh.md?mode=two)\n'
    pair(root, en, zh)
    expect(checkPair(root, 'README.md').join()).toContain('links differ')
    pair(root, '# Guide\n', '# 指南\n')
    expect(() => recordPair(root, 'README.md')).toThrow(/switcher/)
  })
  it('checks wrapping, budgets, Markdown diagrams and undisclosed exemptions', async () => {
    const root = make()
    pair(root, '# Guide\n\nEnglish | [中文](README.zh.md)\n\nTwo\nlines.\n\n```mermaid\nnot_a_diagram\n```\n', '# 指南\n\n[English](README.md) | 中文\n\n两行。\n\n```mermaid\nnot_a_diagram\n```\n')
    put(root, 'tooling/checks/config.json', '{"version":1,"exemptions":{"missing.md":"a reason"},"budgets":{"README.md":1},"typeExcerpts":[]}')
    const errors = (await checkDocs(root)).join('\n')
    expect(errors).toContain('one physical line'); expect(errors).toContain('word budget'); expect(errors).toContain('invalid Mermaid'); expect(errors).toContain('stale exemption')
    pair(root, '# Guide\n\nEnglish | [中文](README.zh.md)\n\n```mermaid\ngraph TD; A-->B\n```\n', '# 指南\n\n[English](README.md) | 中文\n\n```mermaid\ngraph TD; A-->B\n```\n')
    put(root, 'tooling/checks/config.json', '{"version":1,"exemptions":{},"budgets":{},"typeExcerpts":[]}')
    expect(await checkDocs(root)).toEqual([])
  })
  it('typechecks real snippets and compares registered declarations', () => {
    const root = make()
    expect(snippetErrors(root, 'guide.md', 'const value: number = 1', 0)).toEqual([])
    expect(snippetErrors(root, 'guide.md', 'const value: number = "wrong"', 0).join()).toContain('not assignable')
    put(root, 'types.ts', 'export interface Choice { value: number }')
    put(root, 'guide.md', '```ts type-equiv Choice\ninterface Choice { value: number }\n```\n')
    const entry = { document: 'guide.md', source: 'types.ts', symbol: 'Choice' }
    expect(excerptErrors(root, entry)).toEqual([])
    put(root, 'types.ts', 'export interface Choice { value: string }')
    expect(excerptErrors(root, entry).join()).toContain('differs')
  })
  it('validates actual skill frontmatter and refuses symlinked source inventories', () => {
    expect(skillErrors('.agents/skills/example/SKILL.md', '---\nname: example\ndescription: Maintain notes.\n---\n')).toEqual([])
    expect(skillErrors('.agents/skills/example/SKILL.md', '---\nname: wrong\n---\n')).not.toEqual([])
    const root = make(); mkdirSync(join(root, 'link-target')); symlinkSync('link-target', join(root, 'link'))
    expect(() => repoFiles(root)).toThrow(/symlinks/)
  })
})
