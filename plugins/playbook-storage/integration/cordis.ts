/** Built-artifact integration with the pinned host; never part of the host-free unit suite. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context as HostContext, Plugin } from '@deepseek-ai/cordis'
import * as adapter from '../lib/plugin.js'
import { PlaybookStorage } from '../lib/index.js'

const hostUrl = new URL('../../../dsh/vendor/cordis/lib/index.js', import.meta.url)
// A runtime URL keeps the host dependency out of the parent workspace and lockfile.
const { Context } = await import(hostUrl.href) as { Context: new () => HostContext }
const contract: Plugin<adapter.Config> = adapter
const directory = mkdtempSync(join(tmpdir(), 'papermoon-cordis-'))
const root = new Context()
const acceptsHost = (_host: adapter.StorageHost): void => {}
acceptsHost(root)
try {
  const config = { path: join(directory, 'playbook.sqlite') }
  let provider = await root.plugin(contract, config)
  const storage = root.get(adapter.serviceKey) as PlaybookStorage
  assert.ok(storage instanceof PlaybookStorage)
  const project = storage.createProject({ name: 'Integration' })
  let cleaned = false
  const consumer = await root.plugin({
    name: 'storage-lifecycle-consumer', inject: [adapter.serviceKey],
    apply(ctx: HostContext) {
      const service = ctx.get(adapter.serviceKey) as PlaybookStorage
      ctx.effect(() => async () => {
        await Promise.resolve()
        assert.equal(service.getProject(project.id).name, 'Integration')
        cleaned = true
      }, 'integration.consumer')
    },
  })
  await provider.dispose()
  assert.equal(cleaned, true)
  assert.equal(root.get(adapter.serviceKey), undefined)
  assert.throws(() => storage.listProjects(), { code: 'closed' })
  await consumer.dispose()
  provider = await root.plugin(contract, config)
  const reopened = root.get(adapter.serviceKey) as PlaybookStorage
  assert.equal(reopened.getProject(project.id).name, 'Integration')
  await provider.dispose()
  await assert.rejects(Promise.resolve(root.plugin(contract, { path: ':memory:' })), { code: 'invalid-input' })
  assert.equal(root.get(adapter.serviceKey), undefined)
  console.log('PaperMoon storage: built imports, real Cordis lifecycle and reopening passed')
} finally {
  await root.fiber.dispose()
  rmSync(directory, { recursive: true, force: true })
}
