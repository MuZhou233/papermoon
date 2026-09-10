/** Main-repository documentation gates. None loads or builds the submodule. */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { load } from 'js-yaml'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import { repoFiles, ownedPath, object, isArchivedAgentNotePath } from './files.ts'
import { checkPair } from './pairing.ts'
import { parseMarkdown, visitMarkdown, markdownFences } from './markdown.ts'
import { anchorCache, findViolations } from './links.ts'

export interface DocConfig {
  exemptions: Record<string, string>
  budgets: Record<string, number>
  typeExcerpts: Array<{ document: string; symbol: string; source: string }>
}

export function docConfig(root: string): DocConfig {
  const value = object(JSON.parse(readFileSync(join(root, 'tooling/checks/config.json'), 'utf8')), 'doc config')
  if (value.version !== 1) throw new Error('unsupported doc config version')
  const exemptions = object(value.exemptions, 'exemptions')
  for (const [path, reason] of Object.entries(exemptions)) {
    ownedPath(root, path)
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`${path}: exemption needs a reason`)
  }
  const budgets = object(value.budgets, 'budgets')
  for (const [path, limit] of Object.entries(budgets)) {
    ownedPath(root, path)
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) throw new Error(`${path}: invalid word budget`)
  }
  if (!Array.isArray(value.typeExcerpts)) throw new Error('typeExcerpts must be an array')
  const typeExcerpts = value.typeExcerpts.map(raw => {
    const entry = object(raw, 'type excerpt')
    if (typeof entry.document !== 'string' || typeof entry.source !== 'string' || typeof entry.symbol !== 'string') throw new Error('invalid type excerpt')
    ownedPath(root, entry.document); ownedPath(root, entry.source)
    return entry as unknown as DocConfig['typeExcerpts'][number]
  })
  return { exemptions: exemptions as Record<string, string>, budgets: budgets as Record<string, number>, typeExcerpts }
}

