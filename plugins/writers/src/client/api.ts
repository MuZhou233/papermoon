import type { Method, Params } from '../protocol.ts'
import type { Results, RpcResult } from '../service.ts'
export interface Api {
  call<M extends Method>(method: M, params: Params<M>): Promise<Results[M]>
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
        'papermoon-writers/' + method,
        payload,
        signal,
      )
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        })
      return result.value as Results[typeof method]
    },
  }
}
