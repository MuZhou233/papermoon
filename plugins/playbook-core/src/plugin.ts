/** Cordis service consumer; this plugin neither creates nor closes storage connections. */
import type { PlaybookStorage } from '@papermoon/playbook-storage'
import { PlaybookRepository } from './repository.ts'
export const name = 'papermoon-playbook-core'
export const serviceKey = 'papermoonPlaybookCore'
export const inject = ['papermoonPlaybookStorage']
type Dispose = () => void | Promise<void>
export interface CoreHost {
  get(key: string): unknown
  provide(key: string, value: PlaybookRepository): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
}
export function apply(ctx: CoreHost): void {
  // Cordis resolves the declared service dependency before mounting this consumer.
  const storage = ctx.get(inject[0]!) as PlaybookStorage
  ctx.effect(function* () {
    yield ctx.provide(serviceKey, new PlaybookRepository(storage))
  }, 'papermoon.playbook-core')
}
