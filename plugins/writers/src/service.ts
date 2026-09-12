import { z } from 'zod'
import { toolCatalog } from '@papermoon/story-tools/catalog'
import type { WriterRepository } from './repository.ts'
import { WriterError, resolveWriterContext, type Writer } from './model.ts'
import { schemas, type Method } from './protocol.ts'
export interface Results {
  list: Writer[]
  get: Writer
  create: Writer
  update: Writer
  copy: Writer
  delete: null
  context: ReturnType<typeof resolveWriterContext>
  catalog: ReturnType<typeof toolCatalog>
}
export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: object } }
export function createDispatcher(
  repository: WriterRepository,
  report: (error: unknown) => void,
) {
  return async <M extends Method>(
    method: M,
    raw: unknown,
    signal: AbortSignal,
  ): Promise<RpcResult<Results[M]>> => {
    try {
      signal.throwIfAborted()
      let value: Results[Method]
      switch (method) {
        case 'list':
          schemas.list.parse(raw)
          value = repository.list()
          break
        case 'get':
          value = repository.get(schemas.get.parse(raw).id)
          break
        case 'create':
          value = repository.create(schemas.create.parse(raw))
          break
        case 'update': {
          const a = schemas.update.parse(raw)
          value = repository.update(a.id, a.expectedSequence, a.definition)
          break
        }
        case 'copy': {
          const a = schemas.copy.parse(raw)
          value = repository.copy(a.id, { name: a.name, description: a.description })
          break
        }
        case 'delete': {
          const a = schemas.delete.parse(raw)
          repository.delete(a.id, a.expectedSequence)
          value = null
          break
        }
        case 'context':
          value = resolveWriterContext(
            repository.get(schemas.context.parse(raw).id),
          )
          break
        case 'catalog':
          schemas.catalog.parse(raw)
          value = toolCatalog()
          break
      }
      return { ok: true, value: value as Results[M] }
    } catch (error) {
      if (error instanceof z.ZodError)
        return {
          ok: false,
          error: { code: 'invalid-input', message: error.message, details: {} },
        }
      if (error instanceof WriterError)
        return {
          ok: false,
          error: { code: error.code, message: error.message, details: {} },
        }
      if (signal.aborted)
        return {
          ok: false,
          error: {
            code: 'cancelled',
            message: 'request cancelled',
            details: {},
          },
        }
      report(error)
      return {
        ok: false,
        error: {
          code: 'internal',
          message: 'writer operation failed',
          details: {},
        },
      }
    }
  }
}
