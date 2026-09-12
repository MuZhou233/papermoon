import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { runProcess, packageManagerArgs, ProcessFailure } from '../repository/process.ts'
import { launchEnvironment, main, processExitCode } from '../repository/cli.ts'
import { git } from '../repository/patches.ts'
import { fixture, put, commit } from './helpers.ts'

const roots: string[] = []
afterEach(() => { vi.unstubAllEnvs(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })) })
const make = (): string => { const root = fixture(); roots.push(root); return root }
export async function eventually(predicate: () => boolean, timeout = 10_000): Promise<void> {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('observable readiness timed out')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
describe('launcher process ownership', () => {
  it('preserves explicit data homes and independently defaults missing homes', () => {
    const env = launchEnvironment('/product', { DSH_HOME: '/custom', KEEP: 'value' })
    expect(env.DSH_HOME).toBe('/custom'); expect(env.DSH_AGENTS_HOME).toBe('/product/.papermoon/agents'); expect(env.KEEP).toBe('value')
    expect(launchEnvironment('/product', {}).DSH_HOME).toBe('/product/.papermoon/dsh')
  })
  it('passes exact arguments, working directory and environment without a shell', async () => {
    const root = make()
    put(root, 'inspect.mjs', 'import {writeFileSync} from "node:fs"; writeFileSync("observed.json", JSON.stringify({cwd:process.cwd(), args:process.argv.slice(2), marker:process.env.MARKER}))')
    await runProcess(process.execPath, ['inspect.mjs', 'a b', '$(not-a-command)', '--port', '0'], root, { ...process.env, MARKER: 'exact' })
    expect(JSON.parse(readFileSync(join(root, 'observed.json'), 'utf8'))).toEqual({ cwd: root, args: ['a b', '$(not-a-command)', '--port', '0'], marker: 'exact' })
    vi.stubEnv('npm_execpath', '/manager/pnpm.mjs')
    expect(packageManagerArgs(['run', 'test', 'a b'])).toEqual(['/manager/pnpm.mjs', 'run', 'test', 'a b'])
  })
  it('reports cancellation independently when a child traps termination and exits zero', async () => {
    const root = make(); const controller = new AbortController()
    put(root, 'wait.mjs', 'import {writeFileSync} from "node:fs"; process.on("SIGTERM",()=>process.exit(0)); writeFileSync("ready", "yes"); setInterval(()=>{},1000)')
    const running = runProcess(process.execPath, ['wait.mjs'], root, process.env, controller.signal)
    const assertion = expect(running).rejects.toMatchObject({ result: { cancelled: true } })
    try { await eventually(() => existsSync(join(root, 'ready'))) } finally { controller.abort() }
    await assertion
  })
  it.skipIf(process.platform === 'win32')('cleans descendants even when their parent exits before them', async () => {
    const root = make(); const controller = new AbortController()
    put(root, 'descendant.mjs', 'import {writeFileSync} from "node:fs"; process.on("SIGTERM",()=>{}); writeFileSync("pid", String(process.pid)); setInterval(()=>{},1000)')
    put(root, 'parent.mjs', 'import {spawn} from "node:child_process"; spawn(process.execPath,["descendant.mjs"],{stdio:"ignore"}); process.on("SIGTERM",()=>process.exit(0)); setInterval(()=>{},1000)')
    const running = runProcess(process.execPath, ['parent.mjs'], root, process.env, controller.signal)
    const assertion = expect(running).rejects.toMatchObject({ result: { cancelled: true } })
    let pid: number | undefined
    try {
      await eventually(() => existsSync(join(root, 'pid')))
      pid = Number(readFileSync(join(root, 'pid'), 'utf8'))
      controller.abort(); await assertion
      await eventually(() => { try { process.kill(pid!, 0); return false } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error } })
    } finally {
      controller.abort()
      if (pid) { try { process.kill(pid, 'SIGKILL') } catch (error) { expect(error).toMatchObject({code: 'ESRCH'}) } }
      await assertion
    }
  })
  it('starts the built official CLI in the main workspace and preserves a nonzero exit', async () => {
    const root = make()
    const upstream = make(); commit(upstream)
    git(root, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'dsh'])
    await expect(main(['start'], root)).rejects.toThrow(/not built/)
    put(root, 'dsh/apps/cli/lib/bin.js', 'const fs = require("node:fs"); fs.writeFileSync("launch.json",JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2),home:process.env.DSH_HOME,agents:process.env.DSH_AGENTS_HOME})); process.exit(23)')
    vi.stubEnv('DSH_HOME', ''); vi.stubEnv('DSH_AGENTS_HOME', '')
    const failed = await main(['start', '--', '--port', '0', '--no-open'], root).catch((error: unknown) => error)
    expect(processExitCode(failed)).toBe(23)
    expect(JSON.parse(readFileSync(join(root, 'launch.json'), 'utf8'))).toEqual({cwd: root, args: ['--profile', 'web', '--patch', join(root, 'profiles/papermoon/cordis.patch.yml'), '--port', '0', '--no-open'], home: join(root, '.papermoon/dsh'), agents: join(root, '.papermoon/agents')})
    await main(['start-dsh'], root).catch(() => {})
    expect(JSON.parse(readFileSync(join(root, 'launch.json'), 'utf8')).args).toEqual(['--profile', 'web'])
    expect(processExitCode(new ProcessFailure({code: null, signal: 'SIGTERM', cancelled: false}, 'fixture'))).toBe(143)
  })
  it('builds main plugins before DSH and stops before DSH when plugin compilation fails', async () => {
    const root = make(); const upstream = make(); commit(upstream)
    git(root, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'dsh'])
    put(root, 'pnpm.cjs', 'const fs=require("node:fs");fs.appendFileSync(process.env.RECORD,JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})+"\\n");if(process.env.FAIL_PLUGIN && process.argv[3]==="build:plugins")process.exit(19)')
    vi.stubEnv('npm_execpath', join(root, 'pnpm.cjs'))
    vi.stubEnv('RECORD', join(root, 'build.jsonl'))
    await main(['build'], root)
    const commands = readFileSync(join(root, 'build.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
    expect(commands).toEqual([
      {cwd: root, args: ['run', 'build:plugins']},
      {cwd: join(root, 'dsh'), args: ['run', 'clean']},
      {cwd: join(root, 'dsh'), args: ['run', 'build']},
    ])
    vi.stubEnv('FAIL_PLUGIN', '1')
    vi.stubEnv('RECORD', join(root, 'failed.jsonl'))
    await expect(main(['build'], root)).rejects.toMatchObject({result: {code: 19}})
    expect(readFileSync(join(root, 'failed.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1)
  })
  it('does not launch work after an already received cancellation', async () => {
    const root = make(); const controller = new AbortController(); controller.abort()
    await expect(runProcess(process.execPath, ['-e', 'process.exit(0)'], root, process.env, controller.signal)).rejects.toThrow()
  })
})
