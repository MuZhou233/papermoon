import { afterEach, expect, test } from 'vitest'
import { applyOperations, createContent } from '@papermoon/story-core'
import { compile } from '../src/index.ts'
import { StoryRuntime } from '../src/execution.ts'
import type { Artifact } from '../src/types.ts'

export const source = `const {t}=require('@papermoon/story');
function factory({state}) {
  let local = 0;
  /** Increase the stored value.
   * @param {number} [amount] Increment.
   * @returns {{value:number, local:number}} Current value and invocation-local count.
   */
  return function increment(amount = 1) {
    local++;
    state.value += amount;
    if (state.value > 10) throw new Error('limit exceeded');
    return {value:state.value,local};
  };
}
module.exports={systemPrompt:'',messages:[],state:{initial:{value:0},schema:{type:'object',properties:{value:{type:'number'}},required:['value'],additionalProperties:false}},functions:[factory]};`
export function content(program = source) {
  return applyOperations(createContent({ defaultLanguage: 'en' }), [{ kind: 'create-file', path: 'story.js', source: program }])
}
const runtimes: StoryRuntime[] = []
afterEach(async () => { await Promise.all(runtimes.splice(0).map(runtime => runtime.close())) })
async function setup(program = source) {
  const result = await compile(content(program))
  if (!result.ok) throw new Error(JSON.stringify(result))
  const runtime = new StoryRuntime(); runtimes.push(runtime)
  return { artifact: result.artifact, runtime }
}
test('freezes JSDoc and uses original arguments, defaults and return values', async () => {
  const { artifact, runtime } = await setup()
  expect(artifact.functions[0]).toMatchObject({ name: 'increment', description: 'Increase the stored value.', parameters: { properties: { amount: { type: 'number', description: 'Increment.' } }, required: [] }, arguments: ['amount'] })
  expect(await runtime.invoke(artifact, artifact.state.initial, 'increment', {})).toEqual({ ok: true, state: { value: 1 }, value: { value: 1, local: 1 } })
  expect(await runtime.invoke(artifact, { value: 2 }, 'increment', { amount: 3 })).toEqual({ ok: true, state: { value: 5 }, value: { value: 5, local: 1 } })
  expect(artifact.state.initial).toEqual({ value: 0 })
})
test('rolls back thrown errors, validates inputs and outputs, and never coerces strings', async () => {
  const { artifact, runtime } = await setup(), state = { value: 8 }
  expect(await runtime.invoke(artifact, state, 'increment', { amount: 3 })).toMatchObject({ ok: false, diagnostics: [{ message: 'limit exceeded', location: { path: 'story.js' } }] })
  expect(state).toEqual({ value: 8 })
  expect(await runtime.invoke(artifact, state, 'increment', { amount: '2' })).toMatchObject({ ok: false, diagnostics: [{ code: 'schema-validation' }] })
  expect(await runtime.invoke(artifact, state, 'increment', { other: 2 })).toMatchObject({ ok: false })
  const invalid = await setup(source.replace('return {value:state.value,local};', 'return null;'))
  expect(await invalid.runtime.invoke(invalid.artifact, { value: 0 }, 'increment', {})).toMatchObject({ ok: false, diagnostics: [{ code: 'schema-validation' }] })
})
test('treats business flags as ordinary data and never appends state to the return value', async () => {
  const s = source.replace('@returns {{value:number, local:number}}', '@returns {{status:string}}').replace('return {value:state.value,local};', "return {status:'rejected'};")
  const { artifact, runtime } = await setup(s)
  expect(await runtime.invoke(artifact, { value: 0 }, 'increment', {})).toEqual({ ok: true, state: { value: 1 }, value: { status: 'rejected' } })
})
test.each([
  ['let local = 0;', 'state.value++;', 'invalid-declaration'],
  ['@param {number} [amount]', '@param {unknown} [amount]', 'invalid-jsdoc'],
  ['@param {number} [amount]', '@param {number} [wrong]', 'invalid-jsdoc'],
  ['@returns {{value:number, local:number}}', '@returns {Promise<number>}', 'invalid-jsdoc'],
  ['function increment(amount = 1)', 'function increment(...amount)', 'invalid-jsdoc'],
  ['function increment(amount = 1)', 'function increment({amount})', 'invalid-jsdoc'],
  ['functions:[factory]', 'functions:[factory,factory]', 'invalid-declaration'],
  ['function increment', 'function run_code', 'invalid-jsdoc'],
  ['initial:{value:0}', 'initial:{value:"wrong"}', 'schema-validation'],
  ["schema:{type:'object'", "schema:{$async:true,type:'object'", 'invalid-schema'],
])('rejects unsupported declarations: %s → %s', async (from, to, code) => {
  expect(await compile(content(source.replace(from, to)))).toMatchObject({ ok: false, diagnostics: [{ code }] })
})

