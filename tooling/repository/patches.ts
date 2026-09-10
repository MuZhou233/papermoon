/** Rebuildable DSH source; the parent Git index owns its pinned upstream commit. */
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { object, ownedPath, strings } from '../checks/files.ts'
import { pnpm } from './process.ts'

export interface CheckCommand { script: string; args: string[] }
export interface PatchSeries { patches: string[]; checks: CheckCommand[] }

export function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? `git ${args[0]}: ${result.stderr.trim()}`)
  return result.stdout
}

export function readSeries(root: string): PatchSeries {
  const value = object(JSON.parse(readFileSync(ownedPath(root, 'patches/series.json'), 'utf8')), 'patch series')
  if (value.version !== 1 || Object.keys(value).sort().join(',') !== 'checks,patches,version') throw new Error('unsupported patch series format')
  const patches = strings(value.patches, 'patches')
  if (new Set(patches).size !== patches.length) throw new Error('duplicate patch')
  for (const file of patches) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.patch$/.test(file)) throw new Error(`invalid patch filename: ${file}`)
    if (!lstatSync(ownedPath(root, `patches/${file}`)).isFile()) throw new Error(`patch is not a regular file: ${file}`)
  }
  for (const file of readdirSync(join(root, 'patches'))) {
    if (file.endsWith('.patch') && !patches.includes(file)) throw new Error(`unregistered patch: ${file}`)
  }
  if (!Array.isArray(value.checks)) throw new Error('checks must be an array')
  const checks = value.checks.map(raw => {
    const entry = object(raw, 'patch check')
    if (Object.keys(entry).sort().join(',') !== 'args,script' || typeof entry.script !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(entry.script)) throw new Error('invalid check script')
    return { script: entry.script, args: strings(entry.args, 'check args') }
  })
  if (patches.length > 0 && checks.length === 0) throw new Error('nonempty patch series requires DSH delivery checks')
  return { patches, checks }
}

export function pin(root: string): string {
  const modulePath = git(root, ['config', '-f', '.gitmodules', '--get', 'submodule.dsh.path']).trim()
  if (modulePath !== 'dsh') throw new Error('expected the dsh submodule at dsh/')
  const entries = git(root, ['ls-files', '--stage', '--', 'dsh']).trim().split('\n')
  const match = /^160000 ([a-f0-9]{40}) 0\tdsh$/.exec(entries[0] ?? '')
  if (entries.length !== 1 || !match) throw new Error('dsh must have one resolved, staged Gitlink')
  return match[1]!
}

export function submodule(root: string): string {
  const directory = ownedPath(root, 'dsh')
  if (realpathSync(git(directory, ['rev-parse', '--show-toplevel']).trim()) !== realpathSync(directory)) throw new Error('dsh is not a distinct Git worktree')
  const superproject = git(directory, ['rev-parse', '--show-superproject-working-tree']).trim()
  if (!superproject || realpathSync(superproject) !== realpathSync(root)) throw new Error('dsh is not owned by this superproject')
  return directory
}

function reset(directory: string, base: string): void {
  git(directory, ['checkout', '--detach', '--force', base])
  git(directory, ['reset', '--hard', base])
  git(directory, ['clean', '-fd'])
}

function apply(root: string, directory: string, series: PatchSeries): void {
  for (const patch of series.patches) git(directory, ['apply', '--index', '--whitespace=error', ownedPath(root, `patches/${patch}`)])
}

export function rebuild(root: string): void {
  const series = readSeries(root)
  const base = pin(root)
  ownedPath(root, 'dsh')
  if (!existsSync(join(root, 'dsh/.git'))) git(root, ['submodule', 'update', '--init', '--checkout', '--', 'dsh'])
  const directory = submodule(root)
  // A changed Gitlink may reference an object absent from an older local clone.
  const probe = spawnSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: directory, stdio: 'ignore' })
  if (probe.status !== 0) git(directory, ['fetch', 'origin', base])
  reset(directory, base)
  try { apply(root, directory, series) } catch (error) {
    try { reset(directory, base) } catch (rollback) { throw new AggregateError([error, rollback], 'patch failed and baseline restoration failed') }
    throw error
  }
}

export function verifyTree(root: string): PatchSeries {
  const series = readSeries(root)
  const base = pin(root)
  const directory = submodule(root)
  if (git(directory, ['rev-parse', 'HEAD']).trim() !== base) throw new Error('DSH HEAD differs from the parent Gitlink; run pnpm run setup')
  const temp = mkdtempSync(join(tmpdir(), 'papermoon-patch-'))
  const clone = join(temp, 'dsh')
  try {
    git(temp, ['clone', '--shared', '--no-checkout', directory, clone])
    git(clone, ['checkout', '--detach', base])
    apply(root, clone, series)
    const expected = git(clone, ['diff', '--binary', '--no-ext-diff', '--no-textconv', base, '--'])
    const actual = git(directory, ['diff', '--binary', '--no-ext-diff', '--no-textconv', base, '--'])
    if (expected !== actual) throw new Error('DSH source differs from the declared patch series')
    if (git(directory, ['ls-files', '--others', '--exclude-standard']).trim()) throw new Error('DSH contains undeclared untracked files')
  } finally { rmSync(temp, { recursive: true, force: true }) }
  return series
}

export async function checkPatches(root: string, signal?: AbortSignal, execute: typeof pnpm = pnpm): Promise<void> {
  signal?.throwIfAborted()
  const series = verifyTree(root)
  const directory = submodule(root)
  const scripts = object(object(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')), 'DSH package').scripts, 'DSH scripts')
  for (const command of series.checks) if (typeof scripts[command.script] !== 'string') throw new Error(`unknown DSH script: ${command.script}`)
  for (const command of series.checks) await execute(directory, ['run', command.script, ...command.args], signal)
  signal?.throwIfAborted()
  verifyTree(root)
  console.log(`PaperMoon patches: source verified; ${series.checks.length} registered DSH checks completed`)
}
