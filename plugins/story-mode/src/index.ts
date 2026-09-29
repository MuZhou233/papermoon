/** Authenticated story operations address a concrete Playbook save. */
import { writerState } from '../../writer-sessions/src/model.ts'
import { performanceState } from '../../performances/src/model.ts'
import { z } from 'zod'
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import type { Performances, PerformanceHost } from '../../performances/src/service.ts'
import { StoryMode } from './service.ts'
import { STORYLINE } from './state.ts'
export const name = 'papermoon-story-mode'
export const inject = ['papermoonPlaybookCore', 'papermoonPerformances', 'agents', 'sessions', 'sessionController', 'connection']
const object = z.strictObject, id = z.string().min(1), sequence = z.number().int().nonnegative()
const schemas = {
  context: object({ sessionId: id }),
  catalog: object({}), list: object({}), models: object({}),
  create: object({ name: id, projectId: id, storyline: id, language: id }),
  state: object({ playbookId: id }),
  advance: object({ playbookId: id, section: z.number().int(), expectedSequence: sequence }),
  choose: object({ playbookId: id, choice: object({ provider: id, model: id, reasoningEffort: id.optional() }) }),
  start: object({ playbookId: id, expectedSequence: sequence }), retry: object({ playbookId: id }), review: object({ playbookId: id }),
}
export function apply(ctx: PerformanceHost): void {
  const core = ctx.get('papermoonPlaybookCore') as PlaybookRepository
  const performances = ctx.get('papermoonPerformances') as Performances
  const story = new StoryMode(core, ctx, performances)
  ctx.effect(function* () {
    yield () => story.dispose()
    yield performances.onSettled(sessionId => {
      const save = story.list().find(item => item.progress.sessionId === sessionId)
      if (save) void story.run(save.id, () => story.state(save.id)).catch(() => {})
    })
    for (const method of Object.keys(schemas) as (keyof typeof schemas)[]) yield ctx.connection.fetch.register({
      path: '/api/papermoon-story/' + method, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return new Response('unsupported media type', { status: 415 })
        const envelope = object({ type: z.literal('client-request'), rpcId: id, method: z.literal('papermoon-story/' + method), payload: z.unknown() }).safeParse(await request.json().catch(() => null))
        if (!envelope.success) return new Response('invalid RPC envelope', { status: 400 })
        let result: unknown
        try {
          const p = schemas[method].parse(envelope.data.payload)
          const value = await story.run('playbookId' in p ? p.playbookId : 'catalog', async () => {
            switch (method) {
              case 'context': {
                const saved = await ctx.sessionController.inspect(schemas.context.parse(p).sessionId)
                const session = { header: saved.meta, snapshotEvents: () => saved.events }
                const writer = writerState(session), performance = performanceState(session)
                const playbookId = writer.fixed?.playbookId ?? writer.preparation?.playbookId ?? performance.fixed?.playbookId ?? performance.playbookId
                return playbookId && core.managed(playbookId as import('@papermoon/playbook-core').PlaybookId)?.policy === 'papermoon.story' ? { playbookId } : null
              }
              case 'catalog': return [{ id: STORYLINE, name: { en: 'Fogbound Earthshine', zh: '雾锁地照' }, description: { en: 'Design your own characters step by step, then join them for a game of Werewolf.', zh: '逐步设计属于自己的角色并和他们一起进行一场狼人杀游戏' } }]
              case 'list': return story.list()
              case 'models': return ctx.sessionController.modelCatalog()
              case 'create': return story.create(schemas.create.parse(p))
              case 'state': return story.state(schemas.state.parse(p).playbookId)
              case 'advance': { const v = schemas.advance.parse(p); return story.advance(v.playbookId, v.section, v.expectedSequence) }
              case 'choose': { const v = schemas.choose.parse(p); return story.choose(v.playbookId, v.choice) }
              case 'start': { const v = schemas.start.parse(p); return story.start(v.playbookId, v.expectedSequence) }
              case 'retry': return story.retry(schemas.retry.parse(p).playbookId)
              case 'review': { const review = await story.review(schemas.review.parse(p).playbookId); return { ...review, content: { systemPrompt: review.content.systemPrompt, opening: review.content.opening } } }
            }
          })
          result = { ok: true, value }
        } catch (error) { result = { ok: false, error: { code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'story/refused', message: error instanceof Error ? error.message : String(error), details: {} } } }
        return Response.json({ type: 'server-response', rpcId: envelope.data.rpcId, result })
      },
    })
  }, 'papermoon.story-mode')
}
