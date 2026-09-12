/** Cordis service consumer; this plugin neither creates nor closes storage connections. */
import type { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from './repository.ts'
export const name = 'papermoon-story-core'
export const serviceKey = 'papermoonStoryCore'
export const inject = ['papermoonStoryStorage']
type Dispose = () => void | Promise<void>
export interface CoreHost {
  get(key: string): unknown
  provide(key: string, value: StoryRepository): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
}
export function apply(ctx: CoreHost): void {
  // Cordis resolves the declared service dependency before mounting this consumer.
  const storage = ctx.get(inject[0]!) as StoryStorage
  ctx.effect(function* () {
    yield ctx.provide(serviceKey, new StoryRepository(storage))
  }, 'papermoon.story-core')
}
