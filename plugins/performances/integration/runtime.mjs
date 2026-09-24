/** Real DSH loop, scoped tools and durability acknowledgements with a local deterministic adapter. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PlaybookStorage } from '../../playbook-storage/lib/index.js'
import { PlaybookRepository } from '../../playbook-core/lib/repository.js'
import { CompilationService, ArtifactStore } from '../../playbook-compiler/lib/service.js'
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
const storage = new PlaybookStorage({ path: join(directory, 'playbook.sqlite') }), core = new PlaybookRepository(storage)
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
  const project = core.createProject({ name: 'Functions' }), playbook = core.createPlaybook({ projectId: project.id, name: 'Counter', defaultLanguage: 'en' })
  const source = `let moduleCount=0;
function create({state}) { let local=0;
/** Increase the count.
 * @param {number} amount Increment.
 * @returns {number|{count:number}} Updated count.
 */
return function increment(amount) { moduleCount++; local++; state.count += amount; state.secretCounter += moduleCount + local; return state.count; }
}
module.exports={systemPrompt:'Exact {{literal}} prompt',messages:[],state:{initial:{count:0,secretCounter:0},schema:{type:'object',properties:{count:{type:'number'},secretCounter:{type:'number'}},required:['count','secretCounter'],additionalProperties:false}},functions:[create]};`
  core.editDraft({ playbookId: playbook.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'playbook.js', source }] })
  const revision = await compiler.submit({ playbookId: playbook.id, expectedSequence: 1, description: 'Functions' })
  assert.equal(revision.committed, true); await compiler.close()
  const host = { agents: root.agents, sessions: root.sessions, sessionController: {
    submitUserInput: async request => {
      const agent = root.agents.get(SessionId(request.sessionId))
      return agent.runMaintenance(async () => {
        const message = await service.admit(agent, llm.createUserMessage({ content: request.content, source: { kind: 'user', rpcId: request.requestId, admission: { ...request.admission, historyVersion: request.historyVersion } } }))
        if (message) agent.followup(message)
      })
    },
    list: async () => ({ items: root.agents.list().map(agent => ({ sessionId: agent.id })) }),
    resolveAgent: async id => ({ agent: root.agents.get(SessionId(id)) }),
    create: async ({sessionId}) => {
      const existing = root.agents.get(SessionId(sessionId)); if (existing) return {sessionId}
      const agent = await root.agentLoop.create(SessionId(sessionId), { provider: 'deterministic', model: 'test' }, { cwd: directory })
      agent.session.append('agent-preset/selected', { agentPreset: PRESET }); service.prepare(agent, playbook.id); return { sessionId }
    },
  } }
  service = new Performances(host, core, { workspace: async () => ({ id: 'playbook-workspace' }) })
  root.on('session/event', (session, event) => service.observe(session, event))
  await service.start({ sessionId: 'one', playbookId: playbook.id, revisionId: revision.revision.id, key: 'opening/0' })
  await service.start({ sessionId: 'two', playbookId: playbook.id, revisionId: revision.revision.id, key: 'opening/0' })
  const first = root.agents.get(SessionId('one')), second = root.agents.get(SessionId('two'))
  const send = async agent => {
    const view = await service.view(agent.id)
    const message = await service.admit(agent, llm.createUserMessage({ content: [{ type: 'text', text: 'Continue' }], source: { kind: 'user', admission: { historyVersion: view.worldline.version } } }))
    assert.ok(message); agent.followup(message)
  }
  await send(first); await first.whenIdle()
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
  const initialTree = (await service.view('one')).worldline
  assert.equal(initialTree.nodes.length, 2)
  const rootNode = initialTree.nodes[0], firstNode = initialTree.nodes[1]
  await service.operation('one', { operationId: 'reroll-one', expectedVersion: initialTree.version, kind: 'reroll', nodeId: firstNode.id })
  await first.whenIdle()
  const rerolled = (await service.view('one')).worldline
  assert.equal(rerolled.nodes.length, 3)
  assert.equal(rerolled.nodes[2].parent, rootNode.id)
  assert.equal(requests.length, 6, JSON.stringify(first.session.snapshotEvents().slice(-15), null, 2))
  assert.equal(requests[3].messages.flatMap(m => m.content).filter(b => b.type === 'tool-result').length, 0)
  assert.deepEqual(requests[3].messages.map(({role,content})=>({role,content})), requests[0].messages.map(({role,content})=>({role,content})))
  assert.equal(rerolled.nodes[2].input.source.kind, 'user')
  assert.notEqual(rerolled.nodes[2].input.id, firstNode.input.id)
  assert.deepEqual((await service.view('one')).runtime.state, { count: 3, secretCounter: 4 })
  await service.operation('one', { operationId: 'edit-one', expectedVersion: rerolled.version, kind: 'edit', nodeId: firstNode.id, text: 'Revised input' })
  await first.whenIdle()
  const edited = (await service.view('one')).worldline
  assert.equal(edited.nodes.length, 4)
  assert.equal(edited.nodes[3].parent, rootNode.id)
  assert.equal(edited.nodes[3].editedFrom, firstNode.id)
  assert.equal(requests.length, 9)
  assert.deepEqual(requests[6].messages.filter(message => message.role === 'user').map(message => message.content), [[{ type: 'text', text: 'Revised input' }]])
  assert.equal(requests[6].messages.flatMap(message => message.content).filter(block => block.type === 'tool-result').length, 0)
  assert.deepEqual((await service.view('one')).runtime.state, { count: 3, secretCounter: 4 })
  await service.operation('one', { operationId: 'select-root', expectedVersion: edited.version, kind: 'select', nodeId: rootNode.id })
  assert.deepEqual((await service.view('one')).runtime.state, { count: 0, secretCounter: 0 })
  assert.equal(requests.length, 9, JSON.stringify(first.session.snapshotEvents().slice(-15), null, 2))
  await service.operation('one', { operationId: 'select-first', expectedVersion: (await service.view('one')).worldline.version, kind: 'select', nodeId: firstNode.id })
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
  await service.view('recovered')
  assert.equal((await service.view('recovered')).worldline.nodes.at(-1).outcome, 'interrupted')
  await send(recovered.agent); await recovered.agent.whenIdle()
  assert.ok(requests[requestOffset], JSON.stringify(recovered.agent.session.snapshotEvents().filter(e => e.type === 'turn/end' || e.type === 'tool/result')))
  const recoveredMessages = requests[requestOffset].messages.flatMap(m => m.content).filter(b => b.type === 'tool-result')
  assert.deepEqual(recoveredMessages.map(r => r.content), [[{type:'text',text:'1'}]])
  assert.equal(recoveredMessages[0].isError, false)
  assert.deepEqual((await service.view('recovered')).runtime.state, { count: 3, secretCounter: 4 })
  assert.equal((await service.view('recovered')).runtime.actions.length, 2)
  const repairedEvents = recovered.agent.session.snapshotEvents()
  assert.ok(repairedEvents.some(e => e.type === 'tool/result' && e.data.error?.code === 'TOOL_OUTCOME_UNKNOWN'))
  assert.ok(repairedEvents.some(e => e.type === 'tool/result' && typeof e.surfaceOp === 'object' && e.surfaceOp.op === 'replace'))
  const { sessionFormatCatalog } = await moduleAt('packages/session/session-format-catalog')
  const persisted = first.session.snapshotEvents()
  const reader = sessionFormatCatalog.createRestore({ type: 'session', version: 3, id: 'roundtrip', createdAt: 1, isSeeded: false, delegationDepth: 0 }, { recovery: 'strict', validation: 'current' })
  for (const event of persisted) reader.decodeRow(sessionFormatCatalog.encodeCurrentEvent(event))
  assert.deepEqual(reader.finish().events, persisted)
  const begin = seed.findIndex(event => event.type === 'history/selected' && event.data.metadata.kind === 'begin')
  const notEntered = seed.slice(0, begin + 1)
  const early = await root.agentLoop.createAgent(root, { sessionId: SessionId('early'), seed: notEntered, meta: { cwd: directory, parentSession: first.id, isSeeded: true }, inheritedEventCount: notEntered.length, agentOptions: { provider: 'deterministic', model: 'test' } })
  service.attach(early.agent)
  const earlyView = await service.view('early')
  assert.equal(earlyView.worldline.nodes.at(-1).outcome, 'interrupted')
  const beforeEarly = requests.length
  await send(early.agent); await early.agent.whenIdle()
  assert.ok(requests[beforeEarly], JSON.stringify(early.agent.session.snapshotEvents().filter(event => event.type === 'turn/end')))
  assert.equal(requests[beforeEarly].messages.filter(message => message.role === 'user').length, 2)
  for (const agent of [recovered.agent, early.agent]) {
    const events = agent.session.snapshotEvents()
    const restored = sessionFormatCatalog.createRestore({ type: 'session', delegationDepth: 0, ...agent.session.header }, { recovery: 'strict', validation: 'current' })
    for (const event of events) restored.decodeRow(sessionFormatCatalog.encodeCurrentEvent(event))
    assert.deepEqual(restored.finish().events, events)
  }
  const contextual = core.createPlaybook({projectId:project.id,name:'Context window',defaultLanguage:'en'})
  const composedSource = source.replace('functions:[create]', `functions:[create],composeContext({opening,history,input,state}) {
    if (history.some(n=>n.blocks.some(b=>'content' in b))) throw new Error('history body leaked');
    return {systemPrompt:opening.systemPrompt,messages:[
      ...history.slice(-1).flatMap(n=>n.blocks.map(b=>({ref:b.id}))),
      {ref:input.id},{role:'assistant',name:'Tail',content:'state='+state.count+';nodes='+history.length}
    ]};
  }`)
  core.editDraft({playbookId:contextual.id,expectedSequence:0,operations:[{kind:'create-file',path:'playbook.js',source:composedSource}]})
  const contextualCompiler=new CompilationService(core,new ArtifactStore(join(directory,'context-compiled')))
  const contextualRevision=await contextualCompiler.submit({playbookId:contextual.id,expectedSequence:1,description:'Composition'})
  await contextualCompiler.close(); assert.equal(contextualRevision.committed,true)
  // Create directly because this harness's create callback intentionally owns the original playbook.
  const contextualAgent=await root.agentLoop.create(SessionId('contextual'),{provider:'deterministic',model:'test'},{cwd:directory})
  contextualAgent.session.append('agent-preset/selected',{agentPreset:PRESET}); service.prepare(contextualAgent,contextual.id)
  await service.start({sessionId:'contextual',playbookId:contextual.id,revisionId:contextualRevision.revision.id,key:'opening/0'})
  const contextStart=requests.length
  await send(contextualAgent);await contextualAgent.whenIdle()
  const contextFirst=requests.slice(contextStart)
  assert.equal(contextFirst.length,3)
  assert.equal(contextFirst[0].messages.at(-1).content[0].text,'state=0;nodes=0')
  for (const request of contextFirst) assert.equal(request.messages.filter(m=>m.content.some(b=>b.text==='state=0;nodes=0')).length,1)
  assert.deepEqual(contextFirst[1].messages.slice(0,contextFirst[0].messages.length),contextFirst[0].messages)
  await send(contextualAgent);await contextualAgent.whenIdle()
  const thirdStart=requests.length
  await send(contextualAgent);await contextualAgent.whenIdle()
  const latest=requests[thirdStart]
  assert.equal(latest.messages.filter(m=>m.source.kind==='user').length,2)
  assert.equal(latest.messages.at(-1).content[0].text,'state=3;nodes=2')
  assert.ok(!JSON.stringify(latest.messages).includes('state=0;nodes=0'))
  const inspectedNode=(await service.view('contextual')).worldline.selected
  const contextPage=await service.inspection('contextual',inspectedNode,'rewritten',undefined,2)
  assert.equal(contextPage.events.length,2);assert.ok(contextPage.next!==undefined)
  const olderPage=await service.inspection('contextual',inspectedNode,'rewritten',contextPage.next,10)
  assert.equal(olderPage.identity,contextPage.identity)
  assert.equal(contextPage.position.floor,3)
  assert.equal(contextPage.context.at(-1).message.content[0].text,'state=3;nodes=2')
  const contextRecords=contextualAgent.session.snapshotEvents().filter(e=>e.type==='request/messages')
  assert.equal(contextRecords.length,7)
  for(const [index,event] of contextRecords.entries()) {
    const inspected=await service.request('contextual',event.seq)
    assert.deepEqual(inspected.messages,requests[contextStart+index].messages)
    assert.equal(inspected.status,'recorded')
  }
  const savedRequest=await service.request('contextual',contextRecords[0].seq)
  const ctree=(await service.view('contextual')).worldline
  const rerollStart=requests.length
  await service.operation('contextual',{operationId:'context-reroll',expectedVersion:ctree.version,kind:'reroll',nodeId:ctree.nodes.at(-1).id})
  await contextualAgent.whenIdle()
  assert.equal(requests[rerollStart].messages.at(-1).content[0].text,'state=3;nodes=2')
  assert.deepEqual((await service.request('contextual',contextRecords[0].seq)).messages,savedRequest.messages)
  const cseed=contextualAgent.session.snapshotEvents()
  const crestore=await root.agentLoop.createAgent(root,{sessionId:SessionId('context-restored'),seed:cseed,meta:{cwd:directory,parentSession:contextualAgent.id,isSeeded:true},inheritedEventCount:cseed.length,agentOptions:{provider:'deterministic',model:'test'}})
  service.attach(crestore.agent)
  assert.deepEqual((await service.request('context-restored',contextRecords[0].seq)).messages,savedRequest.messages)
  core.deleteProject(project.id)
  await send(second); await second.whenIdle()
  assert.deepEqual((await service.view('two')).runtime.state, { count: 3, secretCounter: 4 })
  await service.close()
  for (const agent of [first, second, handle.agent, recovered.agent, early.agent]) assert.equal(root.tools.schemas(agent).length, 0)
  console.log('Performance worldlines: immutable siblings, state selection, actual requests, durable recovery, scope isolation and cleanup passed')
} finally {
  await service?.close(); await root.fiber.dispose(); await compiler.close()
  storage.close(); rmSync(directory, { recursive: true, force: true })
}
