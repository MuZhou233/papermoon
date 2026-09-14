/** Persistence and source ownership stay outside the stateless compiler and text runtime. */
import type { StoryRepository, StoryCommitResult } from '@papermoon/story-core/repository'
import { encodeContent, type ScriptId, type ResolvedRef, type JsonObject, type JsonValue } from '@papermoon/story-core'
import { StoryRuntime } from './execution.ts'
import { StoryCompiler, prepare, resolveOptions } from './index.ts'
import { ArtifactStore } from './store.ts'
export { ArtifactStore } from './store.ts'
import { ArtifactError, initialize, canonical, digest } from './runtime.ts'
import type { Artifact, CompileOptions, Diagnostic, OpeningContext, StateDeclaration, FunctionDeclaration } from './types.ts'

export interface CompilationSource { scriptId: ScriptId; ref: { kind: 'draft'; sequence: number } }
export interface SubmissionInput {
  scriptId: ScriptId; expectedSequence: number; description: string; metadata?: JsonObject; historyMetadata?: JsonObject
  references?: readonly import('@papermoon/story-core').RevisionId[]
  targets?: readonly { entry?: string; language?: string }[]; allowCompilationFailure?: boolean
}
export type SubmissionResult = { committed: false; compilation: import('./revisions.ts').RevisionCompilation } |
  { committed: true; revision: StoryCommitResult['revision']; entry: StoryCommitResult['entry']; draft: StoryCommitResult['draft']; compilation: import('./revisions.ts').RevisionCompilation }

