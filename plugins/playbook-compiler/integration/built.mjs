/** Built worker and runtime use plain Node without experimental flags or TS loaders. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createContent, applyOperations } from '../../playbook-core/lib/index.js'
import { compile } from '../lib/index.js'
const content = applyOperations(createContent({ defaultLanguage: 'en' }), [
  { kind: 'create-file', path: 'playbook.js', source: 'module.exports={systemPrompt:"{{literal}}",messages:[{role:"assistant",content:"Opening"}]}' },
])
const result = await compile(content)
assert.equal(result.ok, true, JSON.stringify(result))
const runtime = new URL('../lib/runtime.js', import.meta.url).href
const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { registerHooks } from 'node:module';
  registerHooks({ resolve(specifier, context, next) {
    if (['node:fs', 'node:fs/promises', 'node:worker_threads', 'node:sqlite'].includes(specifier) || specifier.includes('playbook-core') || specifier.includes('cordis')) throw new Error('runtime imported ' + specifier);
    return next(specifier, context);
  }});
  const { loadArtifact, initialize } = await import(${JSON.stringify(runtime)});
  let text=''; for await (const chunk of process.stdin) text+=chunk;
  assert.equal(initialize(loadArtifact(text)).systemPrompt,'{{literal}}');
`], { input: JSON.stringify(result.artifact), encoding: 'utf8', timeout: 10000, env: {} })
assert.equal(child.status, 0, child.stderr)
console.log(`PaperMoon compiler: built Worker and independent text runtime passed on ${process.version}`)
