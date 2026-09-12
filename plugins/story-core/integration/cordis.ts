/** Real Cordis integration using built modules; no Web server or model requests. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context as HostContext, Plugin } from '@deepseek-ai/cordis'
import * as adapter from '../lib/plugin.js'
import * as storageAdapter from '../../story-storage/lib/plugin.js'
import { StoryRepository } from '../lib/repository.js'

const hostUrl = new URL('../../../dsh/vendor/cordis/lib/index.js', import.meta.url)
const { Context } = await import(hostUrl.href) as { Context: new () => HostContext }
const contract: Plugin = adapter
const root = new Context(), directory = mkdtempSync(join(tmpdir(), 'papermoon-core-cordis-'))
const acceptsHost = (_host: adapter.CoreHost): void => {}
acceptsHost(root)
try {
  const core = await root.plugin(contract)
  assert.equal(root.get(adapter.serviceKey), undefined)
  let provider = await root.plugin(storageAdapter, { path: join(directory, 'story.sqlite') })
  const repository = root.get(adapter.serviceKey) as StoryRepository
  assert.ok(repository instanceof StoryRepository)
  const project = repository.createProject({ name: 'Integration' })
  const script = repository.createScript({ projectId: project.id, name: 'Empty', defaultLanguage: 'zh-CN' })
  const revision = repository.commitRevision({ scriptId: script.id, expectedSequence: 0, description: 'Empty content' })
  let drained = false
  const consumer = await root.plugin({
    name: 'core-lifecycle-consumer', inject: [adapter.serviceKey],
    apply(ctx: HostContext) {
      const service = ctx.get(adapter.serviceKey) as StoryRepository
      ctx.effect(() => async () => {
        await Promise.resolve()
        assert.equal(service.readSnapshot({ kind: 'revision', revisionId: revision.revision.id }).content.texts.defaultLanguage, 'zh-CN')
        drained = true
      }, 'integration.core-consumer')
    },
  })
  await provider.dispose()
  assert.equal(drained, true)
  assert.equal(root.get(adapter.serviceKey), undefined)
  assert.throws(() => repository.listProjects(), { code: 'closed' })
  await consumer.dispose()
  provider = await root.plugin(storageAdapter, { path: join(directory, 'story.sqlite') })
  const reopened = root.get(adapter.serviceKey) as StoryRepository
  assert.ok(reopened instanceof StoryRepository)
  assert.notEqual(reopened, repository)
  assert.equal(reopened.getRevision(revision.revision.id).description, 'Empty content')
  await core.dispose()
  assert.equal(root.get(adapter.serviceKey), undefined)
  // Removing only the core must not close the separately owned storage service.
  assert.equal((root.get(storageAdapter.serviceKey) as import('../../story-storage/lib/index.js').StoryStorage).getProject(project.id).name, 'Integration')
  await provider.dispose()
  console.log('PaperMoon core: real Cordis dependency waiting, cleanup, reopening and ownership passed')
} finally {
  await root.fiber.dispose()
  rmSync(directory, { recursive: true, force: true })
}
