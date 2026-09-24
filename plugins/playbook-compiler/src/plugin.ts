/** Effect-owned service; removing it drains compiler jobs before releasing its repository dependency. */
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { CompilationService } from './service.ts'
import { ArtifactStore } from './store.ts'
import type { Limits } from './types.ts'
import { defaultLimits } from './index.ts'
export const name = 'papermoon-playbook-compiler'
export const inject = ['papermoonPlaybookCore']
export interface Config { directory: string; limits?: Partial<Limits>; attachmentBytes?: number }
type Dispose = () => void | Promise<void>
interface Host {
  get(key: string): unknown
  provide(key: string, value: CompilationService): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
}
export function apply(ctx: Host, config: Config): void {
  if (!config.directory?.trim()) throw new Error('compiler directory is required')
  if (config.limits && (Object.keys(config.limits).some(key => !Object.hasOwn(defaultLimits, key)) || Object.values(config.limits).some(value => !Number.isSafeInteger(value) || value < 1))) throw new Error('compiler limits must be known positive integers')
  ctx.effect(function* () {
    const service = new CompilationService(ctx.get('papermoonPlaybookCore') as PlaybookRepository, new ArtifactStore(config.directory), { limits: config.limits }, config.attachmentBytes)
    yield () => service.close()
    yield ctx.provide('papermoonPlaybookCompiler', service)
  }, 'papermoon.playbook-compiler')
}
