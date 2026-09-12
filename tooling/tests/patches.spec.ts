import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { checkPatches, git, readSeries, rebuild, verifyTree } from '../repository/patches.ts'
import { fixture, commit, put } from './helpers.ts'
import { runProcess } from '../repository/process.ts'

const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
function make(): string {
  const upstream = fixture(); const root = fixture(); roots.push(root, upstream)
  put(upstream, 'a.txt', 'base\n')
  put(upstream, '.gitignore', '.env\nnode_modules/\n')
  put(upstream, 'package.json', '{"scripts":{"test":"node check.mjs","fail":"node fail.mjs"}}\n')
  put(upstream, 'check.mjs', 'process.exit(0)\n'); put(upstream, 'fail.mjs', 'process.exit(7)\n')
  commit(upstream)
  git(root, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'dsh'])
  put(root, 'patches/series.json', '{"version":1,"patches":[],"checks":[]}\n')
  return root
}
function addPatch(root: string): void {
  put(root, 'dsh/a.txt', 'first\n')
  put(root, 'patches/001.patch', git(join(root, 'dsh'), ['diff', '--binary']))
  git(join(root, 'dsh'), ['reset', '--hard', 'HEAD'])
  put(root, 'patches/series.json', '{"version":1,"patches":["001.patch"],"checks":[{"script":"test","args":[]}]}\n')
}
describe('patch ownership and reconstruction', () => {
  it('accepts an empty series and reconstructs declared dirty source repeatedly', () => {
    const root = make(); expect(verifyTree(root).patches).toEqual([])
    addPatch(root); rebuild(root); expect(verifyTree(root).patches).toEqual(['001.patch'])
    rebuild(root); expect(readFileSync(join(root, 'dsh/a.txt'), 'utf8')).toBe('first\n')
    expect(verifyTree(root).patches).toEqual(['001.patch'])
  })
  it('retains patch context spaces while rejecting whitespace in source additions', () => {
    const root = make(), directory = join(root, 'dsh')
    put(directory, 'a.txt', 'base\n\nend\n'); commit(directory)
    git(root, ['add', 'dsh'])
    put(directory, 'a.txt', 'first\n\nend\n')
    const patch = git(directory, ['diff', '--binary'])
    expect(patch).toContain('\n \n')
    put(root, 'patches/001.patch', patch)
    put(root, 'patches/series.json', JSON.stringify({ version: 1, patches: ['001.patch'], checks: [{ script: 'test', args: [] }] }))
    put(root, '.gitattributes', readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8'))
    git(root, ['add', '.gitattributes', 'patches'])
    expect(() => git(root, ['diff', '--cached', '--check'])).not.toThrow()
    rebuild(root); verifyTree(root)
    put(root, 'ordinary.txt', 'trailing space \n'); git(root, ['add', 'ordinary.txt'])
    expect(() => git(root, ['diff', '--cached', '--check'])).toThrow()
    put(root, 'patches/001.patch', patch.replace('+first\n', '+first \n'))
    expect(() => rebuild(root)).toThrow(/whitespace/)
    expect(readFileSync(join(directory, 'a.txt'), 'utf8')).toBe('base\n\nend\n')
  })
  it('applies sequential patches in declared order', () => {
    const root = make(); addPatch(root); rebuild(root)
    put(root, 'dsh/a.txt', 'second\n')
    put(root, 'patches/002.patch', git(join(root, 'dsh'), ['diff', '--binary']))
    put(root, 'patches/series.json', JSON.stringify({version: 1, patches: ['001.patch', '002.patch'], checks: [{script: 'test', args: []}]}))
    rebuild(root)
    expect(readFileSync(join(root, 'dsh/a.txt'), 'utf8')).toBe('second\n')
    expect(verifyTree(root).patches).toHaveLength(2)
  })
  it('detects extra files and edits; initialization preserves ignored configuration and parent data', () => {
    const root = make(); addPatch(root); rebuild(root)
    put(root, 'dsh/unregistered.txt', 'extra'); expect(() => verifyTree(root)).toThrow(/untracked/)
    put(root, 'dsh/a.txt', 'unexpected'); expect(() => verifyTree(root)).toThrow(/differs/)
    put(root, 'dsh/.env', 'PRIVATE_CONFIG=true\n'); put(root, '.papermoon/keep', 'data')
    rebuild(root)
    expect(existsSync(join(root, 'dsh/unregistered.txt'))).toBe(false)
    expect(readFileSync(join(root, 'dsh/.env'), 'utf8')).toBe('PRIVATE_CONFIG=true\n')
    expect(readFileSync(join(root, '.papermoon/keep'), 'utf8')).toBe('data')
    expect(verifyTree(root).patches).toEqual(['001.patch'])
  })
  it('restores the base after a later patch fails without partially retaining earlier effects', () => {
    const root = make(); addPatch(root)
    put(root, 'patches/002.patch', 'invalid patch\n')
    put(root, 'patches/series.json', '{"version":1,"patches":["001.patch","002.patch"],"checks":[{"script":"test","args":[]}]}\n')
    expect(() => rebuild(root)).toThrow()
    expect(readFileSync(join(root, 'dsh/a.txt'), 'utf8')).toBe('base\n')
    expect(git(join(root, 'dsh'), ['status', '--porcelain'])).toBe('')
  })
  it('rejects unregistered, repeated, traversing and unchecked patches', () => {
    const root = make(); put(root, 'patches/rogue.patch', 'patch')
    expect(() => readSeries(root)).toThrow(/unregistered/); rmSync(join(root, 'patches/rogue.patch'))
    put(root, 'patches/series.json', '{"version":1,"patches":["../outside.patch"],"checks":[]}\n')
    expect(() => readSeries(root)).toThrow(/filename/)
    addPatch(root)
    put(root, 'patches/series.json', '{"version":1,"patches":["001.patch"],"checks":[]}\n')
    expect(() => readSeries(root)).toThrow(/requires DSH delivery/)
    put(root, 'patches/series.json', '{"version":1,"patches":["001.patch","001.patch"],"checks":[]}\n')
    expect(() => readSeries(root)).toThrow(/duplicate/)
  })
  it('runs declared checks in DSH and does not turn a failed check into source-only success', async () => {
    const root = make(); addPatch(root); rebuild(root)
    const calls: string[][] = []
    await checkPatches(root, undefined, async (cwd, args, signal) => {
      expect(cwd).toBe(join(root, 'dsh')); calls.push(args)
      await runProcess(process.execPath, [join(cwd, 'check.mjs')], cwd, process.env, signal)
    })
    expect(calls).toEqual([['run', 'test']])
    await expect(checkPatches(root, undefined, async cwd => {
      await runProcess(process.execPath, ['fail.mjs'], cwd)
    })).rejects.toThrow(/exit=7/)
    await expect(checkPatches(root, undefined, async cwd => { put(cwd, 'a.txt', 'mutated by check') })).rejects.toThrow(/source differs/)
  })
  it('validates scripts before execution and refuses cancelled checks', async () => {
    const root = make(); addPatch(root); rebuild(root)
    put(root, 'patches/series.json', '{"version":1,"patches":["001.patch"],"checks":[{"script":"missing","args":[]}]}\n')
    await expect(checkPatches(root)).rejects.toThrow(/unknown DSH script/)
    const controller = new AbortController(); controller.abort()
    put(root, 'patches/series.json', '{"version":1,"patches":["001.patch"],"checks":[{"script":"test","args":[]}]}\n')
    let executed = false
    await expect(checkPatches(root, controller.signal, async () => { executed = true })).rejects.toThrow()
    expect(executed).toBe(false)
  })
  it('rejects a symlink to a different checkout before reset', () => {
    const root = make(); const other = fixture(); roots.push(other); put(other, 'keep', 'outside')
    rmSync(join(root, 'dsh'), { recursive: true, force: true }); symlinkSync(other, join(root, 'dsh'))
    expect(() => rebuild(root)).toThrow(/symlink/)
    expect(readFileSync(join(other, 'keep'), 'utf8')).toBe('outside')
  })
})
