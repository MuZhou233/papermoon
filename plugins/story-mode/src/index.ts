/** Authenticated Story Mode boundary; all step mutations are host-validated. */
import { z } from 'zod'
import { StoryMode, type StoryHost } from './service.ts'
import { Progress } from './state.ts'
import { StoryError } from './errors.ts'
export const name = 'papermoon-story-mode'
export const inject = ['textConversations', 'agents', 'sessionPersistence', 'connection']
type Dispose = () => void | Promise<void>
interface Host extends StoryHost {
  effect(body: () => Iterable<Dispose, void>, label: string): unknown
  connection: { fetch: { register(route: { path: string; methods: readonly ['POST']; requestBody: 'buffered'; fetch(request: Request): Promise<Response> }): Dispose } }
}
const schemas = {
  state: z.strictObject({ resume: z.boolean().optional() }), models: z.strictObject({}),
  act: z.strictObject({ id: z.string().uuid(), action: z.enum(['example-seen', 'trajectory-seen', 'continue', 'restart', 'stop']) }),
}
export function apply(ctx: Host, config: { path: string }): void {
  ctx.effect(function* () {
    const story = new StoryMode(ctx, new Progress(config.path))
    yield () => story.dispose()
    for (const method of Object.keys(schemas) as (keyof typeof schemas)[]) yield ctx.connection.fetch.register({
      path: '/api/papermoon-story/' + method, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') return new Response('unsupported media type', { status: 415 })
        const envelope = z.strictObject({ type: z.literal('client-request'), rpcId: z.string(), method: z.literal('papermoon-story/' + method), payload: z.unknown() }).safeParse(await request.json().catch(() => null))
        if (!envelope.success) return new Response('invalid RPC envelope', { status: 400 })
        let result: unknown
        try {
          const payload = envelope.data.payload
          const value = await story.run(async () => {
            if (method === 'act') { const p = schemas.act.parse(payload); return story.act(p.id, p.action) }
            schemas[method].parse(payload)
            return method === 'models' ? ctx.textConversations.models() : story.state(schemas.state.parse(payload).resume)
          })
          result = { ok: true, value }
        } catch (error) { result = { ok: false, error: { code: error instanceof StoryError ? 'story/' + error.key : 'story/refused', message: error instanceof Error ? error.message : String(error), details: {} } } }
        return Response.json({ type: 'server-response', rpcId: envelope.data.rpcId, result })
      },
    })
  }, 'papermoon.story-mode')
}
