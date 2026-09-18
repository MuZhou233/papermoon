import { afterEach, expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from '@papermoon/story-core/repository'
import { CompilationService, ArtifactStore } from '@papermoon/story-compiler/service'
import { Performances, type PerformanceHost } from '../src/service.ts'
import { performanceState, openingMessages } from '../src/model.ts'
import { PRESET, CONFIG_KEY } from '../src/constants.ts'
import { StoryWorkspaces } from '../../story-workspaces/src/index.ts'
import type { Agent, LogRecord, Decision } from '../../story-workspaces/src/host.ts'
const cleanup: (() => void | Promise<void>)[] = []
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close() })
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'papermoon-performance-')), path = join(directory, 'story.sqlite')
  const storage = new StoryStorage({ path }), core = new StoryRepository(storage)
  cleanup.push(() => { storage.close(); rmSync(directory, { recursive: true, force: true }) })
  const compiler = new CompilationService(core, new ArtifactStore(join(directory, 'compiled')))
  cleanup.push(() => compiler.close())
  const project = core.createProject({ name: 'P' }), script = core.createScript({ projectId: project.id, name: 'S', defaultLanguage: 'en' })
  core.editDraft({ scriptId: script.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'story.js', source: 'module.exports={systemPrompt:"  {{literal}}",messages:[{role:"assistant",content:"Welcome",name:"Opening"},{role:"user",content:"Background"},{role:"user",content:""}]}' }] })
  const result = await compiler.submit({ scriptId: script.id, expectedSequence: 1, description: 'First' })
  if (!result.committed) throw new Error('fixture failed')
  await compiler.close()
  const agents = new Map<string, Agent>(), logs = new Map<string, LogRecord[]>(), variables = new Map<string, () => string>()
  const steps = new Map<string, (p: { agent: Agent; signal: AbortSignal }, next: () => Promise<Decision>) => Promise<Decision>>()
  let created = 0
  function create(id: string, seed: readonly LogRecord[] = []) {
    const events = structuredClone([...seed]), effects: (() => void)[] = []
    const agent: Agent = { id, status: 'idle', followup() {}, async whenIdle() {}, inbox: { nextTurn: [], nextStep: [], clear() {} },
      ctx: { effect(body) { effects.push(body()) }, on(_name, listener) { if (_name !== 'agent/pre-step') return () => {}; steps.set(id, listener as Parameters<typeof steps.set>[1]); return () => { steps.delete(id) } },
        tools: { register() { throw new Error('performance cannot register a tool') }, presentAs: () => () => {} },
        systemPrompt: { context: () => () => {}, section: () => () => {}, variable(name, value) { variables.set(id + '/' + name, value); return () => { variables.delete(id + '/' + name) } } } },
      session: { header: { agentPreset: PRESET }, snapshotEvents: () => [...events], deriveRequestMessages: () => [], append(type,data) { events.push({ seq: events.length, time: Date.now(), type, data: structuredClone(data) }) } },
      async runMaintenance(task) { return task(new AbortController().signal) },
    }
    agents.set(id, agent); logs.set(id, events); created++
    return agent
  }
  let service: Performances
  const host = { sessions: { flush: async () => true }, agents: { get: (id: string) => agents.get(id), list: () => [...agents.values()] },
    sessionController: {
      list: async () => ({ items: [...logs.keys()].map(sessionId => ({ sessionId })) }),
      inspect: async (id: string) => ({ meta: { agentPreset: PRESET }, events: logs.get(id)! }),
      resolveAgent: async (id: string) => ({ agent: agents.get(id) ?? create(id, logs.get(id)) }),
      create: async ({ sessionId }: { sessionId: string }) => { const agent = agents.get(sessionId) ?? create(sessionId); service.prepare(agent, script.id); return { sessionId } },
      selectModel: async () => {},
    },
    workspaceRegistry: { list: () => [], createResource: async () => ({ id: 'workspace', title: script.name, sessionIds: [], setTitle: async () => {} }) },
  } as unknown as PerformanceHost
  const workspaces = new StoryWorkspaces(host, core, directory)
  service = new Performances(host, core, workspaces); cleanup.push(() => service.close())
  const input = { sessionId: 'play', scriptId: script.id, revisionId: result.revision.id, key: 'opening/0' }
  return { core, storage, path, script, input, service, create, agents, logs, variables, steps, created: () => created }
}
test('initializes once without a compiler and replays the complete frozen context after source deletion', async () => {
  const f = await fixture()
  const [first, retry] = await Promise.all([f.service.start(f.input), f.service.start(f.input)])
  expect(retry).toEqual(first); expect(f.created()).toBe(1)
  const agent = f.agents.get('play')!
  expect(agent.session.snapshotEvents().filter(e => e.type === 'session/configuration' && (e.data as { key: string }).key === CONFIG_KEY)).toHaveLength(1)
  expect(agent.session.snapshotEvents().some(e => e.type === 'user/message' || e.type === 'assistant/message')).toBe(false)
  f.core.deleteScript(f.script.id)
  expect(await f.service.start(f.input)).toEqual(first)
  expect(await f.service.view('play')).toMatchObject({ sourceMissing: true })
  const message = { id: 'user', role: 'user' as const, content: [{ type: 'text', text: 'Continue' }], source: { kind: 'user', admission: { historyVersion: 1 } } }
  expect(await f.service.admit(agent, message)).toEqual(message)
  expect(f.variables.get('play/papermoon_performance_prompt')!()).toBe('')
  const decision = await f.steps.get('play')!({ agent, signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [message] }))
  expect(decision).toMatchObject({ initialMessages: openingMessages(first.fixed) })
  const fork = f.create('fork', agent.session.snapshotEvents()); f.service.attach(fork)
  expect(openingMessages(performanceState(fork.session).fixed!)).toEqual(openingMessages(first.fixed))
  f.agents.delete('play')
  expect(await f.service.start(f.input)).toEqual(first)
  await f.service.close(); expect(f.variables.size).toBe(0)
})
test('refuses missing attachments and cannot turn an incomplete revision into a playable one', async () => {
  const f = await fixture(), db = new DatabaseSync(f.path)
  db.prepare('DELETE FROM revision_attachments WHERE revision_id=?').run(f.input.revisionId); db.close()
  await expect(f.service.start(f.input)).rejects.toMatchObject({ code: 'corrupt' })
  expect(f.created()).toBe(0)
  const empty = f.core.commitRevision({ scriptId: f.script.id, expectedSequence: 2, description: 'Uncompiled' })
  expect(f.service.choices(f.script.id).entry?.revision.id).toBe(empty.revision.id)
  await expect(f.service.start({ ...f.input, revisionId: empty.revision.id })).rejects.toMatchObject({ code: 'artifact-not-found' })
})
test('freezes mode and identity and refuses damaged initialization rather than reading source again', async () => {
  const f = await fixture()
  const empty = f.create('empty')
  await expect(f.service.admit(empty, { id: 'u', role: 'user', content: [], source: { kind: 'user' } })).rejects.toThrow(/initialize/)
  await f.service.start(f.input)
  await expect(f.service.start({ ...f.input, key: 'opening/1' })).rejects.toThrow(/fixed/)
  const events = f.logs.get('play')!
  const event = events.find(e => e.type === 'session/configuration' && (e.data as { key: string }).key === CONFIG_KEY)!
  ;(event.data as { value: { scriptName: string } }).value.scriptName = 'tampered'
  expect(() => performanceState(f.agents.get('play')!.session)).toThrow(/checksum/)
})


