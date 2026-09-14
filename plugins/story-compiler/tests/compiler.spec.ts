import { describe, it, expect } from 'vitest'
import { createContent, applyOperations } from '@papermoon/story-core'
import { compile, StoryCompiler } from '../src/index.ts'
import { initialize, loadArtifact, digest } from '../src/runtime.ts'

function story(source: string, files: Record<string, string> = {}) {
  return applyOperations(createContent({ defaultLanguage: 'en' }), [
    ...Object.entries({ 'story.js': source, ...files }).map(([path, source]) => ({ kind: 'create-file' as const, path, source })),
    { kind: 'add-language', language: 'zh-CN' },
    { kind: 'create-text', key: 'system' },
    { kind: 'set-translation', key: 'system', language: 'en', text: 'Hello {{name}}\r\n' },
    { kind: 'set-translation', key: 'system', language: 'zh-CN', text: '你好 {{name}}\r\n' },
    { kind: 'create-text', key: 'blank' },
    { kind: 'set-translation', key: 'blank', language: 'en', text: '' },
  ])
}
const valid = 'module.exports={systemPrompt:"", messages:[]};'
describe('CommonJS initialization', () => {
  it('resolves multiple files and exact-language text, preserving literal roles and whitespace', async () => {
    const input = story('const {defineStory,t}=require("@papermoon/story"); const messages=require("./parts/messages.js"); module.exports=defineStory({systemPrompt:t("system"),systemPromptName:"Role",messages});', {
      'parts/messages.js': 'module.exports=[{name:"One",role:"user",content:""},{role:"user",content:"{{x}}\\n"},{role:"assistant",content:"A"}];',
      'unused.js': 'invalid syntax !!!',
    })
    const english = await compile(input), chinese = await compile(input, { language: 'zh-CN' })
    expect(english.ok && english.artifact.context).toEqual({ systemPrompt: 'Hello {{name}}\r\n', systemPromptName: 'Role', messages: [{ name: 'One', role: 'user', content: '' }, { role: 'user', content: '{{x}}\n' }, { role: 'assistant', content: 'A' }] })
    expect(chinese.ok && chinese.artifact.context.systemPrompt).toBe('你好 {{name}}\r\n')
    expect(english.ok && chinese.ok && english.artifact.id !== chinese.artifact.id).toBe(true)
  })
  it('creates fresh module state per job and caches a module within one job', async () => {
    const input = story('const a=require("./a.js"),b=require("./a.js"); module.exports={systemPrompt:String(a===b)+":"+a.count,messages:[]};', { 'a.js': 'globalThis.count=(globalThis.count||0)+1;module.exports={count:globalThis.count};' })
    const a = await compile(input), b = await compile(input)
    expect(a.ok && a.artifact.context.systemPrompt).toBe('true:1')
    expect(b).toEqual(a)
  })
  it.each([
    ['module.exports=require("node:fs")', 'module-forbidden'],
    ['module.exports=require("../outside.js")', 'module-forbidden'],
    ['module.exports=require("./other")', 'module-forbidden'],
    ['module.exports=require("./missing.js")', 'module-not-found'],
    ['import x from "./x.js";', 'unsupported-syntax'],
    ['import("./x.js")', 'unsupported-syntax'],
    ['async function x(){}', 'unsupported-syntax'],
    ['module.exports={systemPrompt:1,messages:[]}', 'invalid-declaration'],
    ['module.exports={systemPrompt:"",messages:[],extra:true}', 'invalid-declaration'],
    ['module.exports={systemPrompt:"",messages:[{role:"system",content:""}]}', 'invalid-declaration'],
    ['module.exports={get systemPrompt(){while(true){}},messages:[]}', 'invalid-declaration'],
    ['module.exports={systemPrompt:"",messages:new Array(2)}', 'invalid-declaration'],
    ['module.exports={systemPrompt:require("@papermoon/story").t("absent"),messages:[]}', 'missing-text'],
  ])('rejects %s', async (source, code) => {
    const result = await compile(story(source))
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code }] })
  })
  it.each([
    'import value from "./value.js";',
    'export const value = 1;',
    'export default {};',
    'export * from "./value.js";',
    'import.meta.url;',
  ])('identifies unsupported ESM in dependency source: %s', async (source) => {
    const result = await compile(story('module.exports=require("./part.js");', { 'part.js': '\n  ' + source }))
    expect(result).toMatchObject({ ok: false, diagnostics: [{
      code: 'unsupported-syntax', stage: 'parse',
      message: expect.stringContaining('CommonJS require() and module.exports'),
      location: { path: 'part.js', line: 2, column: 3 },
    }] })
  })
  it('does not treat comments, strings or property names as ESM declarations', async () => {
    const result = await compile(story('// import value from "x";\nconst words = { import: "export default", export: "import.meta" };\nmodule.exports={systemPrompt:words.import,messages:[]};'))
    expect(result).toMatchObject({ ok: true, artifact: { context: { systemPrompt: 'export default' } } })
  })
  it('reports actual unknown declaration fields and the supported members', async () => {
    const root = await compile(story('module.exports={scene:{},run(){}};'))
    expect(root).toMatchObject({ ok: false, diagnostics: [{
      code: 'invalid-declaration', location: { field: 'scene' },
      message: 'unknown declaration field "scene"; allowed fields: ["systemPrompt","systemPromptName","messages","state","functions"]',
    }] })
    const nested = await compile(story('module.exports={systemPrompt:"",messages:[{role:"assistant",content:"",speaker:"A"}]};'))
    expect(nested).toMatchObject({ ok: false, diagnostics: [{
      code: 'invalid-declaration', location: { field: 'messages.0.speaker' },
      message: 'unknown declaration field "speaker"; allowed fields: ["role","name","content"]',
    }] })
    expect(await compile(story('module.exports=42;'))).toMatchObject({ ok: false, diagnostics: [{ location: { field: 'module.exports' } }] })
  })
  it('locates syntax, runtime, declaration and translation errors', async () => {
    const syntax = await compile(story('module.exports=require("./bad.js")', { 'bad.js': '\nconst value = ;' }))
    expect(syntax).toMatchObject({ ok: false, diagnostics: [{ message: 'Invalid CommonJS syntax: Unexpected token', location: { path: 'bad.js', line: 2 } }] })
    const runtime = await compile(story('require("./bad.js")', { 'bad.js': '\nthrow new Error("broken");' }))
    expect(runtime).toMatchObject({ ok: false, diagnostics: [{ message: 'broken', location: { path: 'bad.js', line: 2 } }] })
    const missing = await compile(story('module.exports={systemPrompt:require("@papermoon/story").t("blank"),messages:[]};'), { language: 'zh-CN' })
    expect(missing).toMatchObject({ ok: false, diagnostics: [{ code: 'missing-translation', location: { key: 'blank', language: 'zh-CN', path: 'story.js' } }] })
    expect(await compile(story(valid), { language: 'fr' })).toMatchObject({ ok: false, diagnostics: [{ stage: 'input' }] })
  })
  it('reports cycles with the complete dependency chain', async () => {
    expect(await compile(story('require("./a.js")', { 'a.js': 'require("./b.js")', 'b.js': 'require("./a.js")' }))).toMatchObject({ ok: false, diagnostics: [{ code: 'module-cycle', chain: ['story.js', 'a.js', 'b.js', 'a.js'] }] })
  })
  it('blocks ambient host facilities and dynamic code generation', async () => {
    expect(await compile(story('module.exports={systemPrompt:[typeof process,typeof fetch,typeof Date,typeof Promise,typeof console].join(","),messages:[]};'))).toMatchObject({ ok: true, artifact: { context: { systemPrompt: 'undefined,undefined,undefined,undefined,undefined' } } })
    expect(await compile(story('module.exports=Function("return process")();'))).toMatchObject({ ok: false })
    expect(await compile(story('Math.random();'))).toMatchObject({ ok: false })
  })
  it('bounds execution, input, module and output resources', async () => {
    expect(await compile(story('while(true){}'), { limits: { executionMs: 20 } })).toMatchObject({ ok: false, diagnostics: [{ code: 'timeout' }] })
    expect(await compile(story(valid), { limits: { totalMs: 1 } })).toMatchObject({ ok: false, diagnostics: [{ code: 'timeout' }] })
    expect(await compile(story(valid), { limits: { inputBytes: 1 } })).toMatchObject({ ok: false })
    expect(await compile(story('require("./a.js");' + valid, { 'a.js': '' }), { limits: { modules: 1 } })).toMatchObject({ ok: false, diagnostics: [{ code: 'module-limit' }] })
    expect(await compile(story(valid), { limits: { outputBytes: 1 } })).toMatchObject({ ok: false, diagnostics: [{ code: 'output-limit' }] })
    expect((await compile(story(valid))).ok).toBe(true)
  })
  it('cancels jobs, rejects excess concurrency and drains closing workers', async () => {
    const compiler = new StoryCompiler(), controller = new AbortController()
    const first = compiler.compile(story('while(true){}'), { limits: { concurrency: 1 } }, controller.signal)
    expect(await compiler.compile(story(valid), { limits: { concurrency: 1 } })).toMatchObject({ ok: false, diagnostics: [{ code: 'busy' }] })
    controller.abort()
    expect(await first).toMatchObject({ ok: false, diagnostics: [{ code: 'cancelled' }] })
    const active = compiler.compile(story('while(true){}'))
    compiler.close()
    expect(await active).toMatchObject({ ok: false, diagnostics: [{ code: 'cancelled' }] })
    expect(await compiler.compile(story(valid))).toMatchObject({ ok: false, diagnostics: [{ code: 'closed' }] })
  })
  it('reports Worker resource failure without terminating the host compiler', async () => {
    expect(await compile(story(valid), { limits: { memoryMb: 1 } })).toMatchObject({ ok: false, diagnostics: [{ code: 'worker-failed' }] })
    expect((await compile(story(valid))).ok).toBe(true)
  })
  it('loads immutable JSON artifacts and returns independent contexts', async () => {
    const result = await compile(story(valid))
    if (!result.ok) throw new Error(JSON.stringify(result))
    const artifact = loadArtifact(JSON.stringify(result.artifact)), context = initialize(artifact)
    Reflect.set(context, 'systemPrompt', 'modified')
    expect(initialize(artifact).systemPrompt).toBe('')
    expect(Object.isFrozen(artifact.context.messages)).toBe(true)
    const damaged = structuredClone(artifact)
    Reflect.set(damaged.context, 'systemPrompt', 'tampered')
    expect(() => loadArtifact(JSON.stringify(damaged))).toThrow('checksum')
    expect(() => loadArtifact(JSON.stringify({ ...artifact, version: 1 }))).toThrow('unsupported')
    const { checksum: _checksum, ...invalid } = artifact
    const payload = { ...invalid, context: { systemPrompt: '', messages: [{ role: ['user'], content: '' }] } }
    expect(() => loadArtifact(JSON.stringify({ ...payload, checksum: digest(payload) }))).toThrow('invalid initial message')
  })
})
