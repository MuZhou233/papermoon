/** Settings service and authenticated management routes, with no Agent composition. */
import { z } from 'zod'
import { WriterRepository } from './repository.ts'
import { createDispatcher } from './service.ts'
import { schemas, type Method } from './protocol.ts'
export const name = 'papermoon-writers'
export const inject = ['connection']
export interface Config {
  path: string
}
type Dispose = () => void | Promise<void>
export interface WriterHost {
  provide(key: string, service: WriterRepository): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
  connection: {
    fetch: {
      register(route: {
        path: string
        methods: readonly 'POST'[]
        requestBody: 'buffered'
        fetch(request: Request): Promise<Response>
      }): Dispose
    }
  }
}
const envelope = z.strictObject({
  type: z.literal('client-request'),
  rpcId: z.string().min(1),
  method: z.string(),
  payload: z.unknown(),
})
export function apply(ctx: WriterHost, config: Config): void {
  ctx.effect(function* () {
    const repository = new WriterRepository(config)
    yield () => repository.close()
    yield ctx.provide('papermoonWriters', repository)
    const dispatch = createDispatcher(repository, (error) =>
      console.error('[PaperMoon writers]', error),
    )
    for (const method of Object.keys(schemas) as Method[])
      yield ctx.connection.fetch.register({
        path: '/api/papermoon-writers/' + method,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
          if (
            request.headers.get('content-type')?.split(';')[0]?.trim() !==
            'application/json'
          )
            return new Response('unsupported media type', { status: 415 })
          let raw: unknown
          try {
            raw = await request.json()
          } catch {
            return new Response('invalid JSON', { status: 400 })
          }
          const parsed = envelope.safeParse(raw)
          if (
            !parsed.success ||
            parsed.data.method !== 'papermoon-writers/' + method
          )
            return new Response('invalid RPC envelope', { status: 400 })
          return Response.json({
            type: 'server-response',
            rpcId: parsed.data.rpcId,
            result: await dispatch(method, parsed.data.payload, request.signal),
          })
        },
      })
  }, 'papermoon.writers')
}
