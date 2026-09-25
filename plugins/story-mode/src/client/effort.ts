import type { ModelChoice, ModelInfo } from '../../../text-conversations/src/types.ts'
/** Advice never selects, validates a minimum, or blocks a request. */
export function effortAdvice(model: ModelInfo | undefined, choice: ModelChoice | undefined): 'off' | 'lowest' | 'unavailable' | undefined {
  if (!model) return undefined
  if (!model.reasoning?.efforts.length) return 'unavailable'
  if (!model.reasoning.efforts.some(effort => effort.id === 'off')) return 'lowest'
  return (choice?.reasoningEffort ?? model.reasoning.defaultEffort) === 'off' ? undefined : 'off'
}
