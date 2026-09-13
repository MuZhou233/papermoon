/** Stateless compilation over a fixed authored snapshot. Each job owns one short-lived Worker. */
import { Worker } from 'node:worker_threads'
import { encodeContent, type StoryContent } from '@papermoon/story-core'
import { compilationKey, createArtifact, digest } from './runtime.ts'
import type { CompileOptions, CompileResult, Limits, ResolvedOptions, WorkerInput, WorkerResult } from './types.ts'
export type * from './types.ts'

export const defaultLimits: Readonly<Limits> = Object.freeze({ inputBytes: 8 * 1024 * 1024, modules: 256, outputBytes: 1024 * 1024, executionMs: 1000, totalMs: 10000, concurrency: 2, memoryMb: 128 })
export function resolveOptions(content: StoryContent, options: CompileOptions = {}): ResolvedOptions {
  const resolved = { entry: options.entry ?? 'story.js', language: options.language ?? content.texts.defaultLanguage, limits: { ...defaultLimits, ...options.limits } }
  if (!/^(?!\/|[A-Za-z]:)[^\\]+\.js$/.test(resolved.entry) || resolved.entry.includes('\0') || resolved.entry.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error('entry must be a relative .js file path')
  if (!content.texts.languages.has(resolved.language)) throw new Error('compiler language must be registered')
  if (Object.keys(resolved.limits).some(key => !(key in defaultLimits)) || Object.values(resolved.limits).some(value => !Number.isSafeInteger(value) || value < 1))
    throw new Error('compiler limits must be positive safe integers')
  return resolved
}
export function prepare(content: StoryContent, options: CompileOptions = {}) {
  const resolved = resolveOptions(content, options)
  const records = Object.fromEntries(encodeContent(content))
  const serialized = JSON.stringify(records)
  if (Buffer.byteLength(serialized) > resolved.limits.inputBytes) throw new Error('content exceeds inputBytes')
  const sourceHash = digest(records)
  const job: WorkerInput = {
    files: Object.fromEntries([...content.program.files].map(([path, file]) => [path, file.source])),
    texts: Object.fromEntries([...content.texts.entries].map(([key, entry]) => [key, entry.translations.get(resolved.language)?.text ?? null])),
    options: resolved,
  }
  return { job, sourceHash, key: compilationKey(sourceHash, resolved) }
}
const failure = (code: string, message: string): CompileResult => ({ ok: false, diagnostics: [{ code, stage: 'execution', message }] })

/** A compiler instance limits concurrent jobs without queuing or retaining module state. */
export class StoryCompiler {
  private readonly jobs = new Set<AbortController>()
  private closed = false
  async compile(content: StoryContent, options: CompileOptions = {}, signal?: AbortSignal): Promise<CompileResult> {
    if (this.closed) return failure('closed', 'compiler is closed')
    if (signal?.aborted) return failure('cancelled', 'compilation cancelled')
    let input: ReturnType<typeof prepare>
    try { input = prepare(content, options) } catch (error) {
      return { ok: false, diagnostics: [{ code: 'invalid-input', stage: 'input', message: error instanceof Error ? error.message : 'invalid compiler input' }] }
    }
    if (this.jobs.size >= input.job.options.limits.concurrency) return failure('busy', 'compiler concurrency limit reached')
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    this.jobs.add(controller)
    if (signal?.aborted) controller.abort()
    try {
      return await new Promise<CompileResult>((resolve) => {
        let worker: Worker
        try {
          worker = new Worker(new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js', import.meta.url), { workerData: input.job, execArgv: [], env: {}, resourceLimits: { maxOldGenerationSizeMb: input.job.options.limits.memoryMb }, stdout: true, stderr: true })
        } catch (error) { resolve(failure('worker-failed', String(error))); return }
        worker.stdout.resume(); worker.stderr.resume()
        let finished = false
        const finish = (result: CompileResult) => {
          if (finished) return
          finished = true
          clearTimeout(timer); controller.signal.removeEventListener('abort', cancel)
          void worker.terminate().then(() => resolve(result), () => resolve(failure('worker-failed', 'compiler Worker could not terminate')))
        }
        const cancel = () => finish(failure('cancelled', 'compilation cancelled'))
        const timer = setTimeout(() => finish(failure('timeout', 'compilation exceeded totalMs')), input.job.options.limits.totalMs)
        controller.signal.addEventListener('abort', cancel, { once: true })
        worker.on('message', (result: WorkerResult) => {
          if (controller.signal.aborted) { cancel(); return }
          try {
            if (!result.ok) { finish({ ok: false, diagnostics: [result.diagnostic] }); return }
            const artifact = createArtifact(input.sourceHash, input.job.options, result.context)
            if (Buffer.byteLength(JSON.stringify(artifact)) > input.job.options.limits.outputBytes) { finish(failure('output-limit', 'artifact exceeds outputBytes')); return }
            finish({ ok: true, artifact, diagnostics: [] })
          } catch { finish(failure('worker-failed', 'compiler returned an invalid result')) }
        })
        worker.on('error', () => finish(failure('worker-failed', 'compiler Worker failed')))
        worker.on('exit', () => { if (!finished) finish(failure('worker-failed', 'compiler Worker exited without a result')) })
        if (controller.signal.aborted) cancel()
      })
    } finally { this.jobs.delete(controller); signal?.removeEventListener('abort', abort) }
  }
  close(): void { this.closed = true; for (const job of this.jobs) job.abort() }
}
const compiler = new StoryCompiler()
export function compile(content: StoryContent, options: CompileOptions = {}, signal?: AbortSignal): Promise<CompileResult> {
  return compiler.compile(content, options, signal)
}
