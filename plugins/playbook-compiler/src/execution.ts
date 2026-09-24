/** Runs only frozen modules. No draft, compiler service, JSDoc parser or artifact writes. */
import { canonical, loadArtifact } from './runtime.ts'
import { Workers } from './workers.ts'
import type { Artifact, InvocationResult, JsonObject, CompositionInput, CompositionResult } from './types.ts'
export class PlaybookRuntime {
  private readonly workers = new Workers()
  async invoke(artifact: Artifact, state: JsonObject, name: string, args: JsonObject, signal?: AbortSignal): Promise<InvocationResult> {
    let job
    try {
      const frozen = loadArtifact(canonical(artifact))
      if (!frozen.functions.some(fn => fn.name === name)) throw new Error('function does not exist: ' + name)
      const serialized = canonical({ state, args })
      if (Buffer.byteLength(serialized) > frozen.options.limits.inputBytes) throw new Error('state and arguments exceed inputBytes')
      const detached = JSON.parse(serialized) as { state: JsonObject; args: JsonObject }
      if (!detached.state || Array.isArray(detached.state) || !detached.args || Array.isArray(detached.args) || typeof detached.state !== 'object' || typeof detached.args !== 'object') throw new Error('state and arguments must be JSON objects')
      job = { ...frozen.program, options: frozen.options, invocation: { ...detached, name, artifact: { context: frozen.context, state: frozen.state, functions: frozen.functions, composition: frozen.composition } } }
    } catch (error) { return { ok: false, failure: 'operation', diagnostics: [{ code: 'invalid-input', stage: 'input', message: error instanceof Error ? error.message : String(error) }] } }
    const result = await this.workers.run(job, signal)
    if (!result.ok) return { ok: false, failure: 'operation' in result ? 'operation' : 'script', diagnostics: [result.diagnostic] }
    if (!('state' in result)) return { ok: false, failure: 'operation', diagnostics: [{ code: 'worker-failed', stage: 'execution', message: 'runtime returned an invalid result' }] }
    return result
  }
  async compose(artifact: Artifact, input: CompositionInput, signal?: AbortSignal): Promise<CompositionResult> {
    let job
    try {
      const frozen = loadArtifact(canonical(artifact)), serialized = canonical(input)
      if (Buffer.byteLength(serialized) > frozen.options.limits.inputBytes) throw new Error('composition input exceeds inputBytes')
      job = { ...frozen.program, options: frozen.options, composition: { input: JSON.parse(serialized) as CompositionInput, artifact: { context: frozen.context, state: frozen.state, functions: frozen.functions, composition: frozen.composition } } }
    } catch (error) { return { ok: false, failure: 'operation', diagnostics: [{ code: 'invalid-input', stage: 'input', message: error instanceof Error ? error.message : String(error) }] } }
    const result = await this.workers.run(job, signal)
    if (!result.ok) return { ok: false, failure: 'operation' in result ? 'operation' : 'script', diagnostics: [result.diagnostic] }
    if (!('plan' in result)) return { ok: false, failure: 'operation', diagnostics: [{ code: 'worker-failed', stage: 'execution', message: 'runtime returned an invalid composition' }] }
    return result
  }
  close(): Promise<void> { return this.workers.close() }
}
