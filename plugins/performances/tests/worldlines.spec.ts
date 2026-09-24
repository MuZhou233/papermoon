import { executionPosition, inspectExecution } from '../src/inspection.ts'
import { afterEach, beforeAll, expect, test } from 'vitest'
import { applyOperations, createContent } from '@papermoon/playbook-core'
import { compile } from '@papermoon/playbook-compiler'
import { PlaybookRuntime } from '@papermoon/playbook-compiler/execution'
import { digest } from '@papermoon/playbook-compiler/runtime'
import type { Artifact } from '@papermoon/playbook-compiler/types'
import type { Agent, InputMessage, LogRecord } from '../../playbook-workspaces/src/host.ts'
import type { FrozenPerformance } from '../src/model.ts'
import { PerformanceActions, projectActions } from '../src/actions.ts'
import { Worldlines, activeRecords } from '../src/worldlines.ts'
let artifact: Artifact
beforeAll(async () => {
  const result = await compile(applyOperations(createContent({ defaultLanguage: 'en' }), [{ kind: 'create-file', path: 'playbook.js', source: `function factory({state}) {
/** Increase a counter.
 * @param {number} amount Increment.
 * @returns {number} Counter.
 */
return function add(amount) { state.count += amount; return state.count; }
}
module.exports={systemPrompt:'', messages:[], state:{initial:{count:0},schema:{type:'object',properties:{count:{type:'number'}},required:['count'],additionalProperties:false}},functions:[factory]};` }]))
  if (!result.ok) throw new Error(JSON.stringify(result)); artifact = result.artifact
})
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanup.splice(0)) await close() })
function fixture(seed: readonly LogRecord[] = [], flush = async () => true) {
  const events = structuredClone([...seed]), sent: InputMessage[] = []
  const payload = { originSessionId: 's', playbookId: 'playbook', revisionId: 'r', ordinal: 1, playbookName: 'S', projectName: 'P', description: '', attachmentKey: 'opening/0', artifact }
  const fixed: FrozenPerformance = { ...payload, checksum: digest(payload) }
  const agent = { id: 's', status: 'idle', inbox: { nextTurn: [], nextStep: [], clear() {} },
    session: { snapshotEvents: () => events, append(type: string, data: unknown, intent?: object) {
      const event = { seq: events.length, time: events.length, type, data: structuredClone(data), ...intent }; events.push(event); return event
    } }, followup(input: InputMessage) { sent.push(input) }, async whenIdle() {}, async runMaintenance<T>(fn: (signal: AbortSignal) => Promise<T>) { return fn(new AbortController().signal) },
  } as unknown as Agent
  const runtime = new PlaybookRuntime(), actions = new PerformanceActions(agent, fixed, runtime, flush), lines = new Worldlines(agent, fixed, flush, actions, async (content, operation) => {
    if (!content.some(part => part && typeof part === 'object' && 'type' in part && (part.type !== 'text' || ('text' in part && String(part.text).trim())))) throw new Error('empty prompt')
    const input = await lines.admit({ id: crypto.randomUUID(), role: 'user', content, source: { kind: 'user', rpcId: operation.operationId, admission: { historyVersion: operation.expectedVersion, 'papermoon.worldline': operation } } })
    if (input) agent.followup(input)
  })
  cleanup.push(async () => { lines.dispose(); await actions.close(); await runtime.close() })
  const admit = (id: string, version = lines.state().version) => lines.admit({ id, role: 'user', content: [{ type: 'text', text: id }], source: { kind: 'user', rpcId: id, admission: { historyVersion: version } } })
  const state = () => projectActions(activeRecords(events, fixed), fixed).state
  const finish = async (amount: number, outcome = 'completed') => {
    const run = lines.state().pending!
    agent.session.append('user/message', run.input)
    const callId = run.id
    agent.session.append('tool/call', { turn: 1, step: 1, callId, name: 'add', arguments: JSON.stringify({ amount }) })
    const value = await actions.invoke('add', { amount }, callId, new AbortController().signal)
    agent.session.append('tool/result', { message: { id: callId, role: 'tool', toolCallId: callId, source: { kind: 'tool', callId }, content: [{ type: 'text', text: String(value) }] } })
    agent.session.append('turn/end', { turn: 1, reason: { kind: outcome } })
    await lines.settle(); return lines.state().nodes.get(lines.state().selected)!
  }
  const operation = (kind: 'select' | 'reroll' | 'candidate', nodeId: string, operationId = crypto.randomUUID()) => lines.operate({ kind, nodeId, operationId, expectedVersion: lines.state().version })
  return { events, lines, agent, fixed, actions, sent, admit, finish, operation, state }
}
test('keeps sealed nodes immutable across branches, rerolls and remembered descendants', async () => {
  const f = fixture(); await f.lines.initialize(); const root = f.lines.state().selected
  await f.admit('A'); const a = await f.finish(2)
  await f.admit('B'); const b = await f.finish(3, 'error')
  expect(f.state()).toEqual({ count: 5 }); const sealed = JSON.stringify([...f.lines.state().nodes.values()])
  await f.operation('select', a.id); expect(f.state()).toEqual({ count: 2 })
  await f.admit('C'); const c = await f.finish(7)
  expect(c.parent).toBe(a.id); expect(f.state()).toEqual({ count: 9 })
  await f.operation('reroll', b.id); expect(f.sent[0]!.source.kind).toBe('user')
  expect(f.lines.state().pending?.parent).toBe(a.id)
  const b2 = await f.finish(4); expect(b2.parent).toBe(a.id); expect(b2.rerollOf).toBe(b.id)
  expect(f.state()).toEqual({ count: 6 })
  await f.operation('select', a.id); expect(f.state()).toEqual({ count: 2 })
  expect(JSON.stringify([...f.lines.state().nodes.values()].slice(0,3))).toBe(sealed)
  expect(f.lines.state().nodes.size).toBe(5)
  await f.operation('select', root); expect(f.state()).toEqual({ count: 0 })
  await f.operation('candidate', c.id); expect(f.state()).toEqual({ count: 9 })
})
test('rejects stale selection and concurrent input and deduplicates selection operations', async () => {
  const f = fixture(); await f.lines.initialize(); const root = f.lines.state().selected
  const request = { kind: 'select' as const, nodeId: root, operationId: 'op', expectedVersion: 1 }
  await f.lines.operate(request); const length = f.events.length
  await f.lines.operate(request); expect(f.events).toHaveLength(length)
  await expect(f.admit('stale', 1)).rejects.toMatchObject({ code: 'worldline-conflict' })
  await f.admit('accepted')
  await expect(f.admit('parallel')).rejects.toMatchObject({ code: 'worldline-busy' })
  await expect(f.operation('select', root)).rejects.toMatchObject({ code: 'worldline-busy' })
})
test('recovers an interrupted execution from committed records without running a function again', async () => {
  const f = fixture(); await f.lines.initialize(); await f.admit('orphan')
  const run = f.lines.state().pending!
  f.agent.session.append('tool/call', { turn: 1, step: 1, callId: run.id, name: 'add', arguments: '{"amount":4}' })
  await f.actions.invoke('add', { amount: 4 }, run.id, new AbortController().signal)
  f.agent.session.append('tool/result', { error: { code: 'TOOL_OUTCOME_UNKNOWN' }, message: { id: run.id, role: 'tool', toolCallId: run.id, source: { kind: 'tool', callId: run.id }, isError: true, content: [] } })
  const reopened = fixture(f.events)
  await reopened.lines.settle()
  expect(reopened.lines.state().nodes.size).toBe(2)
  expect(reopened.lines.state().nodes.get(reopened.lines.state().selected)?.outcome).toBe('interrupted')
  expect(reopened.state()).toEqual({ count: 4 })
  const length = reopened.events.length; await reopened.lines.settle(); expect(reopened.events).toHaveLength(length)
})
test('blocks after unconfirmed persistence', async () => {
  const f = fixture([], async () => { throw new Error('disk') })
  await expect(f.lines.initialize()).rejects.toMatchObject({ code: 'worldline-save-failed' })
  await expect(f.admit('blocked')).rejects.toMatchObject({ code: 'worldline-save-failed' })
})

