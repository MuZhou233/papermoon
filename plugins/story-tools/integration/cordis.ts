/** Actual DSH tool registry and scope lifecycle; no Session loop or model invocation. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Context as HostContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { StoryStorage } from '../../story-storage/lib/index.js'
import { StoryRepository } from '../../story-core/lib/repository.js'
import { createStoryTools, StoryObservations } from '../lib/index.js'
import { registerStoryTools } from '../lib/plugin.js'
import { schemas, toolCatalog } from '../lib/catalog.js'
import { CompilationService } from '../../story-compiler/lib/service.js'
import { ArtifactStore } from '../../story-compiler/lib/store.js'
import * as writers from '../../writers/lib/index.js'
import type { WriterRepository } from '../../writers/lib/repository.js'
const base = new URL('../../../dsh/', import.meta.url)
const { Context } = (await import(
  new URL('vendor/cordis/lib/index.js', base).href
)) as typeof import('@deepseek-ai/cordis')
const { default: SystemPrompt } = (await import(
  new URL('packages/core/system-prompt/lib/index.js', base).href
)) as typeof import('@deepseek-ai/dsh-system-prompt')
const { default: ToolRuntime } = (await import(
  new URL('packages/core/tools/lib/index.js', base).href
)) as typeof import('@deepseek-ai/dsh-tools')
const { createScope } = (await import(
  new URL('packages/core/scope/lib/index.js', base).href
)) as typeof import('@deepseek-ai/dsh-scope')
const root = new Context(),
  directory = mkdtempSync(join(tmpdir(), 'papermoon-tool-registry-'))
const storage = new StoryStorage({ path: join(directory, 'story.sqlite') }),
  repository = new StoryRepository(storage)
const compiler = new CompilationService(repository, new ArtifactStore(join(directory, 'compiled')))
try {
  await root.plugin(SystemPrompt, {})
  await root.plugin(ToolRuntime)
  const project = repository.createProject({ name: 'Tools' })
  const left = repository.createScript({
      projectId: project.id,
      name: 'Left',
      defaultLanguage: 'en',
    }),
    right = repository.createScript({
      projectId: project.id,
      name: 'Right',
      defaultLanguage: 'zh-CN',
    })
  async function scoped(id: string) {
    const agent = { id } as Agent
    let scope!: ReturnType<typeof createScope>
    await root.plugin(
      Object.assign(
        (ctx: HostContext) => {
          scope = createScope(ctx, agent)
        },
        { inject: ['tools', 'systemPrompt'] },
      ),
    )
    return { scope, agent }
  }
  const a = await scoped('left'),
    b = await scoped('right')
  const typed: ToolDefinition[] = createStoryTools(repository, left.id, undefined, compiler)
  assert.equal(typed.length, 16)
  registerStoryTools(a.scope.ctx, repository, left.id, undefined, compiler)
  const remove = registerStoryTools(b.scope.ctx, repository, right.id, undefined, compiler)
  assert.equal(root.tools.schemas().length, 0)
  assert.equal(root.tools.schemas(a.agent).length, 16)
  assert.deepEqual(
    root.tools.schemas(a.agent).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
    toolCatalog().map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    })),
  )
  let call = 0
  const execute = (
    agent: Agent | undefined,
    name: string,
    args: unknown,
    signal = new AbortController().signal,
  ) =>
    root.tools.execute({
      agent,
      name,
      arguments: args,
      signal,
      callId: String(++call) as import('@deepseek-ai/dsh-llm/brand').ToolCallId,
    })
  assert.equal(
    (
      await execute(a.agent, 'story_program_edit', {
        operations: [{ kind: 'create-file', path: 'file', source: 'left' }],
      })
    ).isError,
    false,
  )
  assert.equal(
    (await execute(b.agent, 'story_program_read', { path: 'file' })).isError,
    true,
  )
  assert.equal((await execute(undefined, 'story_status', {})).isError, true)
  assert.equal(
    (
      await execute(a.agent, 'story_program_edit', {
        expectedSequence: 'wrong',
        operations: [],
      })
    ).isError,
    true,
  )
  const invalidReference = await execute(a.agent, 'story_commit', {
    expectedSequence: 1, description: 'Reference validation', references: ['story.js'],
  })
  assert.equal(invalidReference.isError, true)
  assert.match(invalidReference.content.filter(block => block.type === 'text').map(block => block.text).join('\n'), /references\[0\]: "story\.js"/)
  assert.equal(repository.readSnapshot({ kind: 'draft', scriptId: left.id }).draft.sequence, 1)
  assert.equal(repository.listRevisions(left.id).items.length, 0)
  const abort = new AbortController()
  abort.abort()
  assert.equal(
    (
      await execute(
        a.agent,
        'story_commit',
        { expectedSequence: 1, description: 'cancelled' },
        abort.signal,
      )
    ).isError,
    true,
  )
  assert.equal(repository.listRevisions(left.id).items.length, 0)
  const success = async (name: string, args: unknown) => {
    const result = await execute(a.agent, name, args)
    assert.equal(
      result.isError,
      false,
      `${name}: ${JSON.stringify(result.content)}`,
    )
  }
  await success('story_status', {})
  await success('story_program_list', {})
  await success('story_program_read', { path: 'file' })
  await success('story_program_search', { query: 'left' })
  await success('story_text_edit', {
    operations: [
      { kind: 'create-text', key: 'greeting' },
      {
        kind: 'set-translation',
        key: 'greeting',
        language: 'en',
        text: 'Hello',
      },
    ],
  })
  await success('story_text_list', {})
  await success('story_text_read', { key: 'greeting' })
  await success('story_text_read', { key: 'greeting', language: 'en' })
  await success('story_text_read', { key: 'greeting', language: 'fr' })
  await success('story_text_search', { query: 'Hello' })
  await success('story_commit', {
    expectedSequence: 2,
    description: 'Complete tool roundtrip', allowCompilationFailure: true,
  })
  const revisionId = repository.listRevisions(left.id).items[0]!.revision.id
  await success('story_history', {})
  await success('story_history', { revisionId })
  await success('story_diff', {
    left: { kind: 'revision', revisionId },
    right: { kind: 'draft' },
  })
  await success('story_restore', {
    expectedSequence: 3,
    revisionId,
    selection: { kind: 'all' },
  })
  await success('story_help', {})
  for (const topic of schemas.story_help.shape.topic.unwrap().options) {
    await success('story_help', { topic })
  }
  await success('story_program_edit', {
    operations: [{ kind: 'create-file', path: 'story.js', source: 'module.exports={systemPrompt:"Opening",messages:[]}' }],
  })
  await success('story_compile', { ref: { kind: 'draft', sequence: 5 } })
  assert.equal((await execute(b.agent, 'story_compile', { ref: { kind: 'revision', revisionId } })).isError, true)

  const shared = repository.createScript({ projectId: project.id, name: 'Shared', defaultLanguage: 'en' })
  repository.editDraft({ scriptId: shared.id, expectedSequence: 0, operations: [
    { kind: 'create-file', path: 'main.js', source: 'Before' },
    { kind: 'add-language', language: 'zh-CN' },
    { kind: 'create-text', key: 'opening' },
    { kind: 'set-translation', key: 'opening', language: 'en', text: 'Hello' },
    { kind: 'set-translation', key: 'opening', language: 'zh-CN', text: '你好' },
  ] })
  const c = await scoped('shared-c'), d = await scoped('shared-d')
  registerStoryTools(c.scope.ctx, repository, shared.id, new StoryObservations(), compiler)
  registerStoryTools(d.scope.ctx, repository, shared.id, new StoryObservations(), compiler)
  for (const agent of [c.agent, d.agent]) {
    assert.equal((await execute(agent, 'story_program_read', { path: 'main.js' })).isError, false)
  }
  assert.equal((await execute(c.agent, 'story_text_read', { key: 'opening', language: 'en' })).isError, false)
  assert.equal((await execute(d.agent, 'story_text_read', { key: 'opening', language: 'zh-CN' })).isError, false)
  const concurrent = await Promise.all([
    execute(c.agent, 'story_text_edit', { operations: [{ kind: 'set-translation', key: 'opening', language: 'en', text: 'Changed' }] }),
    execute(d.agent, 'story_text_edit', { operations: [{ kind: 'set-translation', key: 'opening', language: 'zh-CN', text: '新内容' }] }),
    execute(c.agent, 'story_program_edit', { operations: [{ kind: 'replace-file', path: 'main.js', source: 'After' }] }),
  ])
  assert.ok(concurrent.every(result => !result.isError), JSON.stringify(concurrent))
  const sharedContent = repository.readSnapshot({ kind: 'draft', scriptId: shared.id }).content
  assert.equal(sharedContent.texts.entries.get('opening')!.translations.get('en')!.text, 'Changed')
  assert.equal(sharedContent.texts.entries.get('opening')!.translations.get('zh-CN')!.text, '新内容')
  const stale = await execute(d.agent, 'story_program_edit', { operations: [{ kind: 'replace-file', path: 'main.js', source: 'Stale' }] })
  assert.equal(stale.isError, true)
  assert.match(JSON.stringify(stale.content), /observation-stale/)
  assert.equal(root.tools.schemas().length, 0)
  await c.scope.dispose(); await d.scope.dispose()
  assert.equal(root.tools.schemas(c.agent).length, 0); assert.equal(root.tools.schemas(d.agent).length, 0)

  a.scope.ctx.tools.register({
    ...typed[0]!,
    name: 'invalid_output',
    execute: async () => 'not an object',
  })
  assert.equal((await execute(a.agent, 'invalid_output', {})).isError, true)
  remove()
  assert.equal(root.tools.schemas(b.agent).length, 0)
  await a.scope.dispose()
  assert.equal(root.tools.schemas(a.agent).length, 0)
  await b.scope.dispose()
  // The management provider drains dependent consumers before closing its connection.
  const routes = new Set<string>()
  const connection = await root.plugin((ctx: HostContext) => {
    ctx.effect(
      () =>
        ctx.provide('connection', {
          fetch: {
            register(route: { path: string }) {
              routes.add(route.path)
              return () => {
                routes.delete(route.path)
              }
            },
          },
        }),
      'integration.connection',
    )
  })
  const writerPlugin = await root.plugin(writers, {
    path: join(directory, 'writers.sqlite'),
  })
  const settings = root.get('papermoonWriters') as WriterRepository
  assert.equal(settings.list().length, 0)
  assert.equal(routes.size, 8)
  let drained = false
  await root.plugin({
    inject: ['papermoonWriters'],
    apply(ctx: HostContext) {
      const service = ctx.get('papermoonWriters') as WriterRepository
      ctx.effect(
        () => async () => {
          await Promise.resolve()
          assert.equal(service.list().length, 0)
          drained = true
        },
        'integration.writer-consumer',
      )
    },
  })
  await writerPlugin.dispose()
  assert.ok(drained)
  assert.equal(routes.size, 0)
  assert.throws(() => settings.list(), /closed/)
  await connection.dispose()
  console.log(
    'PaperMoon: real tool schemas, execution, scopes, cancellation, output validation and writer lifecycle passed',
  )
} finally {
  await root.fiber.dispose()
  await compiler.close()
  storage.close()
  rmSync(directory, { recursive: true, force: true })
}
