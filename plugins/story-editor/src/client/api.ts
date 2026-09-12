import type { Method, Params } from '../protocol.ts'
import type { Results, RpcResult } from '../service.ts'
export interface Api {
  call<M extends Method>(method: M, payload: Params<M>): Promise<Results[M]>
}
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: object = {},
  ) {
    super(message)
  }
}
export interface Connection {
  rpc: {
    call(
      channel: string,
      endpoint: string,
      payload: unknown,
      signal?: AbortSignal,
    ): Promise<RpcResult<unknown>>
  }
}
export function createApi(connection: Connection, signal: AbortSignal): Api {
  return {
    async call(method, payload) {
      const result = await connection.rpc.call(
        '/api',
        'papermoon/' + method,
        payload,
        signal,
      )
      if (!result.ok)
        throw new ApiError(
          result.error.code,
          result.error.message,
          result.error.details,
        )
      return result.value as Results[typeof method]
    },
  }
}
