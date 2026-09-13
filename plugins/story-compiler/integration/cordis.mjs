/** Real service lifecycle over built modules, including cancellation on dependency removal. */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '../../../dsh/vendor/cordis/lib/index.js'
import * as storagePlugin from '../../story-storage/lib/plugin.js'
import * as corePlugin from '../../story-core/lib/plugin.js'
import * as compilerPlugin from '../lib/plugin.js'
const directory = await mkdtemp(join(tmpdir(), 'papermoon-compiler-cordis-')), root = new Context()
try {
  const compiler = await root.plugin(compilerPlugin, { directory: join(directory, 'compiled') })
  await root.plugin(corePlugin)
  assert.equal(root.get('papermoonStoryCompiler'), undefined)
  const provider = await root.plugin(storagePlugin, { path: join(directory, 'story.sqlite') })
  await compiler.await()
  const repository = root.get('papermoonStoryCore'), service = root.get('papermoonStoryCompiler')
  assert.ok(service)
  const project = repository.createProject({ name: 'Integration' })
  const script = repository.createScript({ projectId: project.id, name: 'Opening', defaultLanguage: 'en' })
  repository.editDraft({ scriptId: script.id, expectedSequence: 0, operations: [{ kind: 'create-file', path: 'story.js', source: 'module.exports={systemPrompt:"",messages:[]}' }] })
  const saved = await service.compile({ scriptId: script.id, ref: { kind: 'draft', sequence: 1 } })
  assert.equal(saved.ok, true)
  let drained = false
  await root.plugin({
    inject: ['papermoonStoryCompiler'],
    apply(ctx) {
      ctx.effect(() => async () => {
        assert.equal((await service.initialize(saved.artifactId)).systemPrompt, '')
        drained = true
      }, 'integration.consumer')
    },
  })
  const job = service.compile({ scriptId: script.id, ref: { kind: 'draft', sequence: 1 } })
  await provider.dispose()
  assert.ok(drained)
  assert.equal((await job).ok, false)
  assert.equal(root.get('papermoonStoryCompiler'), undefined)
  await assert.rejects(service.read(saved.artifactId), { code: 'closed' })
  await compiler.dispose()
  console.log('PaperMoon compiler: real Cordis waiting, consumer cleanup and Worker cancellation passed')
} finally { await root.fiber.dispose(); await rm(directory, { recursive: true, force: true }) }
