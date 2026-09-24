/** Register only into a caller-owned scope; the default Web profile never invokes this adapter. */
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import type { PlaybookId } from '@papermoon/playbook-core'
import type { CompilationService } from '@papermoon/playbook-compiler/service'
import { createPlaybookTools, type PlaybookObservations } from './index.ts'
export interface NativeTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: { schema: object; render(args: unknown, value: import('@papermoon/playbook-core').JsonValue): { type: 'text'; text: string }[] }
  execute(args: unknown, exec: { callId: string; signal: AbortSignal }): Promise<unknown>
  isConcurrencySafe?(args: unknown): boolean
}
export interface ToolHost {
  effect(body: () => () => void, label?: string): unknown
  tools: {
    register(
      definition: NativeTool,
    ): () => void
  }
}
/** The caller supplies an isolated scope and owns the returned disposer. */
export function registerPlaybookTools(
  scope: ToolHost,
  repository: PlaybookRepository,
  playbookId: PlaybookId,
  observations?: PlaybookObservations,
  compiler?: CompilationService,
): () => void {
  const disposers: (() => void)[] = []
  const dispose = () => {
    for (const remove of disposers.splice(0).reverse()) remove()
  }
  try {
    for (const tool of createPlaybookTools(repository, playbookId, observations, compiler)) {
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
