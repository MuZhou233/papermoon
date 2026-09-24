/** Built public DSH runtime with a deterministic adapter; no network or model credentials. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PlaybookStorage } from '../../playbook-storage/lib/index.js'
import { PlaybookRepository } from '../../playbook-core/lib/repository.js'
import { WriterRepository } from '../../writers/lib/repository.js'
import { createWriterTemplate } from '../../writers/lib/model.js'
import { WriterSessions, PRESET } from '../lib/index.js'
import { CompilationService } from '../../playbook-compiler/lib/service.js'
import { ArtifactStore } from '../../playbook-compiler/lib/store.js'
const base = new URL('../../../dsh/', import.meta.url)
const moduleAt = path => import(new URL(path + '/lib/index.js', base).href)
const { Context } = await moduleAt('vendor/cordis')
const llm = await moduleAt('packages/llm/llm')
const { default: Sessions, SessionId } = await moduleAt('packages/core/session')
const { default: SystemPrompt, renderPrompt } = await moduleAt('packages/core/system-prompt')
const { default: Tools } = await moduleAt('packages/core/tools')
const { default: Agents } = await moduleAt('packages/core/agent')
const { default: Loop } = await moduleAt('packages/core/agent-loop')
const { default: Projections } = await moduleAt('packages/session/session-projection')
const directory = mkdtempSync(join(tmpdir(), 'papermoon-writer-runtime-')), root = new Context()
const storage = new PlaybookStorage({ path: join(directory, 'playbook.sqlite') }), core = new PlaybookRepository(storage)
const writers = new WriterRepository({ path: join(directory, 'writers.sqlite') })
const compiler = new CompilationService(core, new ArtifactStore(join(directory, 'compiled')))
let service
try {
  await root.plugin(llm.default)
  await root.plugin(Sessions)
  await root.plugin(Projections)
  await root.plugin(SystemPrompt, { personaPrefix: 'Default coding prompt', personaSuffix: 'CWD {{cwd}}' })
  await root.plugin(Tools)
  await root.plugin(Agents)
  await root.plugin(Loop, { agents: [] })
  const requests = []
  class Adapter extends llm.LlmAdapter {
    async resolveModel(provider, model) { return { provider, id: model, name: model } }
    async *stream(options) {
      requests.push(options)
      const ordinal = requests.length
      if (ordinal <= 3) {
        const name = ordinal === 1 ? 'playbook_program_read' : ordinal === 2 ? 'playbook_program_edit' : 'playbook_compile'
        const args = ordinal === 1 ? { path: 'main.js' } : ordinal === 2 ? { operations: [{ kind: 'replace-file', path: 'main.js', source: 'after' }] } : { ref: { kind: 'draft', sequence: 3 } }
        const blocks = [{ type: 'tool-call', id: llm.ToolCallId('call-' + ordinal), name, arguments: JSON.stringify(args) }]
        if (ordinal === 2) blocks.push({ type: 'tool-call', id: llm.ToolCallId('call-text'), name: 'playbook_text_edit', arguments: JSON.stringify({ operations: [{ kind: 'create-text', key: 'opening' }, { kind: 'set-translation', key: 'opening', language: 'en', text: 'A separate text edit' }] }) })
        for (const [index, block] of blocks.entries()) {
          yield { type: 'block-start', index, blockType: 'tool-call' }
          yield { type: 'block-end', index, block }
        }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      } else {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Done' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
  }
  root.llm.registerAdapter(['deterministic'], new Adapter())
  const project = core.createProject({ name: 'Runtime' }), playbook = core.createPlaybook({ projectId: project.id, name: 'Playbook', defaultLanguage: 'en' })
  core.editDraft({ playbookId: playbook.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'main.js', source: 'before' }, { kind: 'create-file', path: 'playbook.js', source: 'module.exports={systemPrompt:"Compiled opening",messages:[]}' }] })
  const writer = writers.create({ ...createWriterTemplate('Writer'), systemPrompt: '  {{literal}}\n', messages: [
    { id: 'one', name: 'One', role: 'user', content: '' }, { id: 'two', role: 'user', content: 'second' },
    { id: 'three', role: 'assistant', content: 'acknowledged' }, { id: 'four', role: 'assistant', content: '{{untouched}}' },
  ] })
  const host = { sessionController: { resolveAgent: async id => ({ agent: root.agents.get(SessionId(id)) }) } }
  service = new WriterSessions(host, { core, writers, compiler }, directory)
  const agent = await root.agentLoop.create(SessionId('writer-runtime'), { provider: 'deterministic', model: 'test' }, { cwd: directory })
  agent.session.append('agent-preset/selected', { agentPreset: PRESET })
  service.prepare(agent, playbook.id)
  await service.configure({ sessionId: agent.id, writerId: writer.id, writerSequence: writer.sequence })
  const send = text => agent.followup(service.admit(agent, llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })))
  send('Write'); await agent.whenIdle()
  const events = agent.session.snapshotEvents()
  assert.deepEqual(events.filter(event => event.type === 'turn/end' && event.data.reason.kind === 'error'), [])
  assert.equal(requests.length, 4)
  assert.ok(JSON.stringify(requests[3].messages).includes('Compiled opening'))
  assert.ok(JSON.stringify(events).includes('Compiled opening'))
  assert.deepEqual(requests[0].messages.map(message => message.role), ['system', 'user', 'user', 'assistant', 'assistant', 'user'])
  assert.deepEqual(requests[0].messages.map(message => message.content.map(block => block.text).join('')), ['  {{literal}}\n', '', 'second', 'acknowledged', '{{untouched}}', 'Write'])
  assert.equal(requests[0].tools.length, 16)
  for (const name of ['playbook_program_edit', 'playbook_text_edit']) assert.equal(Object.hasOwn(requests[0].tools.find(tool => tool.name === name).parameters.properties, 'expectedSequence'), false)
  assert.equal(core.readSnapshot({ kind: 'draft', playbookId: playbook.id }).content.texts.entries.get('opening').translations.get('en').text, 'A separate text edit')
  assert.equal(root.tools.schemas().length, 0)
  assert.equal(core.readFile({ kind: 'draft', playbookId: playbook.id }, 'main.js').file.source, 'after')
  assert.equal(events.filter(event => event.type === 'context/message').length, 4)
  send('Continue'); await agent.whenIdle()
  assert.equal(agent.session.snapshotEvents().filter(event => event.type === 'context/message').length, 4)
  const removeExtra = agent.ctx.systemPrompt.section({ name: 'test:explicit-plugin', order: 20, text: 'Explicit plugin' })
  assert.equal(renderPrompt(await root.systemPrompt.assemble({ agent, scope: agent })), '  {{literal}}\n\n\nExplicit plugin')
  removeExtra()
  service.dispose()
  assert.equal(root.tools.schemas(agent).length, 0)
  console.log('Writer runtime: literal requests, consecutive tools, one-time context and scope cleanup passed')
} finally {
  service?.dispose()
  await root.fiber.dispose()
  await compiler.close()
  writers.close(); storage.close(); rmSync(directory, { recursive: true, force: true })
}
