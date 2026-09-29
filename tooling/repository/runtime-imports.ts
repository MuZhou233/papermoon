/** Validate the dependencies retained by a host bundle, including imports from bundled sibling sources. */
import { isBuiltin } from 'node:module'
import type { Metafile } from 'esbuild'

interface Manifest {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export function assertRuntimeImports(manifest: Manifest, metafile: Metafile): void {
  const declared = new Set([manifest.name, ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})])
  const missing = new Set<string>()
  for (const output of Object.values(metafile.outputs)) for (const entry of output.imports) {
    if (!entry.external || isBuiltin(entry.path) || entry.path.startsWith('.') || entry.path.startsWith('/')) continue
    const name = entry.path.split('/').slice(0, entry.path.startsWith('@') ? 2 : 1).join('/')
    if (!declared.has(name)) missing.add(name)
  }
  if (missing.size) throw new Error(`${manifest.name}: emitted host imports require runtime dependencies: ${[...missing].sort().join(', ')}`)
}
