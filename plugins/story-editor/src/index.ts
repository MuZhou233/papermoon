/** Exact routes use DSH's existing authenticated API carrier. */
import type { StoryRepository } from '@papermoon/story-core/repository'
import { z } from 'zod'
import { dispatcher } from './service.ts'
import { schemas } from './protocol.ts'
export const name = 'papermoon-story-editor'
export const inject = ['papermoonStoryCore', 'connection']
export interface EditorHost {
  get(key: string): unknown
  effect(body: () => () => void | Promise<void>, label?: string): unknown
  connection: {
    fetch: {
      register(route: {
        path: string
        methods: readonly 'POST'[]
        requestBody: 'buffered'
        fetch: (request: Request) => Promise<Response>
      }): () => Promise<void>
    }
  }
}
const envelope = z.strictObject({
  type: z.literal('client-request'),
  rpcId: z.string().min(1),
  method: z.string(),
  payload: z.unknown(),
})
export function apply(ctx: EditorHost): void {
  const dispatch = dispatcher(
    ctx.get('papermoonStoryCore') as StoryRepository,
    (error) => console.error('[PaperMoon editor]', error),
  )
  for (const method of Object.keys(schemas))
    ctx.effect(
      () =>
        ctx.connection.fetch.register({
          path: '/api/papermoon/' + method,
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
            if (!parsed.success || parsed.data.method !== 'papermoon/' + method)
              return new Response('invalid RPC envelope', { status: 400 })
            const result = await dispatch(
              method,
              parsed.data.payload,
              request.signal,
            )
            return Response.json({
              type: 'server-response',
              rpcId: parsed.data.rpcId,
              result,
            })
          },
        }),
      'papermoon.editor.' + method,
    )
}
