/** Build the public DSH factory format without importing its build tooling. */
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const out = resolve('plugins/story-editor/lib')
await mkdir(out, { recursive: true })
await build({
  entryPoints: ['plugins/story-editor/src/index.ts'],
  outfile: out + '/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
})
const result = await build({
  entryPoints: ['plugins/story-editor/src/client/index.tsx'],
  outfile: out + '/client.js',
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  metafile: true,
})
const js = result.outputFiles.find((f) => f.path.endsWith('.js'))!.text,
  css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? ''
const factory = `window.__ModuleLoader__.load({id:"@papermoon/story-editor",factory:function(require){const module={exports:{}};const exports=module.exports;const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);
${js}
return module.exports;}});
`
await writeFile(out + '/client.js', factory)
await writeFile(
  out + '/meta.json',
  JSON.stringify(result.metafile, null, 2) + '\n',
)