test('pages permanent node ordinals and reads full input independently of a summary', async () => {
  const f = await fixture(); await f.service.start(f.input)
  const agent = f.agents.get('play')!
  let view = await f.service.view('play')
  for (let index = 0; index < 104; index++) {
    const input = { id: 'page-' + index, role: 'user' as const, content: [{ type: 'text', text: 'x'.repeat(600) }], source: { kind: 'user', admission: { historyVersion: view.worldline!.version } } }
    await f.service.admit(agent, input)
    agent.session.append('turn/start', { turn: agent.session.snapshotEvents().filter(event=>event.type==='turn/start').length+1 }); agent.session.append('user/message', input)
    agent.session.append('turn/end', { turn: index + 1, reason: { kind: 'completed' } })
    view = await f.service.view('play')
  }
  const first = await f.service.tree('play'), last = await f.service.tree('play', 100)
  expect(first.items).toHaveLength(100); expect(last.items.map(node => node.ordinal)).toEqual([100,101,102,103,104])
  expect(last.total).toBe(105)
  const node = await f.service.node('play', last.items[0]!.id)
  expect(node.node.input!.content).toEqual([{ type: 'text', text: 'x'.repeat(600) }])
  expect(last.items[0]!.input!.content).toEqual([{ type: 'text', text: 'x'.repeat(500) }])
  await f.service.operation('play', { kind: 'select', nodeId: first.items[2]!.id, expectedVersion: view.worldline!.version, operationId: 'page-select' })
  expect(await f.service.tree('play', 100)).toEqual(last)
  await expect(f.service.tree('play', 0, 101)).rejects.toThrow('invalid worldline page')
})

test('inspects siblings outside the active path without changing selection or history', async () => {
  const f = await fixture(); await f.service.start(f.input)
  const agent = f.agents.get('play')!
  const append = async (id: string) => {
    const view = await f.service.view('play')
    const input = { id, role: 'user' as const, content: [{ type: 'text', text: id }], source: { kind: 'user', admission: { historyVersion: view.worldline!.version } } }
    await f.service.admit(agent, input)
    agent.session.append('turn/start', { turn: agent.session.snapshotEvents().filter(event=>event.type==='turn/start').length+1 }); agent.session.append('user/message', input)
    agent.session.append('turn/end', { reason: { kind: 'completed' } })
    return (await f.service.view('play')).worldline!.selected
  }
  const select = async (nodeId: string, operationId: string) => {
    const view = await f.service.view('play')
    await f.service.operation('play', { kind: 'select', nodeId, operationId, expectedVersion: view.worldline!.version })
  }
  const a = await append('a'), b = await append('b'), c = await append('c')
  await select(b, 'back-to-b')
  const alternative = await append('alternative-c')
  await select(a, 'back-to-a')
  const active = await append('active')
  const before = await f.service.view('play'), count = agent.session.snapshotEvents().length
  expect(before.worldline!.nodes.some(node => node.id === c)).toBe(false)
  const detail = await f.service.node('play', c)
  expect(detail.siblings.map(node => node.id)).toEqual([c, alternative])
  expect(detail.siblings.map(node => node.ordinal)).toEqual([3, 4])
  expect((await f.service.view('play')).worldline).toEqual(before.worldline)
  expect(before.worldline!.selected).toBe(active)
  expect(agent.session.snapshotEvents()).toHaveLength(count)
})

