/** Saved writer definitions and literal, role-preserving context resolution. */
import { z } from 'zod'
import { encodeJson } from '@papermoon/story-storage/value'
export const DEFAULT_WRITER_PROMPT = '你是 PaperMoon 的编剧助手。'
const jsonObject = z.record(z.string(), z.json())
export const definitionSchema = z.strictObject({
  name: z.string().refine((value) => !!value.trim(), 'name must not be blank'),
  description: z.string().optional(),
  systemPrompt: z.string(),
  systemPromptName: z.string().optional(),
  messages: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        name: z.string().optional(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .refine(
      (messages) =>
        new Set(messages.map((message) => message.id)).size === messages.length,
      'message IDs must be unique',
    ),
  metadata: jsonObject.default({}),
})
export type WriterDefinition = z.output<typeof definitionSchema>
export interface Writer extends WriterDefinition {
  id: string
  sequence: number
  createdAt: string
  updatedAt: string
}
export const writerSchema = definitionSchema.extend({
  metadata: jsonObject,
  id: z.string().min(1),
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** Validate at storage/wire ingress, without implicit JSON conversion or text rewriting. */
export function parseDefinition(value: unknown): WriterDefinition {
  return definitionSchema.parse(JSON.parse(encodeJson(value)))
}
/** An unsaved starting definition; creating a template never creates a writer identity. */
export function createWriterTemplate(name: string, description?: string): WriterDefinition {
  return {
    name,
    ...(description === undefined ? {} : { description }),
    systemPrompt: DEFAULT_WRITER_PROMPT,
    messages: [],
    metadata: {},
  }
}
/** A detached value; roles and text are literal, with no template expansion or added guidance. */
export function resolveWriterContext(writer: WriterDefinition) {
  return {
    systemPrompt: writer.systemPrompt,
    messages: writer.messages.map(({ role, content }) => ({ role, content })),
  }
}
export class WriterError extends Error {
  constructor(
    readonly code:
      | 'not-found'
      | 'conflict'
      | 'format-mismatch'
      | 'corrupt'
      | 'closed'
      | 'busy'
      | 'invalid-input'
      | 'database-error',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
