import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from '@papermoon/story-core/repository'
import { createWriterTemplate } from '@papermoon/writers'
import { WriterRepository } from '../../writers/src/repository.ts'
import { WriterSessions } from '../src/service.ts'
import { CONFIG_KEY, PRESET, initialContext, writerState, type LogRecord } from '../src/model.ts'
import type { Agent, Host, InputMessage } from '../src/host.ts'
import type { NativeTool } from '../../story-tools/src/plugin.ts'
const cleanup: (() => void)[] = []
afterEach(() => { for (const dispose of cleanup.splice(0).reverse()) dispose() })
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'papermoon-writer-'))
  const storage = new StoryStorage({ path: join(dir, 'story.sqlite') }), core = new StoryRepository(storage)
  const writers = new WriterRepository({ path: join(dir, 'writers.sqlite') })
  cleanup.push(() => { writers.close(); storage.close(); rmSync(dir, { recursive: true, force: true }) })
  const project = core.createProject({ name: 'P' }), script = core.createScript({ projectId: project.id, name: 'S', defaultLanguage: 'en' })
  const writer = writers.create({ ...createWriterTemplate('W'), systemPrompt: '  literal {{test}}\n', messages: [
    { id: 'a', name: 'Ask', role: 'user', content: '' }, { id: 'b', role: 'user', content: 'repeat' },
    { id: 'c', role: 'assistant', content: 'reply' }, { id: 'd', role: 'assistant', content: '{{literal}}' },
  ] })
  const agents = new Map<string, Agent>()
  const host = { agents: { get: (id: string) => agents.get(id) }, sessionController: { resolveAgent: async (id: string) => ({ agent: agents.get(id)! }) } } as unknown as Host
  const service = new WriterSessions(host, { core, writers }, dir)
  cleanup.push(() => service.dispose())
  function agent(id: string, seed: readonly LogRecord[] = []) {
    const events = structuredClone([...seed]), definitions = new Map<string, NativeTool>()
    const sections = new Map<string, string>(), variables = new Map<string, () => string>(), effects: (() => void)[] = []
    let busy = false
    const ctx: Agent['ctx'] = {
      effect(body) { const dispose = body(); effects.push(dispose) },
      on() { return () => {} },
      tools: { register(tool) { definitions.set(tool.name, tool); return () => { definitions.delete(tool.name) } }, presentAs: () => () => {} },
      systemPrompt: {
        context() { return () => {} },
        section(section) { sections.set(section.name, section.text); return () => { sections.delete(section.name) } },
        variable(name, value) { variables.set(name, value); return () => { variables.delete(name) } },
      },
    }
    const result: Agent = { followup() {}, async whenIdle() {}, id, status: 'idle', ctx, inbox: { nextTurn: [], nextStep: [], clear() {} },
      session: { header: { agentPreset: PRESET }, snapshotEvents: () => events, deriveRequestMessages: () => [], append(type, data) { events.push({ type, data: structuredClone(data) }) } },
      async runMaintenance(task) { if (busy) throw new Error('busy'); busy = true; try { return await task(new AbortController().signal) } finally { busy = false } },
    }
    agents.set(id, result); service.attach(result)
    return { agent: result, events, definitions, sections, variables, dispose() { for (const effect of effects.reverse()) effect() } }
  }
  const message: InputMessage = { id: 'first', role: 'user', content: [{ type: 'text', text: 'write' }], source: { kind: 'user', rpcId: 'request' } }
  async function select(target: Agent) { service.prepare(target, script.id); await service.configure({ sessionId: target.id, writerId: writer.id, writerSequence: writer.sequence }) }
  function accept(target: Agent) { const accepted = service.admit(target, message); target.session.append('agent/inbox/spliced', { target: 'next-turn', start: 0, inserted: [accepted] }); return accepted }
  return { core, script, writer, writers, service, agent, select, accept, message, host }
}
test('only persistent acceptance fixes an exact writer snapshot, including canceled pending input', async () => {
  const h = setup(), a = h.agent('a'); await h.select(a.agent)
  h.service.admit(a.agent, h.message)
  expect(writerState(a.agent.session).fixed).toBeUndefined()
  const accepted = h.accept(a.agent)
  a.agent.session.append('agent/inbox/spliced', { start: 0, removedCount: 1, inserted: [], outcome: 'canceled' })
  expect(writerState(a.agent.session).fixed?.writer).toEqual(h.writer)
  expect(accepted.source.admission?.[CONFIG_KEY]).toMatchObject({ originSessionId: 'a' })
  h.writers.update(h.writer.id, 0, { ...createWriterTemplate('Changed'), systemPrompt: 'later' })
  h.writers.delete(h.writer.id, 1)
  expect(a.variables.get('papermoon_writer_prompt')!()).toBe('  literal {{test}}\n')
  await expect(h.service.configure({ sessionId: 'a', writerId: h.writer.id, writerSequence: 1 })).rejects.toThrow(/fixed/)
  expect(h.service.admit(a.agent, h.message).source.admission).toBeUndefined()
})
test('missing selections and changed writer versions refuse admission without freezing', async () => {
  const h = setup(), a = h.agent('a')
  expect(() => h.service.admit(a.agent, h.message)).toThrow(/script workspace/)
  h.service.prepare(a.agent, h.script.id)
  expect(() => h.service.admit(a.agent, h.message)).toThrow(/select a writer/)
  await h.select(a.agent)
  h.writers.update(h.writer.id, 0, createWriterTemplate('Changed'))
  expect(() => h.service.admit(a.agent, h.message)).toThrow(/configuration changed/)
  expect(writerState(a.agent.session).fixed).toBeUndefined()
})
test('initial messages keep literal text, duplicate roles, names and stable fork identities', async () => {
  const h = setup(), a = h.agent('a'); await h.select(a.agent); h.accept(a.agent)
  const before = writerState(a.agent.session).fixed!, fork = h.agent('fork', a.events), after = writerState(fork.agent.session).fixed!
  expect(initialContext(after.originSessionId, after.writer)).toEqual(initialContext(before.originSessionId, before.writer))
  const messages = initialContext('a', h.writer)
  expect(messages.map(item => item.message.role)).toEqual(['user', 'user', 'assistant', 'assistant'])
  expect(messages.map(item => item.message.content[0]!.text)).toEqual(['', 'repeat', 'reply', '{{literal}}'])
  expect(messages[0]?.name).toBe('Ask')
})
test('scopes share a script without sharing observations and remounts require a new read', async () => {
  const h = setup(), a = h.agent('a'), b = h.agent('b'); await h.select(a.agent); await h.select(b.agent)
  h.core.editDraft({ scriptId: h.script.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'main.js', source: 'first' }] })
  const call = (target: typeof a, name: string, args: unknown) => target.definitions.get(name)!.execute(args, { callId: 'test-call', signal: new AbortController().signal })
  await call(a, 'story_program_read', { path: 'main.js' })
  await expect(call(b, 'story_program_edit', { operations: [{ kind: 'replace-file', path: 'main.js', source: 'second' }] })).rejects.toThrow(/not-observed/)
  await call(a, 'story_program_edit', { operations: [{ kind: 'replace-file', path: 'main.js', source: 'second' }] })
  a.dispose(); expect(a.definitions.size).toBe(0); expect(b.definitions.size).toBe(13)
  const resumed = h.agent('a', a.events)
  await expect(call(resumed, 'story_program_edit', { operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/not-observed/)
})
test('deleted targets retain history and refuse messages and tool execution', async () => {
  const h = setup(), a = h.agent('a'); await h.select(a.agent); h.accept(a.agent)
  h.core.deleteScript(h.script.id)
  expect(h.service.view(a.agent).targetMissing).toBe(true)
  expect(() => h.service.admit(a.agent, h.message)).toThrow(/no longer exists/)
  await expect(a.definitions.get('story_status')!.execute({}, { callId: 'test-call', signal: new AbortController().signal })).rejects.toThrow(/no longer exists/)
  expect(writerState(a.agent.session).fixed?.writer.name).toBe('W')
  a.dispose()
  const restored = h.agent('a', a.events)
  expect(h.service.view(restored.agent).targetMissing).toBe(true)
  await expect(restored.definitions.get('story_status')!.execute({}, { callId: 'test-call', signal: new AbortController().signal })).rejects.toThrow(/no longer exists/)
})


test('workspace labels use the script name while folder and deleted targets retain their labels', async () => {
  const h = setup()
  const workspace = (id: string, title: string, key?: string) => ({
    id, title, path: '/fixture', sessionIds: [],
    ...(key ? { target: { provider: 'papermoon-script', key } } : {}),
    async setTitle(value: string) { this.title = value },
    async attachSession() {}, async detachSession() {},
  })
  const script = workspace('script', 'P / S', h.script.id), folder = workspace('folder', 'Folder'), deleted = workspace('deleted', 'Removed script', 'gone')
  h.host.workspaceRegistry = {
    list: () => [script, folder, deleted], createResource: async () => script,
    registerResourceProvider: () => () => {},
  }
  await h.service.refreshWorkspaceTitles()
  expect([script.title, folder.title, deleted.title]).toEqual(['S', 'Folder', 'Removed script'])
  script.title = 'Another label'
  expect((await h.service.workspace(h.script.id)).title).toBe('S')
})
