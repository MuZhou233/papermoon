import { afterEach, expect, test } from 'vitest'
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
      ctx: { effect(body) { effects.push(body()) }, on(_name, listener) { steps.set(id, listener); return () => { steps.delete(id) } },
        tools: { register() { throw new Error('performance cannot register a tool') }, presentAs: () => () => {} },
        systemPrompt: { context: () => () => {}, section: () => () => {}, variable(name, value) { variables.set(id + '/' + name, value); return () => { variables.delete(id + '/' + name) } } } },
      session: { header: { agentPreset: PRESET }, snapshotEvents: () => events, append(type,data) { events.push({ seq: events.length, time: Date.now(), type, data: structuredClone(data) }) } },
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
  expect(f.variables.get('play/papermoon_performance_prompt')!()).toBe('  {{literal}}')
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
    agent.session.append('user/message', input)
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
    agent.session.append('user/message', input)
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
