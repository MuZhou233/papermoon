/** A performance owns its complete initial context independently of source storage. */
import { z } from 'zod'
import { canonical, digest, loadArtifact } from '@papermoon/story-compiler/runtime'
import type { Artifact } from '@papermoon/story-compiler/types'
import type { SessionLog } from '../../story-workspaces/src/host.ts'
import { PRESET, CONFIG_KEY, PREPARATION_KEY, PRODUCER } from './constants.ts'
const identity = z.string().min(1)
const frozenSchema = z.strictObject({ version: z.literal(3), originSessionId: identity, scriptId: identity, revisionId: identity, ordinal: z.number().int().positive(), scriptName: z.string(), projectName: z.string(), description: z.string(), attachmentKey: identity, artifact: z.unknown(), checksum: z.string().regex(/^[a-f0-9]{64}$/) })
export interface FrozenPerformance extends Omit<z.infer<typeof frozenSchema>, 'artifact'> { artifact: Artifact }
export function validateFrozen(value: unknown): FrozenPerformance {
  const result = frozenSchema.parse(value), { checksum, ...payload } = result
  if (digest(payload) !== checksum) throw new Error('performance initialization checksum does not match')
  return { ...result, artifact: loadArtifact(canonical(result.artifact)) }
}
export function performanceState(session: SessionLog): { mode?: string; scriptId?: string; fixed?: FrozenPerformance } {
  let mode = session.header.agentPreset, scriptId: string | undefined, fixed: FrozenPerformance | undefined
  for (const event of session.snapshotEvents()) {
    const data = event.data as { agentPreset?: string; key?: string; value?: unknown }
    if (event.type === 'agent-preset/selected') mode = data.agentPreset
    if (event.type === 'session/configuration' && data.key === PREPARATION_KEY) {
      scriptId = z.strictObject({ scriptId: identity }).parse(data.value).scriptId
    }
    if (event.type === 'session/configuration' && data.key === CONFIG_KEY) {
      const candidate = validateFrozen(data.value)
      if (fixed && canonical(candidate) !== canonical(fixed)) throw new Error('performance initialization changed')
      fixed = candidate
    }
  }
  if (fixed && (mode !== PRESET || scriptId !== fixed.scriptId)) throw new Error('performance source or mode changed')
  if (!fixed && mode === PRESET && session.snapshotEvents().some(event => event.type === 'user/message' || event.type === 'agent/inbox/spliced'))
    throw new Error('performance initialization is missing')
  return { mode, scriptId, fixed }
}
export function openingMessages(fixed: FrozenPerformance) {
  return fixed.artifact.context.messages.map((entry, index) => ({ index, groupId: `papermoon.performance:${fixed.originSessionId}`, ...(entry.name === undefined ? {} : { name: entry.name }),
    message: { id: `papermoon.performance:${fixed.originSessionId}:${index}`, role: entry.role, content: [{ type: 'text' as const, text: entry.content }], source: { kind: 'plugin' as const, plugin: PRODUCER } },
  }))
}
