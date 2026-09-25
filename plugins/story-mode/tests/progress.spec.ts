import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { Progress } from '../src/state.ts'
import { StoryMode, type StoryHost } from '../src/service.ts'
import { TextConversations, type TextHost, type TextAgent, type AgentHandle } from '../../text-conversations/src/service.ts'
import type { EventRecord, ModelChoice } from '../../text-conversations/src/types.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })
async function fixture(defaultChoice?: ModelChoice) {
  const directory = await mkdtemp(join(tmpdir(), 'story-progress-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'progress.json')
  let ready = true
  let unreadable = false
  const admissions = new Map<string, NonNullable<Parameters<NonNullable<TextHost['sessionController']>['expose']>[1]['beforePrompt']>>()
  const records = new Map<string, EventRecord[]>()
  const agents = new Map<string, AgentHandle>()
  const choices: (Partial<ModelChoice> | undefined)[] = []
  const textHost: TextHost = {
    agentDefaultModel: defaultChoice ? { currentSelection: () => defaultChoice } : undefined,
    llm: {
      listProviders: () => [{ id: 'local' }], listConfigurableProviders: () => [{ provider: 'local', settingsNs: 'local', settingsPath: [] }],
      listModels: async () => { if (unreadable) throw new Error('Provider unavailable'); return [{ provider: 'local', id: 'model', name: 'Model' }] },
      resolveModelInfo: async () => ({ provider: 'local', id: 'model', name: 'Model', reasoning: { efforts: [{ id: 'off', name: 'Off' }] } }),
    },
    settings: { describe: () => [{ ns: 'local', value: { apiKeyEnv: 'TEST' } }] }, credentials: { describe: async () => ({ configured: ready }) },
    sessions: { flush: async () => true }, sessionController: { expose: (agent, options) => { if (options.beforePrompt) admissions.set(agent.id, options.beforePrompt); return () => {} } },
  }
  const create = (id: string, seed: readonly EventRecord[] = []) => {
    const events = [...seed]; records.set(id, events)
    const agent: TextAgent = {
      id, status: 'idle', session: {
        snapshotEvents: () => events, deriveRequestMessages: () => [],
        append: (type, data) => { const seq = events.length; events.push({ type, data: data as Record<string, unknown>, seq, time: seq }); return { seq } },
      }, followup: () => { throw new Error('tests append completed provider results explicitly') }, cancel: () => {}, whenIdle: async () => {},
    }
    const handle = { agent, dispose: async () => {} }; agents.set(id, handle); return handle
  }
  const host: StoryHost = {
    textConversations: new TextConversations(textHost), sessionPersistence: { stat: async id => records.has(id) ? {} : undefined },
    agents: { create: async input => { choices.push(input.agentOptions); return create(input.sessionId, input.seed) }, resume: async input => agents.get(input.resumeSessionId)! },
  }
  const story = new StoryMode(host, new Progress(path))
  cleanups.push(() => story.dispose())
  return { story, path, host, admissions, agents, records, choices, setReady: (value: boolean) => { ready = value }, setUnreadable: (value: boolean) => { unreadable = value } }
}
async function practice(story: StoryMode) {
  const { attempt } = await story.state()
  await story.act(attempt.id, 'continue')
  await story.act(attempt.id, 'continue')
  await expect(story.act(attempt.id, 'continue')).rejects.toMatchObject({ key: 'notReady' })
  await story.act(attempt.id, 'example-seen')
  return (await story.act(attempt.id, 'continue')).attempt
}
it.each([undefined, { provider: 'missing', model: 'invalid' }, { provider: 'local', model: 'model', reasoningEffort: 'invalid' }])('any configured model permits the introduction without choosing a model (%j)', async choice => {
  const f = await fixture(choice)
  const attempt = await practice(f.story)
  expect(attempt.step).toBe(4)
  expect(f.choices).toEqual([{}, {}])
  expect(f.records.get(attempt.sessionId!)?.some(event => event.type === 'model/selection')).toBe(false)
  const saved = await new Progress(f.path).load()
  expect(saved).toEqual(attempt)
  expect(saved).not.toHaveProperty('configurationSeen')
  expect(saved).not.toHaveProperty('choice')
})
it('configuration must be readable and ready at Continue, including after restart', async () => {
  const f = await fixture()
  let { attempt } = await f.story.state()
  f.setReady(false)
  await expect(f.story.act(attempt.id, 'continue')).rejects.toMatchObject({ key: 'configurationMissing' })
  f.setReady(true); f.setUnreadable(true)
  await expect(f.story.act(attempt.id, 'continue')).rejects.toThrow('Provider unavailable')
  f.setUnreadable(false)
  await f.story.act(attempt.id, 'continue')
  const former = attempt.id
  attempt = (await f.story.act(former, 'restart')).attempt
  await expect(f.story.act(former, 'continue')).rejects.toMatchObject({ key: 'staleAttempt' })
  expect((await f.story.act(attempt.id, 'continue')).attempt.step).toBe(2)
  await f.story.dispose()
  await expect(f.story.run(() => f.story.state())).rejects.toMatchObject({ key: 'disabled' })
})
it('pins the first successful turn and accepts later input through completion and recovery', async () => {
  const choice = { provider: 'local', model: 'model' }
  const f = await fixture(choice)
  const attempt = await practice(f.story)
  const agent = f.agents.get(attempt.sessionId!)!.agent
  agent.session.append('turn/end', { turn: 1, reason: { kind: 'failed' } })
  expect((await f.story.state()).attempt.step).toBe(4)
  agent.session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
  agent.session.append('turn/end', { turn: 3, reason: { kind: 'completed' } })
  expect((await f.story.state()).attempt).toMatchObject({ step: 5, successfulTurn: 2 })
  const input = { content: [{ type: 'text' }] }
  await f.admissions.get(attempt.sessionId!)!(input)
  await f.story.act(attempt.id, 'trajectory-seen')
  agent.status = 'running'
  await f.story.act(attempt.id, 'continue')
  expect(agent.status).toBe('running')
  agent.status = 'idle'
  agent.session.append('turn/end', { turn: 4, reason: { kind: 'failed' } })
  await f.admissions.get(attempt.sessionId!)!(input)
  expect((await f.story.state()).attempt).toMatchObject({ step: 6, successfulTurn: 2, trajectorySeen: true })
  const restored = new StoryMode(f.host, new Progress(f.path))
  expect((await restored.state(true)).attempt).toMatchObject({ step: 6, successfulTurn: 2, trajectorySeen: true })
  await restored.dispose()
})
it('refuses malformed progress without modifying its file', async () => {
  const f = await fixture()
  const invalid = '{"invalid":true}\n'
  await writeFile(f.path, invalid)
  await expect(new Progress(f.path).load()).rejects.toThrow()
  expect(await readFile(f.path, 'utf8')).toBe(invalid)
})
