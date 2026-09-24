/** Stateless compilation over a fixed authored snapshot. Each job owns one short-lived Worker. */
import { Workers } from './workers.ts'
import { encodeContent, type PlaybookContent } from '@papermoon/playbook-core'
import { compilationKey, createArtifact, digest } from './runtime.ts'
import type { CompileOptions, CompileResult, Limits, ResolvedOptions, WorkerInput } from './types.ts'
export type * from './types.ts'

export const defaultLimits: Readonly<Limits> = Object.freeze({ inputBytes: 8 * 1024 * 1024, modules: 256, outputBytes: 1024 * 1024, executionMs: 1000, totalMs: 10000, concurrency: 2, memoryMb: 128 })
export function resolveOptions(content: PlaybookContent, options: CompileOptions = {}): ResolvedOptions {
  const resolved = { entry: options.entry ?? 'playbook.js', language: options.language ?? content.texts.defaultLanguage, limits: { ...defaultLimits, ...options.limits } }
  if (!/^(?!\/|[A-Za-z]:)[^\\]+\.js$/.test(resolved.entry) || resolved.entry.includes('\0') || resolved.entry.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error('entry must be a relative .js file path')
  if (!content.texts.languages.has(resolved.language)) throw new Error('compiler language must be registered')
  if (Object.keys(resolved.limits).some(key => !(key in defaultLimits)) || Object.values(resolved.limits).some(value => !Number.isSafeInteger(value) || value < 1))
    throw new Error('compiler limits must be positive safe integers')
  return resolved
}
class SourceLimitError extends Error {}
export function prepare(content: PlaybookContent, options: CompileOptions = {}) {
  const resolved = resolveOptions(content, options)
  const records = Object.fromEntries(encodeContent(content))
  const serialized = JSON.stringify(records)
  if (Buffer.byteLength(serialized) > resolved.limits.inputBytes) throw new SourceLimitError('content exceeds inputBytes')
  const sourceHash = digest(records)
  const job: WorkerInput = {
    files: Object.fromEntries([...content.program.files].map(([path, file]) => [path, file.source])),
    texts: Object.fromEntries([...content.texts.entries].map(([key, entry]) => [key, entry.translations.get(resolved.language)?.text ?? null])),
    options: resolved,
  }
  return { job, sourceHash, key: compilationKey(sourceHash, resolved) }
}
const failure = (code: string, message: string, kind: 'script' | 'operation' = 'operation'): CompileResult => ({ ok: false, failure: kind, diagnostics: [{ code, stage: 'execution', message }] })

/** A compiler instance limits concurrent jobs without queuing or retaining module state. */
export class PlaybookCompiler {
  private readonly workers = new Workers()
  async compile(content: PlaybookContent, options: CompileOptions = {}, signal?: AbortSignal): Promise<CompileResult> {
    let input: ReturnType<typeof prepare>
    try { input = prepare(content, options) } catch (error) {
      return { ok: false, failure: error instanceof SourceLimitError ? 'script' : 'operation', diagnostics: [{ code: 'invalid-input', stage: 'input', message: error instanceof Error ? error.message : 'invalid compiler input' }] }
    }
    const result = await this.workers.run(input.job, signal)
    if (!result.ok) return { ok: false, failure: 'operation' in result ? 'operation' : 'script', diagnostics: [result.diagnostic] }
    try {
      if (!('compiled' in result)) return failure('worker-failed', 'compiler returned an invalid result')
      const artifact = createArtifact(input.sourceHash, input.job.options, result.compiled)
      if (Buffer.byteLength(JSON.stringify(artifact)) > input.job.options.limits.outputBytes) return failure('output-limit', 'artifact exceeds outputBytes', 'script')
      return { ok: true, artifact, diagnostics: [] }
    } catch { return failure('worker-failed', 'compiler returned an invalid result') }
  }
  close(): Promise<void> { return this.workers.close() }

}
const compiler = new PlaybookCompiler()
export function compile(content: PlaybookContent, options: CompileOptions = {}, signal?: AbortSignal): Promise<CompileResult> {
  return compiler.compile(content, options, signal)
}
