/** Cordis adapter. The core never imports DSH or owns an Agent/Session. */
import { PlaybookStorage } from './storage.ts'

export const name = 'papermoon-playbook-storage'
export const serviceKey = 'papermoonPlaybookStorage'
export interface Config { path: string }
type Dispose = () => void | Promise<void>
/** Only public host methods used here; checked against real Cordis separately. */
export interface StorageHost {
  provide(key: string, value: PlaybookStorage): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
}
/** Yield both disposers into one effect: unregister and drain consumers before closing. */
export function apply(ctx: StorageHost, config: Config): void {
  ctx.effect(function* () {
    const storage = new PlaybookStorage(config)
    yield () => storage.close()
    yield ctx.provide(serviceKey, storage)
  }, 'papermoon.playbook-storage')
}
