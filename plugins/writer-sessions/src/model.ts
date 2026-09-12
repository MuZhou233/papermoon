/** Durable writer selection and accepted configuration; no runtime or database imports. */
import { z } from 'zod'
import { writerSchema, type Writer } from '@papermoon/writers'
export const PRESET = 'papermoon-writer'
export const CONFIG_KEY = 'papermoon.writer'
export const TARGET_PROVIDER = 'papermoon-script'
export const preparationSchema = z.strictObject({
  version: z.literal(1), scriptId: z.string().min(1),
  writer: z.strictObject({ id: z.string().min(1), sequence: z.number().int().nonnegative() }).optional(),
})
export type Preparation = z.infer<typeof preparationSchema>
export const fixedSchema = z.strictObject({ version: z.literal(1), originSessionId: z.string().min(1), scriptId: z.string().min(1), writer: writerSchema })
export type FixedWriter = z.infer<typeof fixedSchema>
export interface LogRecord { type: string; data: unknown }
export interface SessionLog { header: { agentPreset?: string }; snapshotEvents(): readonly LogRecord[] }
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
/** Read accepted inbox facts even when the message was later canceled or not yet executed. */
export function writerState(session: SessionLog): { mode: string | undefined; preparation?: Preparation; fixed?: FixedWriter } {
  let mode = session.header.agentPreset, preparation: Preparation | undefined, fixed: FixedWriter | undefined
  for (const event of session.snapshotEvents()) {
    const data = record(event.data)
    if (event.type === 'agent-preset/selected' && typeof data?.agentPreset === 'string') mode = data.agentPreset
    if (event.type === 'session/configuration' && data?.key === CONFIG_KEY)
      preparation = data.value === null ? undefined : preparationSchema.parse(data.value)
    const messages = event.type === 'agent/inbox/spliced' && Array.isArray(data?.inserted) ? data.inserted : event.type === 'user/message' ? [event.data] : []
    for (const message of messages) {
      const source = record(record(message)?.source)
      const admission = record(source?.admission)
      if (source?.kind === 'user' && admission?.[CONFIG_KEY] !== undefined) {
        const candidate = fixedSchema.parse(admission[CONFIG_KEY])
        if (fixed === undefined) fixed = candidate
        else if (JSON.stringify(fixed) !== JSON.stringify(candidate)) throw new WriterSessionError('corrupt', 'accepted writer configuration changed')
      }
    }
  }
  if (fixed && mode !== PRESET) throw new WriterSessionError('corrupt', 'accepted writer mode changed')
  return { mode, ...(preparation ? { preparation } : {}), ...(fixed ? { fixed } : {}) }
}
/** Keep one literal message per configured entry; names and source never enter the body. */
export function initialContext(sessionId: string, writer: Writer) {
  return writer.messages.map((entry, index) => ({
    index,
    groupId: `papermoon.writer:${writer.id}:${writer.sequence}`,
    ...(entry.name === undefined ? {} : { name: entry.name }),
    message: {
      id: `papermoon.writer:${sessionId}:${entry.id}`,
      role: entry.role,
      content: [{ type: 'text' as const, text: entry.content }],
      source: { kind: 'plugin' as const, plugin: 'papermoon-writer-context' },
    },
  }))
}
export class WriterSessionError extends Error {
  constructor(readonly code: 'unconfigured' | 'locked' | 'conflict' | 'target-missing' | 'wrong-mode' | 'corrupt' | 'unavailable', message: string) { super(message) }
}