test('deduplicates an admitted input even when the process stopped before enqueue', async () => {
  const f = fixture(); await f.lines.initialize(); await f.admit('lost-response')
  const length = f.events.length
  expect(await f.admit('lost-response')).toBeNull()
  expect(f.events).toHaveLength(length)
  await f.lines.settle()
  expect(f.lines.state().nodes.get(f.lines.state().selected)?.outcome).toBe('interrupted')
  expect(await f.admit('lost-response')).toBeNull()
  const restoredInput = activeRecords(f.events, f.fixed).filter(event => event.type === 'context/message')
  expect(restoredInput).toHaveLength(1)
  expect((restoredInput[0]!.data as { message: InputMessage }).message.source.kind).toBe('user')
  expect((restoredInput[0]!.data as { message: InputMessage }).message.content).toEqual([{ type: 'text', text: 'lost-response' }])
})
test('does not seal a committed action with a missing receipt', async () => {
  const f = fixture(); await f.lines.initialize(); await f.admit('call')
  f.agent.session.append('tool/call', { callId: 'call', name: 'add', arguments: '{"amount":2}' })
  await f.actions.invoke('add', { amount: 2 }, 'call', new AbortController().signal)
  await expect(f.lines.settle()).rejects.toMatchObject({ code: 'missing-receipt' })
  expect(f.lines.state().nodes.size).toBe(1)
  await expect(f.admit('later')).rejects.toMatchObject({ code: 'missing-receipt' })
})