test('resolves same-file typedefs, nested properties, arrays, nullable unions and literals', async () => {
  const s = `/** @typedef {{enabled:boolean, values:number[], tag:('x'|'y'), note:(string|null)}} Input */
function factory({state}) {
/** Return input.
 * @param {Input} input Input data.
 * @returns {Input} The same data.
 */
return function echo(input) { return input; }
}
module.exports={systemPrompt:'',messages:[],functions:[factory]};`
  const { artifact, runtime } = await setup(s)
  const value = { enabled: true, values: [1,2], tag: 'x', note: null }
  expect(await runtime.invoke(artifact, {}, 'echo', { input: value })).toEqual({ ok: true, state: {}, value })
  expect(await runtime.invoke(artifact, {}, 'echo', { input: { ...value, tag: 'z' } })).toMatchObject({ ok: false })
  expect(await compile(content(s.replace('values:number[]', 'values:Input[]')))).toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-jsdoc' }] })
})
test('blocks factory writes through nested references and factory returns without named source', async () => {
  expect(await compile(content(source.replace('let local = 0;', 'Object.defineProperty(state,"value",{value:1});')))).toMatchObject({ ok: false })
  expect(await compile(content(source.replace('return function increment', 'return function')))).toMatchObject({ ok: false })
})
test('does not execute functions during compilation, and terminates failed runtime jobs', async () => {
  const { artifact, runtime } = await setup(source.replace('local++;', 'while(true){}'))
  const tuned = { ...artifact, options: { ...artifact.options, limits: { ...artifact.options.limits, executionMs: 20 } } }
  const { createArtifact } = await import('../src/runtime.ts')
  const bounded: Artifact = createArtifact(artifact.sourceHash, tuned.options, artifact)
  expect(await runtime.invoke(bounded, { value: 0 }, 'increment', {})).toMatchObject({ ok: false, diagnostics: [{ code: 'timeout' }] })
  const controller = new AbortController(), call = runtime.invoke(artifact, { value: 0 }, 'increment', {}, controller.signal)
  controller.abort(); expect(await call).toMatchObject({ ok: false, diagnostics: [{ code: 'cancelled' }] })
  await runtime.close()
  expect(await runtime.invoke(artifact, { value: 0 }, 'increment', {})).toMatchObject({ ok: false, diagnostics: [{ code: 'closed' }] })
})

test('blocks factory writes through property descriptors and rejects lossy JSON state', async () => {
  const nested = source.replace('initial:{value:0}', 'initial:{value:{nested:0}}').replace("properties:{value:{type:'number'}}", "properties:{value:{type:'object'}}")
  expect(await compile(content(nested.replace('let local = 0;', "Object.getOwnPropertyDescriptor(state,'value').value.nested = 1;")))).toMatchObject({ ok: false })
  const { artifact, runtime } = await setup(source.replace('local++;', "Object.defineProperty(state,'extra',{value:1});"))
  expect(await runtime.invoke(artifact, { value: 0 }, 'increment', {})).toMatchObject({ ok: false })
})

