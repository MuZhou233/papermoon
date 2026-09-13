/** Host plugin: authenticated setup and effect-owned writer Agent composition. */
import { z } from 'zod'
import { isAbsolute } from 'node:path'
import type { StoryRepository } from '@papermoon/story-core/repository'
import type { CompilationService } from '@papermoon/story-compiler/service'
import type { ScriptId } from '@papermoon/story-core'
import type { WriterRepository } from '../../writers/src/repository.ts'
import { WriterSessions, configureSchema } from './service.ts'
import { CONFIG_KEY, PRESET, TARGET_PROVIDER, WriterSessionError, writerState } from './model.ts'
import type { Host } from './host.ts'
export const name = 'papermoon-writer-sessions'
export const inject = ['papermoonStoryCore', 'papermoonStoryCompiler', 'papermoonWriters', 'agents', 'agentPresets', 'sessionController', 'workspaceRegistry', 'connection']
export interface Config { cwd: string }
const sessionRequest = z.strictObject({ sessionId: z.string().min(1) })
const scriptRequest = z.strictObject({ scriptId: z.string().min(1) })
const envelope = z.strictObject({ type: z.literal('client-request'), rpcId: z.string().min(1), method: z.string(), payload: z.unknown() })
export async function apply(ctx: Host, config: Config): Promise<void> {
  if (!isAbsolute(config.cwd)) throw new Error('writer sessions cwd must be absolute')
  const core = ctx.get('papermoonStoryCore') as StoryRepository
  const writers = ctx.get('papermoonWriters') as WriterRepository
  const service = new WriterSessions(ctx, { core, writers, compiler: ctx.get('papermoonStoryCompiler') as CompilationService }, config.cwd)
  ctx.effect(function* () {
    yield () => service.dispose()
    yield ctx.provide('papermoonWriterSessions', service)
    yield ctx.workspaceRegistry.registerResourceProvider(TARGET_PROVIDER, {
      async resolve(key) {
        try {
          const script = core.getScript(key as ScriptId)
          return { title: script.name, cwd: config.cwd }
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') return undefined
          throw error
        }
      },
      async accepts(key, sessionId) {
        const live = ctx.agents.get(sessionId)
        const saved = live ? undefined : await ctx.sessionController.inspect(sessionId)
        const state = writerState(live?.session ?? { header: saved!.meta, snapshotEvents: () => saved!.events })
        return state.mode === PRESET && (state.fixed?.scriptId ?? state.preparation?.scriptId) === key
      },
    })
    yield ctx.on('agent/created', ({ agent }) => service.attach(agent))
    yield ctx.on('agent-preset/selected', id => { const agent = ctx.agents.get(id); if (agent) service.attach(agent) })
    yield ctx.on('agent-preset/selecting', async (agent, preset) => {
      const state = writerState(agent.session)
      if (state.fixed && preset !== PRESET) throw new WriterSessionError('locked', 'accepted writer mode is fixed')
    })
    yield ctx.on('agent-preset/changed', async (agent, preset) => {
      for (const workspace of ctx.workspaceRegistry.list()) {
        if (!workspace.sessionIds.includes(agent.id)) continue
        const isScript = workspace.target?.provider === TARGET_PROVIDER
        if ((preset === PRESET && !isScript) || (preset !== PRESET && isScript)) await workspace.detachSession(agent.id)
      }
      if (preset !== PRESET && writerState(agent.session).preparation)
        agent.session.append('session/configuration', { key: CONFIG_KEY, value: null })
    })
    yield ctx.on('session/created-for-client', async (agent, workspace) => {
      if (workspace?.target?.provider === TARGET_PROVIDER) {
        if (writerState(agent.session).mode !== PRESET) await ctx.agentPresets.select(agent, PRESET)
        service.prepare(agent, workspace.target.key)
      } else if (workspace && writerState(agent.session).mode === PRESET)
        throw new WriterSessionError('wrong-mode', 'writer mode requires a script workspace')
    })
    yield ctx.on('session/prompt-admission', async (agent, _message, next) => service.admit(agent, await next()))
    for (const agent of ctx.agents.list()) service.attach(agent)
    for (const method of ['scripts', 'writers', 'workspace', 'state', 'configure'] as const) {
      yield ctx.connection.fetch.register({
        path: `/api/papermoon-writer-sessions/${method}`, methods: ['POST'], requestBody: 'buffered',
        async fetch(request) {
          if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return new Response('unsupported media type', { status: 415 })
          let raw: unknown
          try { raw = await request.json() } catch { return new Response('invalid JSON', { status: 400 }) }
          const parsed = envelope.safeParse(raw)
          if (!parsed.success || parsed.data.method !== `papermoon-writer-sessions/${method}`) return new Response('invalid RPC envelope', { status: 400 })
          let result: unknown
          try {
            request.signal.throwIfAborted()
            const input = parsed.data.payload
            let value: unknown
            switch (method) {
              case 'scripts': z.strictObject({}).parse(input); value = await service.scripts(); break
              case 'writers': z.strictObject({}).parse(input); value = writers.list().map(({ id, name, sequence, description }) => ({ id, name, sequence, description })); break
              case 'workspace': value = { workspaceId: (await service.workspace(scriptRequest.parse(input).scriptId)).id }; break
              case 'state': value = service.view(await service.agent(sessionRequest.parse(input).sessionId)); break
              case 'configure': value = await service.configure(configureSchema.parse(input)); break
            }
            result = { ok: true, value }
          } catch (error) {
            result = { ok: false, error: { code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'invalid-input', message: error instanceof Error ? error.message : String(error) } }
          }
          return Response.json({ type: 'server-response', rpcId: parsed.data.rpcId, result })
        },
      })
    }
  }, 'papermoon.writer-sessions')
  await service.refreshWorkspaceTitles()
}

export { WriterSessions } from './service.ts'
export { PRESET } from './model.ts'