test('retains stable ordinals over long paths and noncontiguous branches', async () => {
  const f = fixture(); await f.lines.initialize(); const root = f.lines.state().selected
  for (let i = 0; i < 110; i++) { await f.admit('input-' + i); f.agent.session.append('turn/end', { reason: { kind: 'completed' } }); await f.lines.settle() }
  const before = [...f.lines.state().nodes.values()]
  await f.operation('select', before[20]!.id)
  await f.admit('branch'); f.agent.session.append('turn/end', { reason: { kind: 'completed' } }); await f.lines.settle()
  expect([...f.lines.state().nodes.values()].slice(0,111)).toEqual(before)
  expect(f.lines.state().nodes.get(f.lines.state().selected)?.ordinal).toBe(111)
  await f.operation('select', root)
  expect(f.lines.state().nodes.size).toBe(112)
})

test.each([true, false])('duplicate selection awaits the same durability confirmation: %s', async success => {
  let confirmation: Promise<boolean> | undefined
  const f = fixture([], () => confirmation ?? Promise.resolve(true)); await f.lines.initialize()
  const gate = Promise.withResolvers<boolean>(); confirmation = gate.promise
  const request = { kind: 'select' as const, nodeId: f.lines.state().selected, operationId: 'persisting', expectedVersion: f.lines.state().version }
  const first = f.lines.operate(request), duplicate = f.lines.operate(request)
  const settled = Promise.allSettled([first, duplicate])
  let resolved = false; void settled.then(() => { resolved = true })
  await Promise.resolve(); await Promise.resolve()
  expect(resolved).toBe(false)
  expect(f.events.filter(event => event.type === 'history/selected')).toHaveLength(2)
  gate.resolve(success)
  const results = await settled
  expect(results.map(result => result.status)).toEqual(success ? ['fulfilled', 'fulfilled'] : ['rejected', 'rejected'])
  if (!success) for (const result of results) expect((result as PromiseRejectedResult).reason).toMatchObject({ code: 'worldline-save-failed' })
})

test('editing an input branches from its original parent and preserves the old node', async () => {
  const f = fixture(); await f.lines.initialize(); const root = f.lines.state().selected
  await f.admit('original'); const original = await f.finish(2)
  await f.admit('later'); await f.finish(5)
  const unchanged = structuredClone(original)
  const request = { kind: 'edit' as const, nodeId: original.id, operationId: 'edit-input', expectedVersion: f.lines.state().version, text: 'edited input' }
  await f.lines.operate(request)
  expect(f.state()).toEqual({ count: 0 })
  expect(f.lines.state().pending?.parent).toBe(root)
  expect(f.sent[0]?.content).toEqual([{ type: 'text', text: 'edited input' }])
  expect(f.sent[0]?.source).toMatchObject({ kind: 'user', rpcId: 'edit-input' })
  await f.lines.operate(request); expect(f.sent).toHaveLength(1)
  const edited = await f.finish(4)
  expect(edited).toMatchObject({ parent: root, editedFrom: original.id })
  expect(f.lines.state().nodes.get(original.id)).toEqual(unchanged)
  expect(f.lines.state().nodes.size).toBe(4)
  await f.operation('select', original.id); expect(f.state()).toEqual({ count: 2 })
  await expect(f.lines.operate({ ...request, operationId: 'stale-edit', expectedVersion: 1 })).rejects.toMatchObject({ code: 'worldline-conflict' })
  const length = f.events.length
  await expect(f.lines.operate({ ...request, operationId: 'empty-edit', expectedVersion: f.lines.state().version, text: '  ' })).rejects.toThrow('empty prompt')
  expect(f.events).toHaveLength(length)
})
test('editing replaces text and retains message attachments', async () => {
  const f = fixture(); await f.lines.initialize()
  const file = { type: 'file', attachment: { name: 'fixture.txt', id: 'attachment' } }
  await f.lines.admit({ id: 'attachment-input', role: 'user', content: [{ type: 'text', text: 'old' }, file], source: { kind: 'user', admission: { historyVersion: f.lines.state().version } } })
  const node = await f.finish(1)
  await f.lines.operate({ kind: 'edit', nodeId: node.id, operationId: 'attachment-edit', expectedVersion: f.lines.state().version, text: 'new' })
  expect(f.sent[0]?.content).toEqual([{ type: 'text', text: 'new' }, file])
})


