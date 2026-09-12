/** Root commands keep PaperMoon's workspace distinct from the DSH installation. */
import { existsSync } from 'node:fs'
import { constants } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rebuild, checkPatches, submodule } from './patches.ts'
import { pnpm, runProcess, ProcessFailure } from './process.ts'

export const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))

export function launchEnvironment(root: string, inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...inherited,
    DSH_HOME: inherited.DSH_HOME || join(root, '.papermoon/dsh'),
    DSH_AGENTS_HOME: inherited.DSH_AGENTS_HOME || join(root, '.papermoon/agents'),
  }
}

export async function main(args: string[], root = repositoryRoot, signal?: AbortSignal): Promise<void> {
  const [command, ...raw] = args
  const rest = raw[0] === '--' ? raw.slice(1) : raw
  if (rest.includes('--help') && command !== 'start' && command !== 'start-dsh') {
    console.log('PaperMoon: setup | build | start [Web options] | start-dsh [Web options] | check\nsetup discards unexported DSH source changes, restores the Gitlink and applies patches. Ignored configuration and main-repository data are preserved.')
    return
  }
  if (command !== 'start' && command !== 'start-dsh' && rest.length) throw new Error('unexpected arguments')
  switch (command) {
    case 'setup':
      signal?.throwIfAborted()
      rebuild(root)
      // DSH explicitly skips development hook installation in automated installs.
      await pnpm(submodule(root), ['install', '--frozen-lockfile'], signal, { ...process.env, CI: 'true' })
      break
    case 'build': {
      await pnpm(root, ['run', 'build:plugins'], signal)
      const directory = submodule(root)
      await pnpm(directory, ['run', 'clean'], signal, { ...process.env, CI: 'true' })
      await pnpm(directory, ['run', 'build'], signal, { ...process.env, CI: 'true' })
      break
    }
    case 'start':
    case 'start-dsh': {
      const bin = join(submodule(root), 'apps/cli/lib/bin.js')
      if (!existsSync(bin)) throw new Error('DSH is not built; run pnpm build first')
      await runProcess(process.execPath, [bin, '--profile', 'web', ...(command === 'start' ? ['--patch', join(root, 'profiles/papermoon/cordis.patch.yml')] : []), ...rest], root, launchEnvironment(root, process.env), signal)
      break
    }
    case 'check': await checkPatches(root, signal); break
    default: throw new Error('usage: setup | build | start [Web options] | start-dsh [Web options] | check')
  }
}

export function processExitCode(error: unknown): number {
  if (!(error instanceof ProcessFailure)) return 1
  return error.result.code ?? (error.result.signal ? 128 + constants.signals[error.result.signal] : 1)
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const controller = new AbortController()
  let received: NodeJS.Signals | undefined
  const interrupt = (): void => { received = 'SIGINT'; controller.abort('SIGINT') }
  const terminate = (): void => { received = 'SIGTERM'; controller.abort('SIGTERM') }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)
  main(process.argv.slice(2), repositoryRoot, controller.signal).catch(error => {
    if (!received) console.error(String(error))
    process.exitCode = ['start','start-dsh'].includes(process.argv[2] ?? '') && error instanceof ProcessFailure
      ? processExitCode(error)
      : received ? 128 + constants.signals[received] : processExitCode(error)
  }).finally(() => { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate) })
}
