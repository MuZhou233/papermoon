import { afterEach, beforeAll, expect, test } from 'vitest'
import { applyOperations, createContent } from '@papermoon/story-core'
import { compile } from '@papermoon/story-compiler'
import { StoryRuntime } from '@papermoon/story-compiler/execution'
import { createArtifact, digest } from '@papermoon/story-compiler/runtime'
import type { Artifact } from '@papermoon/story-compiler/types'
import type { Agent, LogRecord } from '../../story-workspaces/src/host.ts'
import type { FrozenPerformance } from '../src/model.ts'
import { PerformanceActions, projectActions } from '../src/actions.ts'
import { ACTION_KEY } from '../src/constants.ts'
const source = `function create({state}) {
/** Add a number.
 * @param {number} amount Amount.
 * @returns {number} Updated value.
 */
return function add(amount) { state.value += amount; if(amount < 0) throw new Error('negative'); return state.value; }
}
module.exports={systemPrompt:'',messages:[],state:{initial:{value:0},schema:{type:'object',properties:{value:{type:'number'}},required:['value'],additionalProperties:false}},functions:[create]};`
let artifact: Artifact
beforeAll(async () => {
  const result = await compile(applyOperations(createContent({ defaultLanguage: 'en' }), [{ kind: 'create-file', path: 'story.js', source }]))
  if (!result.ok) throw new Error(JSON.stringify(result))
  artifact = result.artifact
})
const closes: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of closes.splice(0).reverse()) await close() })
function fixture(seed: readonly LogRecord[] = [], flush: () => Promise<boolean> = async () => true, selected = artifact) {
  const payload = { version: 2 as const, originSessionId: 'origin', scriptId: 'script', revisionId: 'revision', ordinal: 1, scriptName: 'Script', projectName: 'Project', description: 'Functions', attachmentKey: 'opening/0', artifact: selected }
  const fixed: FrozenPerformance = { ...payload, checksum: digest(payload) }
  const events = structuredClone([...seed]), surfaces: unknown[] = []
  const agent = { id: 'current', session: { snapshotEvents: () => events, append(type: string, data: unknown, surface?: { sourceEventSeqs?: number[] }) {
    const event = { seq: events.length, type, data: structuredClone(data), ...(surface?.sourceEventSeqs ? { sourceEventSeqs: surface.sourceEventSeqs } : {}) }; events.push(event); surfaces.push(surface); return event
  } } } as unknown as Agent
  const runtime = new StoryRuntime(); closes.push(() => runtime.close())
  const actor = new PerformanceActions(agent, fixed, runtime, flush); closes.push(() => actor.close())
  const call = (id: string, amount: number) => agent.session.append('tool/call', { turn: 1, step: 1, callId: id, name: 'add', arguments: JSON.stringify({ amount }) })
  const run = (id: string, amount: number, signal = new AbortController().signal) => actor.invoke('add', { amount }, id, signal)
  const state = () => projectActions(events, fixed)
  const receipt = (id: string, code: string) => agent.session.append('tool/result', { turn: 1, step: 1, message: { id: 'receipt-' + events.length, source: { kind: 'tool', callId: id }, content: [{ type: 'tool-result', isError: true }] }, error: { code } })
  return { fixed, agent, events, actor, call, run, state, receipt, surfaces }
}
test('commits raw values once per logged call and serializes overlapping calls', async () => {
  let persisted = 0
  const f = fixture([], async () => { persisted++; return true })
  expect(f.actor.tools()[0]).toMatchObject({ name: 'add', description: 'Add a number.' })
  f.call('a', 2); f.call('b', 3)
  expect(await Promise.all([f.run('a', 2), f.run('b', 3)])).toEqual([2, 5])
  expect(persisted).toBe(2); expect(f.state().state).toEqual({ value: 5 })
  expect(await f.run('a', 2)).toBe(2)
  expect(f.state().actions).toHaveLength(2)
  f.call('a', 2); expect(await f.run('a', 2)).toBe(7)
  expect(f.state().actions).toHaveLength(3)
  expect(f.events.every(e => e.type === 'tool/call' || e.type === 'session/configuration')).toBe(true)
})
test('does not commit throwing, invalid, cancelled or oversized operations', async () => {
  const f = fixture()
  f.call('throw', -1); await expect(f.run('throw', -1)).rejects.toThrow('negative')
  await expect(f.run('missing', 1)).rejects.toMatchObject({ code: 'invalid-call' })
  f.call('cancelled', 2); const abort = new AbortController(); abort.abort()
  await expect(f.run('cancelled', 2, abort.signal)).rejects.toThrow()
  expect(f.state().state).toEqual({ value: 0 }); expect(f.state().actions).toEqual([])
  const limited = createArtifact(artifact.sourceHash, { ...artifact.options, limits: { ...artifact.options.limits, outputBytes: 300 } }, artifact)
  const small = fixture([], async () => true, limited)
  small.call('size', 1); await expect(small.run('size', 1)).rejects.toMatchObject({ code: 'output-limit' })
  expect(small.state().actions).toEqual([])
})
test('blocks after unconfirmed persistence and restores the recorded result without executing again', async () => {
  const f = fixture([], async () => { throw new Error('disk unavailable') })
  f.call('a', 2); await expect(f.run('a', 2)).rejects.toMatchObject({ code: 'performance-save-failed' })
  expect(f.state().state).toEqual({ value: 2 })
  f.receipt('a', 'EXECUTION_ERROR')
  f.call('b', 1); await expect(f.run('b', 1)).rejects.toMatchObject({ code: 'performance-save-failed' })
  await expect(f.actor.recover()).rejects.toMatchObject({ code: 'performance-save-failed' })
  const restored = fixture(f.events)
  await restored.actor.recover()
  expect(restored.events.at(-1)).toMatchObject({ type: 'tool/result', data: { message: { content: [{ isError: false, content: [{ type: 'text', text: '2' }] }] } } })
  expect(await restored.run('a', 2)).toBe(2)
  expect(restored.state().actions).toHaveLength(1)
  expect(await restored.run('b', 1)).toBe(3)
})
test('restores an interrupted receipt once while keeping its historical position and call identity', async () => {
  const f = fixture()
  f.call('a', 2); await f.run('a', 2); f.receipt('a', 'TOOL_OUTCOME_UNKNOWN')
  await f.actor.recover()
  expect(f.events.at(-1)).toMatchObject({ type: 'tool/result', data: { message: { content: [{ type: 'tool-result', isError: false, content: [{ type: 'text', text: '2' }] }] } } })
  expect(f.surfaces.at(-1)).toEqual({ surfaceOp: { op: 'replace', startSeq: 2, endSeq: 2 }, sourceEventSeqs: [2, 1, 0] })
  const size = f.events.length; await f.actor.recover(); expect(f.events).toHaveLength(size)
  f.call('a', -1); f.receipt('a', 'ABORTED'); await f.actor.recover()
  expect((f.events.at(-1)!.data as { error: { code: string } }).error.code).toBe('ABORTED')
})
test('forks share recorded history and then advance independent state', async () => {
  const first = fixture(); first.call('a', 2); await first.run('a', 2)
  const second = fixture(first.events)
  first.call('b', 1); second.call('b', 4)
  expect(await Promise.all([first.run('b', 1), second.run('b', 4)])).toEqual([3, 6])
  expect(first.state().state).toEqual({ value: 3 }); expect(second.state().state).toEqual({ value: 6 })
  expect(artifact.state.initial).toEqual({ value: 0 })
})
test('rejects damaged action history and closes without further writes', async () => {
  const f = fixture(); f.call('a', 1); await f.run('a', 1)
  const event = f.events.find(e => e.type === 'session/configuration' && (e.data as { key: string }).key === ACTION_KEY)!
  ;(event.data as { value: { state: { value: number } } }).value.state.value = 9
  expect(f.state).toThrow(expect.objectContaining({ code: 'corrupt-action' }))
  const closed = fixture(); closed.call('a', 1); await closed.actor.close()
  await expect(closed.run('a', 1)).rejects.toMatchObject({ code: 'closed' })
  expect(closed.state().actions).toHaveLength(0)
})

test('does not repeat recovery when a later request reuses the call ID', async () => {
  const f = fixture()
  f.call('a', 2); await f.run('a', 2); f.receipt('a', 'TOOL_OUTCOME_UNKNOWN')
  f.call('a', -1); f.receipt('a', 'ABORTED')
  await f.actor.recover()
  const length = f.events.length
  await f.actor.recover()
  expect(f.events).toHaveLength(length)
  expect(f.state().state).toEqual({ value: 2 })
})
