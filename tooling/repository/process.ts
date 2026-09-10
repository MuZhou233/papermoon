/** Owned child processes, explicit package-manager invocation, and cancellation. */
import { spawn, spawnSync } from 'node:child_process'

export interface ProcessResult { code: number | null; signal: NodeJS.Signals | null; cancelled: boolean }
export class ProcessFailure extends Error {
  constructor(readonly result: ProcessResult, command: string) {
    super(`${command}: exit=${result.code}, signal=${result.signal}, cancelled=${result.cancelled}`)
  }
}

export async function runProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env, signal?: AbortSignal): Promise<ProcessResult> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', detached: process.platform !== 'win32' })
    let timer: NodeJS.Timeout | undefined
    let cancelled = false
    const kill = (force: boolean): void => {
      if (!child.pid) return
      try {
        if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        else process.kill(-child.pid, force ? 'SIGKILL' : signal?.reason === 'SIGINT' ? 'SIGINT' : 'SIGTERM')
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') reject(error) }
    }
    const abort = (): void => {
      cancelled = true
      kill(false)
      timer = setTimeout(() => kill(true), 5_000)
      timer.unref()
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.once('error', reject)
    child.once('close', (code, exitSignal) => {
      clearTimeout(timer)
      // A departing parent may leave descendants that ignored termination.
      if (cancelled) kill(true)
      signal?.removeEventListener('abort', abort)
      const result = { code, signal: exitSignal, cancelled }
      if (cancelled || code !== 0 || exitSignal) reject(new ProcessFailure(result, command))
      else resolve(result)
    })
    if (signal?.aborted) abort()
  })
}

export function packageManagerArgs(args: string[]): string[] {
  const executable = process.env.npm_execpath
  if (!executable || !/pnpm\.(?:[cm]?js)$/.test(executable)) throw new Error('invoke this command through pnpm run')
  return [executable, ...args]
}

export async function pnpm(cwd: string, args: string[], signal?: AbortSignal, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await runProcess(process.execPath, packageManagerArgs(args), cwd, env, signal)
}
