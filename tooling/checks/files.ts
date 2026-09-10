/** Main-repository inventory. Never follows symlinks or descends into DSH. */
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const excluded = new Set(['node_modules', '.git', 'coverage'])
const rootExcluded = new Set(['dsh', '.papermoon'])

export function repoFiles(root: string, directory = ''): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = directory ? `${directory}/${entry.name}` : entry.name
    if (!directory && (rootExcluded.has(entry.name) || /^\.env(?:\.|$)/.test(entry.name))) return []
    if (excluded.has(entry.name) || entry.name === '.DS_Store') return []
    if (entry.isSymbolicLink()) throw new Error(`${path}: symlinks are not supported in main-repository sources`)
    return entry.isDirectory() ? repoFiles(root, path) : [path]
  }).sort()
}

/** Resolve an owned path, rejecting traversal and symlinked ancestors. */
export function ownedPath(root: string, path: string): string {
  if (!path || isAbsolute(path) || path.includes('\\') || path.split('/').some(p => p === '..' || p === '.' || p === '')) {
    throw new Error(`invalid repository-relative path: ${path}`)
  }
  const absolute = resolve(root, path)
  if (relative(root, absolute).startsWith(`..${sep}`)) throw new Error(`path escapes repository: ${path}`)
  let cursor = root
  for (const part of path.split('/')) {
    cursor = join(cursor, part)
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error(`symlinked path is not supported: ${path}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return absolute
}

export const isArchivedAgentNotePath = (path: string): boolean =>
  /^\.agents\/notes\/archived\/[^/]+\//.test(path.replaceAll('\\', '/'))

export function readText(root: string, path: string): string {
  return readFileSync(ownedPath(root, path), 'utf8')
}

export function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`)
  return value as Record<string, unknown>
}

export function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some(x => typeof x !== 'string')) throw new Error(`${label}: expected string array`)
  return value as string[]
}