test('runs frozen dependencies and exact-language text without reading current content', async () => {
  const input = applyOperations(content(`const factory=require('./functions.js'); module.exports={systemPrompt:'',messages:[],functions:[factory]};`), [
    { kind: 'create-file', path: 'functions.js', source: `const {t}=require('@papermoon/story');
module.exports = function factory({state}) {
/** Read a stored message.
 * @param {boolean} fail Throw the message.
 * @returns {string} Stored message.
 */
return function message(fail) { const text=t('message'); if(fail) throw new Error(text); return text; }
};` },
    { kind: 'create-text', key: 'message' },
    { kind: 'set-translation', key: 'message', language: 'en', text: 'Frozen text' },
  ])
  const compiled = await compile(input)
  expect(compiled.ok).toBe(true)
  if (!compiled.ok) return
  expect(Object.keys(compiled.artifact.program.files).sort()).toEqual(['functions.js', 'story.js'])
  const runtime = new StoryRuntime(); runtimes.push(runtime)
  expect(await runtime.invoke(compiled.artifact, {}, 'message', { fail: false })).toEqual({ ok: true, state: {}, value: 'Frozen text' })
  expect(await runtime.invoke(compiled.artifact, {}, 'message', { fail: true })).toMatchObject({ ok: false, diagnostics: [{ message: 'Frozen text', location: { path: 'functions.js' } }] })
})

test('rejects factories that change the frozen implementation according to current state', async () => {
  const conditional = source.replace('let local = 0;', `let local = 0;
if (state.value > 0) return function increment(amount = 1) { return {value:0,local:0}; };`)
  const {artifact, runtime} = await setup(conditional)
  expect(await runtime.invoke(artifact, {value:1}, 'increment', {})).toMatchObject({ok:false, diagnostics:[{message:'runtime function differs from frozen declaration: increment'}]})
})

function echoSource(type: string, aliases = '') {
  return `${aliases}
function factory({state}) {
/** Return the supplied value.
 * @param {${type}} input Input value.
 * @returns {${type}} The supplied value.
 */
return function echo(input) { return input; }
}
module.exports={systemPrompt:'',messages:[],functions:[factory]};`
}

test('resolves adjacent typedef blocks and property declarations in their original file', async () => {
  const aliases = `/** @typedef {object} First
 * @property {number} count Counter.
 */
/** @typedef {object} Second
 * @property {First[]} values Counters.
 */
/** @typedef {{groups: Second[]}} Third */`
  const {artifact, runtime} = await setup(echoSource('Third', aliases))
  const value = {groups:[{values:[{count:3}]}]}
  expect(await runtime.invoke(artifact, {}, 'echo', {input:value})).toEqual({ok:true,state:{},value})
  expect(await runtime.invoke(artifact, {}, 'echo', {input:{groups:[{values:[{count:'3'}]}]}})).toMatchObject({ok:false})
  const duplicate = await compile(content(echoSource('First', aliases + '\n/** @typedef {number} First */')))
  expect(duplicate).toMatchObject({ok:false,diagnostics:[{message:'ambiguous typedef First',location:{path:'story.js',line:8}}]})
})

test.each(['Record<string, Entry>', 'Object<string, Entry>', '{[key:string]: Entry}'])('executes typed dictionaries: %s', async type => {
  const {artifact, runtime} = await setup(echoSource(type, '/** @typedef {{count:number, note:(string|null)}} Entry */'))
  const value = JSON.parse('{"a":{"count":1,"note":null},"__proto__":{"count":2,"note":"x"}}')
  expect(await runtime.invoke(artifact, {}, 'echo', {input:value})).toEqual({ok:true,state:{},value})
  expect(await runtime.invoke(artifact, {}, 'echo', {input:{a:{count:'1',note:null}}})).toMatchObject({ok:false})
  expect(await runtime.invoke(artifact, {}, 'echo', {input:[]})).toMatchObject({ok:false})
})

test.each(['object','Record<number, string>','Record<string, unknown>','{[key:number]: string}','Missing'])('locates unsupported types in the annotation: %s', async type => {
  const result = await compile(content(echoSource(type)))
  expect(result).toMatchObject({ok:false,diagnostics:[{code:'invalid-jsdoc',location:{path:'story.js',line:4}}]})
})
