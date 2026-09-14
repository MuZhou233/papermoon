/** Real DSH loop, scoped tools and durability acknowledgements with a local deterministic adapter. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StoryStorage } from '../../story-storage/lib/index.js'
import { StoryRepository } from '../../story-core/lib/repository.js'
import { CompilationService, ArtifactStore } from '../../story-compiler/lib/service.js'
import { Performances, PRESET } from '../lib/index.js'
const base = new URL('../../../dsh/', import.meta.url)
const moduleAt = path => import(new URL(path + '/lib/index.js', base).href)
const { Context } = await moduleAt('vendor/cordis')
const llm = await moduleAt('packages/llm/llm')
const { default: Sessions, SessionId, interruptedTurnClosers } = await moduleAt('packages/core/session')
const { default: SystemPrompt } = await moduleAt('packages/core/system-prompt')
const { default: Tools } = await moduleAt('packages/core/tools')
const { default: Agents } = await moduleAt('packages/core/agent')
const { default: Loop } = await moduleAt('packages/core/agent-loop')
const { default: Projections } = await moduleAt('packages/session/session-projection')
const directory = mkdtempSync(join(tmpdir(), 'papermoon-functions-runtime-')), root = new Context()
const storage = new StoryStorage({ path: join(directory, 'story.sqlite') }), core = new StoryRepository(storage)
const compiler = new CompilationService(core, new ArtifactStore(join(directory, 'compiled')))
let service
try {
  for (const plugin of [llm.default, Sessions, Projections]) await root.plugin(plugin)
  await root.plugin(SystemPrompt, { personaPrefix: 'Default prompt', personaSuffix: 'CWD {{cwd}}' })
  await root.plugin(Tools); await root.plugin(Agents); await root.plugin(Loop, { agents: [] })
  const requests = []
  class Adapter extends llm.LlmAdapter {
    async resolveModel(provider, model) { return { provider, id: model, name: model } }
    async *stream(options) {
      requests.push(options)
      const results = options.messages.flatMap(m => m.content).filter(b => b.type === 'tool-result').length
      if (results < 2) {
        const block = { type: 'tool-call', id: llm.ToolCallId('increment-' + results), name: 'increment', arguments: JSON.stringify({ amount: results + 1 }) }
        yield { type: 'block-start', index: 0, blockType: 'tool-call' }; yield { type: 'block-end', index: 0, block }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      } else {
        yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Done' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
  }
  root.llm.registerAdapter(['deterministic'], new Adapter())
  let flushes = 0
  root.on('session/flush', session => { writeFileSync(join(directory, session.id + '.json'), JSON.stringify(session.snapshotEvents())); flushes++ })
  const project = core.createProject({ name: 'Functions' }), script = core.createScript({ projectId: project.id, name: 'Counter', defaultLanguage: 'en' })
  const source = `let moduleCount=0;
function create({state}) { let local=0;
/** Increase the count.
 * @param {number} amount Increment.
 * @returns {number|{count:number}} Updated count.
 */