test('derives floors independently of DSH turns and excludes sibling history', async () => {
  const f=fixture();await f.lines.initialize()
  const finish=async(id:string,turn:number)=>{
    await f.admit(id);f.agent.session.append('turn/start',{turn});f.agent.session.append('user/message',f.lines.state().pending!.input)
    f.agent.session.append('turn/end',{turn,reason:{kind:'completed'}});await f.lines.settle();return f.lines.state().nodes.get(f.lines.state().selected)!
  }
  const a=await finish('a',1),b=await finish('b',2)
  await f.operation('select',a.id);const c=await finish('c',3)
  const nodes=f.lines.state().nodes
  expect(executionPosition(f.events,nodes,b)).toEqual({floor:2,turn:2})
  expect(executionPosition(f.events,nodes,c)).toEqual({floor:2,turn:3})
  const selected=f.lines.state().selected
  const inspection=inspectExecution(f.events,f.fixed,b.id,'original',()=>{throw new Error('must not resolve a request')})
  expect(inspection.path.map(n=>n.turn)).toEqual([null,1,2])
  expect(inspection.events.filter(e=>e.type==='user/message').map(e=>(e.data as InputMessage).id)).toEqual(['a','b'])
  expect(f.lines.state().selected).toBe(selected)
  await f.operation('select',a.id);await f.admit('interrupted');await f.lines.settle()
  expect(executionPosition(f.events,f.lines.state().nodes,f.lines.state().nodes.get(f.lines.state().selected)!)).toEqual({floor:2,turn:null})
  await expect(async()=>inspectExecution(f.events,f.fixed,b.id,'rewritten',()=>[])).rejects.toThrow('unavailable')
})

test('inspection pages keep their original read identity across later executions',async()=>{
  const f=fixture();await f.lines.initialize();await f.admit('one')
  f.agent.session.append('turn/start',{turn:1});f.agent.session.append('user/message',f.lines.state().pending!.input)
  f.agent.session.append('turn/end',{turn:1,reason:{kind:'completed'}});await f.lines.settle()
  const id=f.lines.state().selected,first=inspectExecution(f.events,f.fixed,id,'original',()=>[],undefined,1)
  expect(first.next).toBeDefined()
  await f.admit('two');f.agent.session.append('turn/start',{turn:2});f.agent.session.append('turn/end',{turn:2,reason:{kind:'error'}});await f.lines.settle()
  const next=inspectExecution(f.events,f.fixed,id,'original',()=>[],first.next,1)
  expect(next.identity).toBe(first.identity);expect(next.through).toBe(first.through)
  expect(next.events.at(-1)!.seq!).toBeLessThan(first.events[0]!.seq!)
  expect(()=>inspectExecution(f.events,f.fixed,id,'original',()=>[],{...first.next!,identity:'wrong'})).toThrow('cursor')
  expect(()=>inspectExecution(f.events,f.fixed,f.lines.state().selected,'original',()=>[],first.next)).toThrow('cursor')
})

test('rejects multiple real DSH turns inside one sealed execution',async()=>{
  const f=fixture();await f.lines.initialize();await f.admit('one')
  f.agent.session.append('turn/start',{turn:1});f.agent.session.append('turn/end',{turn:1,reason:{kind:'completed'}})
  f.agent.session.append('turn/start',{turn:2});f.agent.session.append('turn/end',{turn:2,reason:{kind:'completed'}});await f.lines.settle()
  expect(()=>inspectExecution(f.events,f.fixed,f.lines.state().selected,'original',()=>[])).toThrow('conflicting')
})

test('validation alone neither selects the parent nor accepts an execution', async () => {
  const f = fixture(); await f.lines.initialize(); await f.admit('first'); const first = await f.finish(2)
  const before = structuredClone(f.events), state = f.lines.state()
  const operation = { kind: 'reroll' as const, operationId: 'validated', expectedVersion: state.version, nodeId: first.id }
  const input: InputMessage = { id: 'fresh', role: 'user', content: first.input!.content, source: { kind: 'user', rpcId: operation.operationId, admission: { historyVersion: state.version, 'papermoon.worldline': operation } } }
  expect(await f.lines.admit(input, false)).toBe(input)
  expect(f.events).toEqual(before); expect(f.lines.state().selected).toBe(first.id)
  await f.lines.admit(input)
  expect(f.lines.state().pending?.parent).toBe(first.parent)
})
