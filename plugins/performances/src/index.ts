/** Authenticated performance endpoints and effect-owned Session composition. */
import { z } from 'zod'
import type { StoryRepository } from '@papermoon/story-core/repository'
import { TARGET_PROVIDER, type StoryWorkspaces } from '../../story-workspaces/src/index.ts'
import { Performances, startSchema, type PerformanceHost } from './service.ts'
import { performanceState } from './model.ts'
import { PRESET } from './constants.ts'
export { Performances } from './service.ts'
export { performanceState, openingMessages, validateFrozen } from './model.ts'
export { PRESET } from './constants.ts'
export const name = 'papermoon-performances'
export const inject = ['papermoonStoryCore', 'papermoonStoryWorkspaces', 'agents', 'sessions', 'agentPresets', 'sessionController', 'workspaceRegistry', 'connection']
const envelope = z.strictObject({ type: z.literal('client-request'), rpcId: z.string().min(1), method: z.string(), payload: z.unknown() })
const operationFields = { sessionId: z.string().min(1), operationId: z.string().min(1), expectedVersion: z.number().int().nonnegative(), nodeId: z.string().min(1) }
const methods = {
  scripts: z.strictObject({}), models: z.strictObject({}),
  choices: z.strictObject({ scriptId: z.string().min(1), revisionId: z.string().min(1).optional() }),
  tree: z.strictObject({ sessionId: z.string().min(1), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(100).default(100) }),
  node: z.strictObject({ sessionId: z.string().min(1), nodeId: z.string().min(1) }),
  operation: z.discriminatedUnion('kind', [
    z.strictObject({ ...operationFields, kind: z.enum(['select', 'candidate', 'reroll']) }),
    z.strictObject({ ...operationFields, kind: z.literal('edit'), text: z.string() }),
  ]),
  state: z.strictObject({ sessionId: z.string().min(1) }), start: startSchema,
}
export function apply(ctx: PerformanceHost) {
  const workspaces = ctx.get('papermoonStoryWorkspaces') as StoryWorkspaces
  const service = new Performances(ctx, ctx.get('papermoonStoryCore') as StoryRepository, workspaces)
  ctx.effect(function* () {
    yield () => service.close()
    yield ctx.provide('papermoonPerformances', service)
    yield workspaces.register(PRESET, session => { const state = performanceState(session); return state.mode === PRESET ? state.fixed?.scriptId ?? state.scriptId : undefined })
    yield ctx.on('session/event', (session, event) => service.observe(session, event))
    yield ctx.on('agent/created', ({ agent }) => service.attach(agent))
    yield ctx.on('agent-preset/selected', id => { const agent = ctx.agents.get(id); if (agent) service.attach(agent) })
    yield ctx.on('agent-preset/selecting', async (agent, preset) => { if (performanceState(agent.session).fixed && preset !== PRESET) throw new Error('performance mode is fixed') })
    yield ctx.on('session/created-for-client', async (agent, workspace) => {
      if (performanceState(agent.session).mode !== PRESET) return
      if (workspace?.target?.provider === TARGET_PROVIDER) service.prepare(agent, workspace.target.key)
      else if (workspace) throw new Error('performance mode requires a script workspace')
    })
    yield ctx.on('session/prompt-admission', async (agent, _message, next) => { const message = await next(); return message === null ? null : service.admit(agent, message) })
    for (const agent of ctx.agents.list()) service.attach(agent)
    for (const method of Object.keys(methods) as (keyof typeof methods)[]) yield ctx.connection.fetch.register({
      path: '/api/papermoon-performances/' + method, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return new Response('unsupported media type', { status: 415 })
        const parsed = envelope.safeParse(await request.json().catch(() => undefined))
        if (!parsed.success || parsed.data.method !== 'papermoon-performances/' + method) return new Response('invalid RPC envelope', { status: 400 })
        let result: unknown
        try {
          request.signal.throwIfAborted()
          let value: unknown
          const raw = parsed.data.payload
          switch (method) {
            case 'scripts': methods.scripts.parse(raw); value = await workspaces.scripts(); break
            case 'models': methods.models.parse(raw); value = await ctx.sessionController.modelCatalog(); break
            case 'choices': { const p = methods.choices.parse(raw); value = service.choices(p.scriptId, p.revisionId); break }
            case 'tree': { const p = methods.tree.parse(raw); value = await service.tree(p.sessionId, p.offset, p.limit); break }
            case 'node': { const p = methods.node.parse(raw); value = await service.node(p.sessionId, p.nodeId); break }
            case 'operation': { const { sessionId, ...p } = methods.operation.parse(raw); value = await service.operation(sessionId, p); break }
            case 'state': value = await service.view(methods.state.parse(raw).sessionId); break
            case 'start': value = await service.start(methods.start.parse(raw)); break
          }
          result = { ok: true, value }
        } catch (error) { result = { ok: false, error: { code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'performance-failed', message: error instanceof Error ? error.message : String(error) } } }
        return Response.json({ type: 'server-response', rpcId: parsed.data.rpcId, result })
      },
    })
  }, 'papermoon.performances')
}
