import { expect, test } from 'vitest'
import { build } from 'esbuild'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertRuntimeImports } from '../repository/runtime-imports.ts'

test('bundled sibling imports require a dependency of the emitted plugin even when locally installed', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-imports-'))
  try {
    mkdirSync(join(directory, 'story')); mkdirSync(join(directory, 'writer'))
    writeFileSync(join(directory, 'story/index.js'), "export { read } from '../writer/state.js'\n")
    writeFileSync(join(directory, 'writer/state.js'), "import { readFile } from 'node:fs/promises'; import { schema } from '@fixture/writers/model'; export const read = () => schema(readFile)\n")
    // A stale workspace link can resolve this package without declaring it in the story manifest.
    mkdirSync(join(directory, 'story/node_modules/@fixture/writers'), { recursive: true })
    const result = await build({ entryPoints: [join(directory, 'story/index.js')], bundle: true,
      platform: 'node', format: 'esm', packages: 'external', write: false, metafile: true })
    expect(() => assertRuntimeImports({ name: '@fixture/story' }, result.metafile)).toThrow('@fixture/writers')
    expect(() => assertRuntimeImports({ name: '@fixture/story', dependencies: { '@fixture/writers': 'workspace:*' } }, result.metafile)).not.toThrow()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
