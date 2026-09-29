/** Shared operation scopes; product plugins supply policies for their managed Playbooks. */
import type { ContentOperation, JsonObject, PlaybookContent } from './model.ts'
export const capabilities = ['system.read', 'system.write', 'opening.read', 'opening.write', 'program.read', 'program.write', 'texts.read', 'texts.write', 'metadata', 'history', 'restore', 'copy', 'modes', 'compile', 'commit', 'performance', 'model', 'effort'] as const
export type Capability = typeof capabilities[number]
export interface ManagedState { policy: string; binding: string; state: JsonObject }
export interface PlaybookPolicy {
  authorize?(value: ManagedState, operation: string, input: JsonObject): void
  capabilities(value: ManagedState): readonly Capability[]
  presentation?(value: ManagedState): { label: { en: string; zh: string }; position: string; completed: boolean }
  saved?(value: ManagedState, operations: readonly ContentOperation[]): JsonObject
}
export function operationCapability(operation: ContentOperation): Capability {
  if (operation.kind === 'set-system-prompt') return 'system.write'
  if (operation.kind === 'set-opening-messages') return 'opening.write'
  if (operation.kind === 'set-authoring-mode') return 'modes'
  if (operation.kind === 'set-metadata') return 'metadata'
  return operation.kind.endsWith('-file') ? 'program.write' : 'texts.write'
}
/** Redaction produces a detached view with empty, valid components for unavailable scopes. */
export function projectContent(content: PlaybookContent, allowed: readonly Capability[]): PlaybookContent {
  const has = (scope: Capability) => allowed.includes(scope)
  return { ...content,
    metadata: has('metadata') ? content.metadata : {},
    systemPrompt: has('system.read') ? content.systemPrompt : { mode: 'plain', text: '' },
    opening: has('opening.read') ? content.opening : { mode: 'plain', messages: [] },
    program: has('program.read') ? content.program : { metadata: {}, files: new Map() },
    texts: has('texts.read') ? content.texts : { metadata: {}, defaultLanguage: 'und', languages: new Map([['und', { id: 'und', metadata: {} }]]), entries: new Map() },
  }
}
