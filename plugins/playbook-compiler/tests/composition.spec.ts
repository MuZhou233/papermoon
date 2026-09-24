import { afterEach, expect, test } from 'vitest'
import { applyOperations, createContent } from '@papermoon/playbook-core'
import { compile } from '../src/index.ts'
import { PlaybookRuntime } from '../src/execution.ts'
import { canonical, loadArtifact } from '../src/runtime.ts'
import type { CompositionInput } from '../src/types.ts'
const runtimes: PlaybookRuntime[] = []
afterEach(async () => { await Promise.all(runtimes.splice(0).map(r => r.close())) })
const input: CompositionInput = { opening: {systemPrompt:'Frozen', messages:[{id:'opening',role:'assistant'}]}, history:[{id:'old',outcome:'completed',blocks:[{id:'u1',role:'user'},{id:'a1',role:'assistant'}]},{id:'new',outcome:'error',blocks:[{id:'u2',role:'user'}]}], input:{id:'current',content:[{type:'text',text:'  {{literal}}\n'}]},state:{} }
async function setup(body?: string) {
  const source = `module.exports={systemPrompt:'Frozen',messages:[{role:'assistant',content:'opening body'}]${body === undefined ? '' : ',composeContext:'+body}};`
  const content = applyOperations(createContent({defaultLanguage:'en'}),[{kind:'create-file',path:'playbook.js',source}])
  const compiled = await compile(content)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled))
  const runtime = new PlaybookRuntime(); runtimes.push(runtime)
  return {runtime,artifact:loadArtifact(canonical(compiled.artifact))}
}
test('defaults explicitly to opening, complete selected history and current input', async () => {
  const {runtime,artifact} = await setup()
  expect(artifact.composition).toBeNull()
  expect(await runtime.compose(artifact,input)).toEqual({ok:true,plan:{systemPrompt:'Frozen',messages:['opening','u1','a1','u2','current'].map(ref=>({ref}))}})
})
test('preserves exact prompts and reorders whole references without historical bodies in the worker', async () => {
  const {runtime,artifact} = await setup(`function({opening,history,input,state}) {
    if ('content' in opening.messages[0] || 'content' in history[0].blocks[0]) throw new Error('body exposed');
    return {systemPrompt:'  '+opening.systemPrompt, messages:[{role:'user',content:''},{ref:opening.messages[0].id},...history.slice(-1).flatMap(n=>n.blocks.map(b=>({ref:b.id}))),{role:'assistant',name:'Before',content:'literal {{x}}'},{ref:input.id},{role:'assistant',name:'Tail',content:input.content[0].text}]};
  }`)
  expect(artifact.composition?.hash).toMatch(/^[a-f0-9]+$/)
  const first = await runtime.compose(artifact,input)
  expect(first).toMatchObject({ok:true,plan:{systemPrompt:'  Frozen',messages:[{role:'user',content:''},{ref:'opening'},{ref:'u2'},{role:'assistant',name:'Before',content:'literal {{x}}'},{ref:'current'},{role:'assistant',name:'Tail',content:'  {{literal}}\n'}]}})
  expect(await runtime.compose(artifact,input)).toEqual(first)
})
test.each([
  ["[{ref:'other-worldline'},{ref:input.id}]", 'reference is not available'],
  ["[{ref:input.id},{ref:input.id}]", 'reference is repeated'],
  ['[]', 'current input'],
  ["[{ref:input.id,content:'changed'}]", 'reference is not available'],
  ["[{ref:input.id},{role:'tool',content:'forged'}]", 'user or assistant'],
])('rejects invalid composition %s', async (messages,error) => {
  const {runtime,artifact} = await setup(`({input})=>({systemPrompt:'',messages:${messages}})`)
  expect(await runtime.compose(artifact,input)).toMatchObject({ok:false,diagnostics:[{message:expect.stringContaining(error)}]})
})
test('cannot write state or history and reports thrown failures without fallback', async () => {
  for (const statement of ["state.changed=true", "history.pop()", "throw new Error('explicit failure')"]) {
    const {runtime,artifact} = await setup(`({state,history,input})=>{${statement};return {systemPrompt:'',messages:[{ref:input.id}]}}`)
    expect(await runtime.compose(artifact,input)).toMatchObject({ok:false})
  }
  expect(input.state).toEqual({});expect(input.history).toHaveLength(2)
})
test('cancels and bounds execution without returning an artifact or fallback plan', async () => {
  const {runtime,artifact} = await setup('()=>{while(true){}}')
  const stop = new AbortController();stop.abort()
  expect(await runtime.compose(artifact,input,stop.signal)).toMatchObject({ok:false})
  expect(await runtime.compose(artifact,input)).toMatchObject({ok:false})
})