export type CompilationReceipt = { source: ResolvedRef; diagnostics: Diagnostic[] } & (
  | { ok: true; artifactId: string; context: OpeningContext; options: Artifact['options']; state: StateDeclaration; functions: readonly FunctionDeclaration[] }
  | { ok: false }
)
export class CompilationService {
  private readonly compiler = new StoryCompiler()
  private readonly runtime = new StoryRuntime()
  private readonly jobs = new Set<Promise<unknown>>()
  private readonly controllers = new Set<AbortController>()
  private closed = false
  constructor(private readonly repository: StoryRepository, readonly store: ArtifactStore, readonly defaults: CompileOptions = {}, readonly attachmentBytes = 16 * 1024 * 1024) {
    if (!Number.isSafeInteger(attachmentBytes) || attachmentBytes < 1) throw new ArtifactError('invalid-input', 'attachmentBytes must be a positive integer')
  }
  private snapshot(source: CompilationSource) {
    if (this.closed) throw new ArtifactError('closed', 'compilation service is closed')
    this.repository.getScript(source.scriptId)
    if (source.ref.kind !== 'draft') throw new ArtifactError('invalid-input', 'only drafts can be compiled')
    if (!Number.isSafeInteger(source.ref.sequence) || source.ref.sequence < 0) throw new ArtifactError('invalid-input', 'draft compilation requires a known sequence')
    return this.repository.readSnapshot({ kind: 'draft', scriptId: source.scriptId, sequence: source.ref.sequence })
  }
  private options(options: Pick<CompileOptions, 'entry' | 'language'>): CompileOptions { return { ...this.defaults, ...options } }
  compile(source: CompilationSource, options: Pick<CompileOptions, 'entry' | 'language'> = {}, signal?: AbortSignal): Promise<CompilationReceipt> {
    const snapshot = this.snapshot(source), controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    this.controllers.add(controller)
    if (signal?.aborted) controller.abort()
    const work = (async (): Promise<CompilationReceipt> => {
      const result = await this.compiler.compile(snapshot.content, this.options(options), controller.signal)
      if (!result.ok) return { ok: false, source: snapshot.ref, diagnostics: result.diagnostics }
      const saved = await this.store.save(result.artifact, controller.signal)
      controller.signal.throwIfAborted()
      return { ok: true, source: snapshot.ref, artifactId: saved.id, options: saved.options, context: initialize(saved), state: saved.state, functions: saved.functions, diagnostics: result.diagnostics }
    })()
    this.jobs.add(work)
    void work.finally(() => { this.jobs.delete(work); this.controllers.delete(controller); signal?.removeEventListener('abort', abort) }).catch(() => {}) // The caller receives the original rejection; cleanup creates no second failure.
    return work
  }
  /** Compile a fixed draft before one atomic revision commit; no prior artifact skips this evaluation. */
  submit(input: SubmissionInput, signal?: AbortSignal): Promise<SubmissionResult> {
    const snapshot = this.snapshot({ scriptId: input.scriptId, ref: { kind: 'draft', sequence: input.expectedSequence } })
    if (!input.description.trim()) throw new ArtifactError('invalid-input', 'revision description must not be blank')
    if (input.references) for (const id of input.references) this.repository.getRevision(id)
    const requested = input.targets ?? [{}]
    if (!requested.length) throw new ArtifactError('invalid-input', 'at least one compilation target is required')
    const targets = requested.map(target => resolveOptions(snapshot.content, this.options(target)))
    if (new Set(targets.map(target => JSON.stringify([target.entry, target.language]))).size !== targets.length)
      throw new ArtifactError('invalid-input', 'compilation targets must be distinct')
    const controller = new AbortController(), abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true }); this.controllers.add(controller)
    if (signal?.aborted) controller.abort()
    const work = (async (): Promise<SubmissionResult> => {
      const results: import('./types.ts').CompileResult[] = []
      for (const target of targets) {
        controller.signal.throwIfAborted()
        const result = await this.compiler.compile(snapshot.content, target, controller.signal)
        if (!result.ok && result.failure === 'operation') throw new ArtifactError(result.diagnostics[0]?.code ?? 'compilation-unavailable', result.diagnostics[0]?.message ?? 'compilation operation failed')
        results.push(result)
      }
      const successful = results.every(result => result.ok)
      const sourceHash = digest(Object.fromEntries(encodeContent(snapshot.content)))
      const compilation: import('./revisions.ts').RevisionCompilation = {
        format: 'papermoon.compilation', version: 1, status: successful ? 'success' : 'failed', sourceHash,
        targets: targets.map((target, index) => ({ entry: target.entry, language: target.language, diagnostics: results[index]!.diagnostics,
          ...(successful ? { attachmentKey: `opening/${index}` } : {}) })),
      }
      if (!successful && input.allowCompilationFailure !== true) return { committed: false, compilation }
      const attachments = successful ? results.map((result, index) => {
        if (!result.ok) throw new ArtifactError('invalid-artifact', 'successful submission has a failed target')
        const artifact = result.artifact
        if (artifact.sourceHash !== sourceHash) throw new ArtifactError('invalid-artifact', 'compiled source differs from submitted content')
        return { key: `opening/${index}`, metadata: { kind: artifact.format, artifactId: artifact.id, entry: artifact.options.entry, language: artifact.options.language }, value: JSON.parse(canonical(artifact)) as JsonValue }
      }) : []
      if (Buffer.byteLength(canonical({ compilation, attachments })) > this.attachmentBytes) throw new ArtifactError('attachment-limit', 'revision attachments exceed attachmentBytes')
      controller.signal.throwIfAborted()
      const { revision, entry, draft } = this.repository.commitRevision({ scriptId: input.scriptId, expectedSequence: input.expectedSequence,
        description: input.description, metadata: input.metadata, historyMetadata: input.historyMetadata, references: input.references,
        attachments, attachmentMetadata: { compilation: JSON.parse(canonical(compilation)) as JsonValue } })
      return { committed: true, revision, entry, draft, compilation }
    })()
    this.jobs.add(work)
    void work.finally(() => { this.jobs.delete(work); this.controllers.delete(controller); signal?.removeEventListener('abort', abort) }).catch(() => {}) // The returned promise owns failures; this branch only releases resources.
    return work
  }
  /** Simulate one fixed draft using disposable state; no artifact file or revision is written. */
  simulate(source: CompilationSource, calls: readonly { name: string; args: JsonObject }[], options: Pick<CompileOptions, 'entry' | 'language'> = {}, signal?: AbortSignal) {
    const snapshot = this.snapshot(source), resolved = resolveOptions(snapshot.content, this.options(options))
    if (Buffer.byteLength(canonical(calls)) > resolved.limits.inputBytes) throw new ArtifactError('input-limit', 'simulation calls exceed inputBytes')
    const controller = new AbortController(), abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true }); this.controllers.add(controller)
    if (signal?.aborted) controller.abort()
    const timer = setTimeout(abort, resolved.limits.totalMs)
    const work = (async () => {
      const compiled = await this.compiler.compile(snapshot.content, resolved, controller.signal)
      if (!compiled.ok) {
        if (compiled.failure === 'operation') throw new ArtifactError(compiled.diagnostics[0]!.code, compiled.diagnostics[0]!.message)
        return { ok: false as const, source: snapshot.ref, diagnostics: compiled.diagnostics, steps: [] }
      }
      let state = structuredClone(compiled.artifact.state.initial)
      const steps: { name: string; args: JsonObject; before: JsonObject; result: import('./types.ts').InvocationResult }[] = []
      for (const call of calls) {
        controller.signal.throwIfAborted()
        const result = await this.runtime.invoke(compiled.artifact, state, call.name, call.args, controller.signal)
        if (!result.ok && result.failure === 'operation') throw new ArtifactError(result.diagnostics[0]!.code, result.diagnostics[0]!.message)
        steps.push({ ...call, before: state, result })
        if (result.ok) state = result.state
        if (Buffer.byteLength(canonical({ source: snapshot.ref, steps, state })) > resolved.limits.outputBytes) throw new ArtifactError('output-limit', 'simulation result exceeds outputBytes')
      }
      return { ok: true as const, source: snapshot.ref, diagnostics: [], steps, state }
    })()
    this.jobs.add(work)
    void work.finally(() => { clearTimeout(timer); this.jobs.delete(work); this.controllers.delete(controller); signal?.removeEventListener('abort', abort) }).catch(() => {}) // The caller receives the rejection; cleanup owns no additional result.
    return work
  }
  async find(source: CompilationSource, options: Pick<CompileOptions, 'entry' | 'language'> = {}): Promise<CompilationReceipt | null> {
    const snapshot = this.snapshot(source)
    let input: ReturnType<typeof prepare>
    try { input = prepare(snapshot.content, this.options(options)) }
    catch (error) { throw new ArtifactError('invalid-input', error instanceof Error ? error.message : 'invalid compiler options') }
    const artifact = await this.store.read(input.key)
    return artifact ? { ok: true, source: snapshot.ref, artifactId: artifact.id, context: initialize(artifact), options: artifact.options, state: artifact.state, functions: artifact.functions, diagnostics: [] } : null
  }
  async read(id: string): Promise<Artifact> {
    if (this.closed) throw new ArtifactError('closed', 'compilation service is closed')
    const artifact = await this.store.read(id)
    if (!artifact) throw new ArtifactError('artifact-not-found', 'compiled artifact does not exist')
    return artifact
  }
  async initialize(id: string): Promise<OpeningContext> { return initialize(await this.read(id)) }
  async close(): Promise<void> { this.closed = true; for (const controller of this.controllers) controller.abort(); await Promise.all([this.compiler.close(), this.runtime.close()]); await Promise.allSettled(this.jobs) }
}