test('persists the context before dispatch and reuses a turn base without recomposing', async () => {
  const { PerformanceContext, eventMessage, contextRecord } = await import('../src/composition.ts')
  const { StoryRuntime } = await import('@papermoon/story-compiler/execution')
  const f=await fixture(), first=await f.service.start(f.input), agent=f.agents.get('play')!
  const runtime=new StoryRuntime();cleanup.push(()=>runtime.close())
  const input={id:'compose-input',role:'user' as const,content:[{type:'text',text:'exact input'}],source:{kind:'user',admission:{historyVersion:1}}}
  await f.service.admit(agent,input)
  for(const entry of openingMessages(first.fixed))agent.session.append('context/message',entry)
  agent.session.append('turn/start', { turn: agent.session.snapshotEvents().filter(event=>event.type==='turn/start').length+1 }); agent.session.append('user/message',input)
  const expand=(seq?:number):import('../../story-workspaces/src/host.ts').RequestMessage[]=>{
    if(seq===undefined)return []
    const events=agent.session.snapshotEvents(), record=contextRecord(events[seq]!)!
    return [...(record.base===undefined?[]:expand(record.base)),...record.messages.map(p=>'message'in p?p.message:eventMessage(events[p.eventSeq]!)!)]
  }
  agent.session.deriveRequestMessages=expand
  let flushes=0
  const context=new PerformanceContext(agent,first.fixed,runtime,async()=>{flushes++;return true})
  const compose = runtime.compose.bind(runtime)
  vi.spyOn(runtime,'compose').mockImplementation(async (...args) => {
    const result = await compose(...args)
    agent.session.append('session/configuration',{key:'concurrent-metadata',value:{}})
    agent.session.append('context/message',{groupId:'explicit-plugin',index:0,message:{id:'plugin-input',role:'user',content:[{type:'text',text:'Explicit plugin contribution'}],source:{kind:'plugin',plugin:'fixture'}}})
    return result
  })
  const seq=await context.request(1,1,new AbortController().signal)
  expect(contextRecord(agent.session.snapshotEvents()[seq]!)?.turn).toBe(1)
  expect(expand(seq).at(-1)?.id).toBe('plugin-input')
  expect(flushes).toBe(1)
  const original=expand(seq)
  await runtime.close()
  agent.session.append('assistant/message',{turn:1,step:1,message:{id:'reply',role:'assistant',content:[{type:'text',text:'reply'}],source:{kind:'model'}}})
  const next=await context.request(1,2,new AbortController().signal)
  expect(expand(next)).toEqual([...original,eventMessage(agent.session.snapshotEvents()[next-1]!)])
  expect(contextRecord(agent.session.snapshotEvents()[next]!)!.metadata.plan).toBeUndefined()
  expect((await f.service.request('play',seq)).messages).toEqual(original)
  const source=agent.session.snapshotEvents().find(e=>e.type==='user/message')!
  ;(source.data as {content:{text:string}[]}).content[0]!.text='corrupted'
  await expect(f.service.request('play',seq)).rejects.toThrow('checksum')
})
test('blocks future requests when context durability is uncertain', async()=>{
  const {PerformanceContext}=await import('../src/composition.ts')
  const {StoryRuntime}=await import('@papermoon/story-compiler/execution')
  const f=await fixture(),first=await f.service.start(f.input),agent=f.agents.get('play')!
  const runtime=new StoryRuntime();cleanup.push(()=>runtime.close())
  const input={id:'u-save',role:'user' as const,content:[],source:{kind:'user',admission:{historyVersion:1}}}
  await f.service.admit(agent,input)
  for(const entry of openingMessages(first.fixed))agent.session.append('context/message',entry)
  agent.session.append('turn/start', { turn: agent.session.snapshotEvents().filter(event=>event.type==='turn/start').length+1 }); agent.session.append('user/message',input)
  const context=new PerformanceContext(agent,first.fixed,runtime,async()=>{throw new Error('disk unavailable')})
  await expect(context.request(1,1,new AbortController().signal)).rejects.toMatchObject({code:'context-save-failed'})
  const count=agent.session.snapshotEvents().length
  expect(()=>context.assertAvailable()).toThrow('unconfirmed')
  await expect(context.request(1,1,new AbortController().signal)).rejects.toThrow('unconfirmed')
  expect(agent.session.snapshotEvents()).toHaveLength(count)
})