return function increment(amount) { moduleCount++; local++; state.count += amount; state.secretCounter += moduleCount + local; return state.count; }
}
module.exports={systemPrompt:'Exact {{literal}} prompt',messages:[],state:{initial:{count:0,secretCounter:0},schema:{type:'object',properties:{count:{type:'number'},secretCounter:{type:'number'}},required:['count','secretCounter'],additionalProperties:false}},functions:[create]};`
  core.editDraft({ scriptId: script.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'story.js', source }] })
  const revision = await compiler.submit({ scriptId: script.id, expectedSequence: 1, description: 'Functions' })
  assert.equal(revision.committed, true); await compiler.close()
  const host = { agents: root.agents, sessions: root.sessions, sessionController: {
    list: async () => ({ items: root.agents.list().map(agent => ({ sessionId: agent.id })) }),
    resolveAgent: async id => ({ agent: root.agents.get(SessionId(id)) }),
    create: async ({sessionId}) => {
      const agent = await root.agentLoop.create(SessionId(sessionId), { provider: 'deterministic', model: 'test' }, { cwd: directory })
      agent.session.append('agent-preset/selected', { agentPreset: PRESET }); service.prepare(agent, script.id); return { sessionId }
    },
  } }
  service = new Performances(host, core, { workspace: async () => ({ id: 'script-workspace' }) })
  await service.start({ sessionId: 'one', scriptId: script.id, revisionId: revision.revision.id, key: 'opening/0' })
  await service.start({ sessionId: 'two', scriptId: script.id, revisionId: revision.revision.id, key: 'opening/0' })
  const first = root.agents.get(SessionId('one')), second = root.agents.get(SessionId('two'))
  const send = agent => agent.followup(service.admit(agent, llm.createUserMessage({ content: [{ type: 'text', text: 'Continue' }], source: { kind: 'user' } })))
  send(first); await first.whenIdle()
  const errors = first.session.snapshotEvents().filter(e => e.type === 'turn/end' && e.data.reason.kind === 'error')
  assert.deepEqual(errors, [])
  assert.equal(requests.length, 3)
  assert.deepEqual(requests[0].tools.map(t => t.name), ['increment'])
  assert.equal(requests[0].messages[0].content[0].text, 'Exact {{literal}} prompt')
  const results = requests[2].messages.flatMap(m => m.content).filter(b => b.type === 'tool-result')
  assert.deepEqual(results.map(r => r.content), [[{type:'text',text:'1'}], [{type:'text',text:'3'}]])
  assert.ok(!JSON.stringify(requests.map(r => r.messages)).includes('secretCounter'))
  assert.deepEqual((await service.view('one')).runtime.state, { count: 3, secretCounter: 4 })
  assert.deepEqual((await service.view('two')).runtime.state, { count: 0, secretCounter: 0 })
  assert.equal(root.tools.schemas().length, 0)
  assert.equal(root.tools.schemas(first).length, 1); assert.equal(root.tools.schemas(second).length, 1)
  assert.ok(flushes >= 2)
  assert.equal(JSON.parse(readFileSync(join(directory, 'one.json'), 'utf8')).filter(e => e.type === 'session/configuration' && e.data.key === 'papermoon.performance.action').length, 2)
  const seed = first.session.snapshotEvents()
  const handle = await root.agentLoop.createAgent(root, { sessionId: SessionId('fork'), seed, meta: { cwd: directory, parentSession: first.id, isSeeded: true }, inheritedEventCount: seed.length, agentOptions: { provider: 'deterministic', model: 'test' } })
  service.attach(handle.agent)
  assert.deepEqual((await service.view('fork')).runtime.state, { count: 3, secretCounter: 4 })
  const committedIndex = seed.findIndex(e => e.type === 'session/configuration' && e.data.key === 'papermoon.performance.action')
  const interrupted = seed.slice(0, committedIndex + 1)
  const repaired = [...interrupted, ...interruptedTurnClosers(interrupted)]
  const recovered = await root.agentLoop.createAgent(root, { sessionId: SessionId('recovered'), seed: repaired, meta: { cwd: directory, parentSession: first.id, isSeeded: true }, inheritedEventCount: repaired.length, agentOptions: { provider: 'deterministic', model: 'test' } })
  service.attach(recovered.agent)
  const requestOffset = requests.length
  send(recovered.agent); await recovered.agent.whenIdle()
  assert.ok(requests[requestOffset], JSON.stringify(recovered.agent.session.snapshotEvents().filter(e => e.type === 'turn/end' || e.type === 'tool/result')))
  const recoveredMessages = requests[requestOffset].messages.flatMap(m => m.content).filter(b => b.type === 'tool-result')
  assert.deepEqual(recoveredMessages.map(r => r.content), [[{type:'text',text:'1'}]])
  assert.equal(recoveredMessages[0].isError, false)
  assert.deepEqual((await service.view('recovered')).runtime.state, { count: 3, secretCounter: 4 })
  assert.equal((await service.view('recovered')).runtime.actions.length, 2)
  const repairedEvents = recovered.agent.session.snapshotEvents()
  assert.ok(repairedEvents.some(e => e.type === 'tool/result' && e.data.error?.code === 'TOOL_OUTCOME_UNKNOWN'))
  assert.ok(repairedEvents.some(e => e.type === 'tool/result' && typeof e.surfaceOp === 'object' && e.surfaceOp.op === 'replace'))
  core.deleteProject(project.id)
  send(second); await second.whenIdle()
  assert.deepEqual((await service.view('two')).runtime.state, { count: 3, secretCounter: 4 })
  await service.close()
  for (const agent of [first, second, handle.agent, recovered.agent]) assert.equal(root.tools.schemas(agent).length, 0)
  console.log('Performance functions: native raw results, durable commits, isolated scopes, Fork, source deletion and cleanup passed')
} finally {
  await service?.close(); await root.fiber.dispose(); await compiler.close()
  storage.close(); rmSync(directory, { recursive: true, force: true })
}
