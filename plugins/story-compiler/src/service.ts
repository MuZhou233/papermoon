/** Persistence and source ownership stay outside the stateless compiler and text runtime. */
import type { StoryRepository } from '@papermoon/story-core/repository'
import type { ScriptId, RevisionId, ResolvedRef } from '@papermoon/story-core'
import { StoryCompiler, prepare } from './index.ts'
import { ArtifactStore } from './store.ts'
export { ArtifactStore } from './store.ts'
import { ArtifactError, initialize } from './runtime.ts'
import type { Artifact, CompileOptions, Diagnostic, OpeningContext } from './types.ts'

export interface CompilationSource { scriptId: ScriptId; ref: { kind: 'draft'; sequence: number } | { kind: 'revision'; revisionId: RevisionId } }
export type CompilationReceipt = { source: ResolvedRef; diagnostics: Diagnostic[] } & (
  | { ok: true; artifactId: string; context: OpeningContext; options: Artifact['options'] }
  | { ok: false }
)
export class CompilationService {
  private readonly compiler = new StoryCompiler()
  private readonly jobs = new Set<Promise<unknown>>()
  private readonly controllers = new Set<AbortController>()
  private closed = false
  constructor(private readonly repository: StoryRepository, readonly store: ArtifactStore, readonly defaults: CompileOptions = {}) {}
  private snapshot(source: CompilationSource) {
    if (this.closed) throw new ArtifactError('closed', 'compilation service is closed')
    this.repository.getScript(source.scriptId)
    if (source.ref.kind === 'revision') {
      this.repository.getHistoryEntry(source.scriptId, source.ref.revisionId)
      return this.repository.readSnapshot(source.ref)
    }
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
      return { ok: true, source: snapshot.ref, artifactId: saved.id, options: saved.options, context: initialize(saved), diagnostics: result.diagnostics }
    })()
    this.jobs.add(work)
    void work.finally(() => { this.jobs.delete(work); this.controllers.delete(controller); signal?.removeEventListener('abort', abort) }).catch(() => {}) // The caller receives the original rejection; cleanup creates no second failure.
    return work
  }
  async find(source: CompilationSource, options: Pick<CompileOptions, 'entry' | 'language'> = {}): Promise<CompilationReceipt | null> {
    const snapshot = this.snapshot(source)
    let input: ReturnType<typeof prepare>
    try { input = prepare(snapshot.content, this.options(options)) }
    catch (error) { throw new ArtifactError('invalid-input', error instanceof Error ? error.message : 'invalid compiler options') }
    const artifact = await this.store.read(input.key)
    return artifact ? { ok: true, source: snapshot.ref, artifactId: artifact.id, context: initialize(artifact), options: artifact.options, diagnostics: [] } : null
  }
  async read(id: string): Promise<Artifact> {
    if (this.closed) throw new ArtifactError('closed', 'compilation service is closed')
    const artifact = await this.store.read(id)
    if (!artifact) throw new ArtifactError('artifact-not-found', 'compiled artifact does not exist')
    return artifact
  }
  async initialize(id: string): Promise<OpeningContext> { return initialize(await this.read(id)) }
  async close(): Promise<void> { this.closed = true; for (const controller of this.controllers) controller.abort(); this.compiler.close(); await Promise.allSettled(this.jobs) }
}
