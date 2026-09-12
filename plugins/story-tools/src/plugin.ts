/** Register only into a caller-owned scope; the default Web profile never invokes this adapter. */
import type { StoryRepository } from '@papermoon/story-core/repository'
import type { ScriptId } from '@papermoon/story-core'
import { createStoryTools, type StoryObservations } from './index.ts'
export interface ToolHost {
  effect(body: () => () => void, label?: string): unknown
  tools: {
    register(
      definition: ReturnType<typeof createStoryTools>[number],
    ): () => void
  }
}
/** The caller supplies an isolated scope and owns the returned disposer. */
export function registerStoryTools(
  scope: ToolHost,
  repository: StoryRepository,
  scriptId: ScriptId,
  observations?: StoryObservations,
): () => void {
  const disposers: (() => void)[] = []
  const dispose = () => {
    for (const remove of disposers.splice(0).reverse()) remove()
  }
  try {
    for (const tool of createStoryTools(repository, scriptId, observations)) {
      scope.effect(() => {
        const remove = scope.tools.register(tool)
        disposers.push(remove)
        return remove
      }, `papermoon.tool.${tool.name}`)
    }
  } catch (error) {
    dispose()
    throw error
  }
  return dispose
}