export function snippetErrors(root: string, document: string, code: string, ordinal: number): string[] {
  const path = join(root, dirname(document), `__papermoon_example_${ordinal}.ts`)
  const configPath = join(root, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) return [ts.flattenDiagnosticMessageText(config.error.messageText, '\n')]
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const options = { ...parsed.options, noEmit: true }
  const host = ts.createCompilerHost(options)
  const originalSource = host.getSourceFile.bind(host)
  const originalExists = host.fileExists.bind(host)
  const originalRead = host.readFile.bind(host)
  host.fileExists = name => resolve(name) === path || originalExists(name)
  host.readFile = name => resolve(name) === path ? `${code}\nexport {}\n` : originalRead(name)
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) => resolve(name) === path
    ? ts.createSourceFile(path, `${code}\nexport {}\n`, languageVersion, true)
    : originalSource(name, languageVersion, onError, shouldCreate)
  const program = ts.createProgram([path], options, host)
  return ts.getPreEmitDiagnostics(program).map(d => `${document}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
}

function printedType(content: string, symbol: string): string | undefined {
  const source = ts.createSourceFile('excerpt.ts', content, ts.ScriptTarget.Latest, true)
  const node = source.statements.find(s => (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) && s.name.text === symbol)
  if (!node) return undefined
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, node, source).replace(/\b(export|declare)\s+/g, '').trim()
}

export function excerptErrors(root: string, entry: DocConfig['typeExcerpts'][number]): string[] {
  const source = readFileSync(ownedPath(root, entry.source), 'utf8')
  const fences = markdownFences(readFileSync(ownedPath(root, entry.document), 'utf8'))
  const fence = fences.find(f => f.info === `ts type-equiv ${entry.symbol}`)
  const expected = printedType(source, entry.symbol)
  if (!fence || !expected || printedType(fence.code, entry.symbol) !== expected) return [`${entry.document}: type excerpt ${entry.symbol} differs from ${entry.source}`]
  return []
}

export function skillErrors(path: string, content: string): string[] {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(content)
  if (!match) return [`${path}: skill YAML frontmatter is required`]
  try {
    const metadata = object(load(match[1]!), path)
    const folder = path.split('/').at(-2)
    if (metadata.name !== folder || typeof metadata.description !== 'string' || !metadata.description.trim()) return [`${path}: skill name/description is invalid`]
    if ('disable-model-invocation' in metadata && typeof metadata['disable-model-invocation'] !== 'boolean') return [`${path}: invocation flag must be Boolean`]
    return []
  } catch (error) { return [`${path}: ${String(error)}`] }
}

export function provenanceErrors(root: string): string[] {
  try {
    const source = object(JSON.parse(readFileSync(join(root, 'tooling/checks/provenance.json'), 'utf8')), 'provenance')
    if (source.version !== 1 || typeof source.repository !== 'string' || !source.repository.startsWith('https://') || typeof source.commit !== 'string' || !/^[a-f0-9]{40}$/.test(source.commit) || typeof source.license !== 'string' || !Array.isArray(source.files)) throw new Error('invalid source metadata')
    if (!readFileSync(ownedPath(root, source.license), 'utf8').includes('MIT License')) throw new Error('missing preserved license')
    const seen = new Set<string>()
    for (const raw of source.files) {
      const file = object(raw, 'source entry')
      if (typeof file.path !== 'string' || typeof file.source !== 'string' || typeof file.adjustments !== 'string' || !file.adjustments.trim() || typeof file.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sourceSha256)) throw new Error('invalid source entry')
      if (seen.has(file.path) || !existsSync(ownedPath(root, file.path))) throw new Error(`duplicate or missing derived file: ${file.path}`)
      seen.add(file.path)
    }
    return []
  } catch (error) { return [`provenance: ${String(error)}`] }
}

let mermaidParser: Promise<typeof import('mermaid')> | undefined
async function checkMermaid(code: string): Promise<void> {
  if (!mermaidParser) {
    const dom = new JSDOM('')
    Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true })
    Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true })
    mermaidParser = import('mermaid')
  }
  const { default: mermaid } = await mermaidParser
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
  await mermaid.parse(code)
}

export async function checkDocs(root: string): Promise<string[]> {
  const errors: string[] = []
  const config = docConfig(root)
  const files = repoFiles(root)
  const active = files.filter(path => path.endsWith('.md') && !isArchivedAgentNotePath(path))
  const anchors = anchorCache()
  for (const exempt of Object.keys(config.exemptions)) if (!files.includes(exempt)) errors.push(`${exempt}: stale exemption`)
  for (const [file, limit] of Object.entries(config.budgets)) {
    if (!files.includes(file)) errors.push(`${file}: missing budgeted document`)
    else if (readFileSync(join(root, file), 'utf8').trim().split(/\s+/).length > limit) errors.push(`${file}: word budget exceeded (${limit})`)
  }
  for (const file of files.filter(p => p.endsWith('.i18n.yaml') && !isArchivedAgentNotePath(p))) {
    if (!files.includes(file.replace(/\.i18n\.yaml$/, '.md'))) errors.push(`${file}: orphan pairing record`)
  }
  for (const file of active) {
    const content = readFileSync(join(root, file), 'utf8')
    if (!content.endsWith('\n') || content.endsWith('\n\n')) errors.push(`${file}: expected exactly one trailing newline`)
    errors.push(...findViolations(join(root, file), anchors, root).map(v => `${v.file}:${v.line}: broken ${v.reason}: ${v.url}`))
    visitMarkdown(parseMarkdown(content), node => {
      if (node.type === 'paragraph' && node.position && node.position.start.line !== node.position.end.line) errors.push(`${file}:${node.position.start.line}: paragraph must use one physical line`)
    })
    if (!config.exemptions[file]) {
      if (file.endsWith('.zh.md')) {
        if (!files.includes(file.replace(/\.zh\.md$/, '.md'))) errors.push(`${file}: orphan translation`)
      } else errors.push(...checkPair(root, file))
    }
    if (file.endsWith('/SKILL.md')) {
      errors.push(...skillErrors(file, content))
      const policy = join(root, dirname(file), 'agents/openai.yaml')
      if (existsSync(policy)) {
        try {
          const meta = object(load(readFileSync(policy, 'utf8')), policy)
          if (meta.policy !== undefined) {
            const implicit = object(meta.policy, policy).allow_implicit_invocation
            const header = object(load(/^---\n([\s\S]*?)\n---/.exec(content)![1]!), file)
            if (typeof implicit !== 'boolean' || implicit === (header['disable-model-invocation'] ?? false)) errors.push(`${file}: invocation policies disagree`)
          }
        } catch (error) { errors.push(`${file}: ${String(error)}`) }
      }
    }
    if (file.endsWith('.zh.md')) continue
    for (const [index, fence] of markdownFences(content).entries()) {
      if (!fence.closed && fence.lang) errors.push(`${file}:${fence.line}: unterminated fence`)
      if (fence.lang === 'mermaid') {
        try { await checkMermaid(fence.code) } catch (error) { errors.push(`${file}:${fence.line}: invalid Mermaid: ${String(error)}`) }
      }
      if (fence.lang === 'ts' || fence.lang === 'typescript') {
        errors.push(...snippetErrors(root, file, fence.code, index))
        if (fence.info.includes('type-equiv') && !config.typeExcerpts.some(e => e.document === file && fence.info === `ts type-equiv ${e.symbol}`)) errors.push(`${file}: unregistered type excerpt`)
      }
    }
  }
  for (const entry of config.typeExcerpts) {
    try { errors.push(...excerptErrors(root, entry)) } catch (error) { errors.push(String(error)) }
  }
  // References in JSDoc have an owning source location, unlike arbitrary strings.
  for (const file of files.filter(p => /\.(?:ts|tsx|mjs)$/.test(p))) {
    const content = readFileSync(join(root, file), 'utf8')
    for (const match of content.matchAll(/@see\s+((?:\.\.?\/)[^\s*]+\.md)(?:#[^\s*]+)?/g)) {
      if (!existsSync(resolve(root, dirname(file), match[1]!))) errors.push(`${file}: missing @see document ${match[1]}`)
    }
  }
  errors.push(...provenanceErrors(root))
  return errors
}
