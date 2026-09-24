/** Owns Worker lifetime, cancellation and concurrent-job limits without a background queue. */
import { Worker } from 'node:worker_threads'
import type { WorkerInput, WorkerResult, Diagnostic } from './types.ts'
export type JobResult = WorkerResult | { ok: false; operation: true; diagnostic: Diagnostic }
const failure = (code: string, message: string): JobResult => ({ ok: false, operation: true, diagnostic: { code, stage: 'execution', message } })
export class Workers {
  private readonly jobs = new Map<AbortController, Promise<JobResult>>()
  private closed = false
  run(input: WorkerInput, signal?: AbortSignal): Promise<JobResult> {
    if (this.closed) return Promise.resolve(failure('closed', 'execution service is closed'))
    if (signal?.aborted) return Promise.resolve(failure('cancelled', 'execution cancelled'))
    if (this.jobs.size >= input.options.limits.concurrency) return Promise.resolve(failure('busy', 'execution concurrency limit reached'))
    const controller = new AbortController(), abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const job = new Promise<JobResult>(resolve => {
      let worker: Worker
      try { worker = new Worker(new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js', import.meta.url), { workerData: input, execArgv: [], env: {}, resourceLimits: { maxOldGenerationSizeMb: input.options.limits.memoryMb }, stdout: true, stderr: true }) }
      catch (error) { resolve(failure('worker-failed', String(error))); return }
      worker.stdout.resume(); worker.stderr.resume()
      let finished = false
      const finish = (result: JobResult) => {
        if (finished) return
        finished = true; clearTimeout(timer); controller.signal.removeEventListener('abort', cancel)
        void worker.terminate().then(() => resolve(result), () => resolve(failure('worker-failed', 'execution Worker could not terminate')))
      }
      const cancel = () => finish(failure('cancelled', 'execution cancelled'))
      const timer = setTimeout(() => finish(failure('timeout', 'execution exceeded totalMs')), input.options.limits.totalMs)
      controller.signal.addEventListener('abort', cancel, { once: true })
      worker.on('message', (result: WorkerResult) => controller.signal.aborted ? cancel() : finish(result))
      worker.on('error', () => finish(failure('worker-failed', 'execution Worker failed')))
      worker.on('exit', () => { if (!finished) finish(failure('worker-failed', 'execution Worker exited without a result')) })
      if (signal?.aborted) controller.abort()
    })
    this.jobs.set(controller, job)
    void job.finally(() => { this.jobs.delete(controller); signal?.removeEventListener('abort', abort) })
    return job
  }
  async close(): Promise<void> { this.closed = true; for (const controller of this.jobs.keys()) controller.abort(); await Promise.all(this.jobs.values()) }
}
