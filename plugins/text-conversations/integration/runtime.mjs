/** Exercise public DSH services from the managed checkout, with durable local sessions. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TextConversations } from '../lib/index.js'
const base = new URL('../../../dsh/', import.meta.url)
const moduleAt = path => import(new URL(path + '/lib/index.js', base).href)
const { Context } = await moduleAt('vendor/cordis')
const llm = await moduleAt('packages/llm/llm')
const { default: Sessions } = await moduleAt('packages/core/session')
const { default: Persistence } = await moduleAt('packages/session/session-persistence-jsonl')
const { default: Projections } = await moduleAt('packages/session/session-projection')
const { default: Prompt } = await moduleAt('packages/core/system-prompt')
const { default: Tools } = await moduleAt('packages/core/tools')
const { default: Agents } = await moduleAt('packages/core/agent')
const { default: Loop } = await moduleAt('packages/core/agent-loop')
const directory = mkdtempSync(join(tmpdir(), 'papermoon-text-runtime-'))
const root = new Context()
const requests = []
try {
  await root.plugin(llm.default)
  await root.plugin(Sessions)
  await root.plugin(Persistence, { root: directory, compression: 'none' })
  await root.plugin(Projections)
  await root.plugin(Prompt, { personaPrefix: 'Inherited coding persona' })
  await root.plugin(Tools)
  await root.plugin(Agents)
  await root.plugin(Loop, { agents: [] })
  class Adapter extends llm.LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'model', name: 'Model' }, { provider, id: 'plain', name: 'Plain' }] }
    async resolveModel(provider, id) { return { provider, id, name: id, ...(id === 'plain' ? {} : { reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }] } }) } }
    async *stream(options) {
      requests.push(options)
      const text = options.messages.at(-1).content[0].text
      if (text === 'fail') throw new Error('test failure')
      if (text === 'wait') {
        await new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
      }
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Reply' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  root.llm.registerAdapter(['fixture'], new Adapter())
  root.provide('settings', { describe: () => [] })
  root.provide('credentials', { describe: async () => ({ configured: true }) })
  const service = new TextConversations(root)
  const choice = { provider: 'fixture', model: 'model', reasoningEffort: 'off' }
  let conversation = await service.open(root, { id: 'text-owned', resume: false, prompt: 'You are a helpful assistant', choice })
  await conversation.send('hi')
  await conversation.agent.whenIdle()
  assert.equal(conversation.view().successfulTurn, 1)
  assert.deepEqual(requests[0].messages.map(message => message.content.map(block => block.text).join('')), ['You are a helpful assistant', 'hi'])
  assert.deepEqual(requests[0].tools ?? [], [])
  assert.equal(requests[0].reasoningEffort, 'off')
  assert.equal(conversation.agent.session.header.cwd, undefined)
  const inspected = conversation.request(1, 1)
  assert.deepEqual(inspected.messages, requests[0].messages)
  await conversation.dispose()
  const plain = await service.validate({ provider: 'fixture', model: 'plain', reasoningEffort: 'off' })
  assert.equal(plain.reasoningEffort, undefined)
  conversation = await service.open(root, { id: 'text-owned', resume: true, prompt: 'You are a helpful assistant', choice: plain })
  assert.equal(requests.length, 1)
  assert.equal(conversation.view().successfulTurn, 1)
  await conversation.send('second reply'); await conversation.agent.whenIdle()
  assert.equal(conversation.view().successfulTurn, 1)
  await conversation.send('fail'); await conversation.agent.whenIdle()
  assert.equal(requests[2].reasoningEffort, undefined)
  assert.equal(conversation.view().successfulTurn, 1)
  await conversation.send('wait')
  while (requests.length < 4) await new Promise(resolve => setTimeout(resolve, 5))
  await conversation.dispose()
  assert.equal(root.agents.get('text-owned'), undefined)
  conversation = await service.open(root, { id: 'text-owned', resume: true, prompt: 'You are a helpful assistant', choice: plain })
  assert.equal(requests.length, 4)
  assert.notEqual(conversation.view().events.findLast(event => event.type === 'turn/end').data.reason.kind, 'completed')
  await conversation.dispose()
  console.log('Text conversations: exact prompt, effort, tool isolation, historical request, persistence and cancellation passed')
} finally { await root.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
