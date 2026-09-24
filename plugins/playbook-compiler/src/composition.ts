/** Validates request-local plans without loading a compiler or a database. */
import type { CompositionInput, CompositionPlan } from './types.ts'
function invalid(field: string, message: string): never { throw Object.assign(new Error(message), { code: 'invalid-context', field }) }
function record(value: unknown, fields: readonly string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field, 'expected an object')
  for (const key of Object.keys(value)) if (!fields.includes(key)) invalid(field + '.' + key, 'unknown field')
  return value as Record<string, unknown>
}
/** Validate the entire plan before any source expansion or model dispatch. */
export function validateComposition(value: unknown, input: CompositionInput): asserts value is CompositionPlan {
  const plan = record(value, ['systemPrompt', 'systemPromptName', 'messages'], 'composeContext')
  if (typeof plan.systemPrompt !== 'string' || (plan.systemPromptName !== undefined && typeof plan.systemPromptName !== 'string')) invalid('composeContext.systemPrompt', 'expected a string')
  if (!Array.isArray(plan.messages)) invalid('composeContext.messages', 'expected an array')
  const allowed = new Set([input.input.id, ...input.opening.messages.map(m => m.id), ...input.history.flatMap(n => n.blocks.map(b => b.id))])
  const seen = new Set<string>()
  for (const [index, value] of plan.messages.entries()) {
    const field = 'composeContext.messages.' + index
    const item = record(value, ['ref', 'role', 'name', 'content'], field)
    if (Object.hasOwn(item, 'ref')) {
      if (Object.keys(item).length !== 1 || typeof item.ref !== 'string' || !allowed.has(item.ref)) invalid(field + '.ref', 'reference is not available in this worldline')
      if (seen.has(item.ref)) invalid(field + '.ref', 'reference is repeated')
      seen.add(item.ref)
    } else if ((item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string' || (item.name !== undefined && typeof item.name !== 'string')) invalid(field, 'expected a user or assistant text message')
  }
  if (!seen.has(input.input.id)) invalid('composeContext.messages', 'the current input must be referenced exactly once')
}
/** Explicit whole-history policy used when a playbook has no composition function. */
export function defaultComposition(input: CompositionInput): CompositionPlan {
  return { systemPrompt: input.opening.systemPrompt, ...(input.opening.systemPromptName === undefined ? {} : { systemPromptName: input.opening.systemPromptName }), messages: [
    ...input.opening.messages.map(message => ({ ref: message.id })),
    ...input.history.flatMap(node => node.blocks.map(block => ({ ref: block.id }))), { ref: input.input.id },
  ] }
}
