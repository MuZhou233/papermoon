/** Prepared read-only Session seed; no inference is performed. */
import type { EventRecord } from '../../text-conversations/src/types.ts'
export const prompt = 'You are a helpful assistant'
const user = { id: 'example-user', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } }
const assistant = { id: 'example-assistant', role: 'assistant', content: [{ type: 'text', text: 'Hi! How can I help you today?' }], source: { kind: 'model', provider: 'example', model: 'example' } }
const system = { id: 'example-system', role: 'system', content: [{ type: 'text', text: prompt }], source: { kind: 'system-prompt' } }
// Zero timestamps deliberately carry no simulated request duration or token usage.
export const exampleEvents: readonly EventRecord[] = [
  { type: 'turn/start', data: { turn: 1 } },
  { type: 'step/start', data: { turn: 1, step: 1 } },
  { type: 'system/message', surfaceOp: 'append', data: { turn: 1, step: 1, message: system } },
  { type: 'user/message', surfaceOp: 'append', data: user },
  { type: 'request/header', data: { reason: 'initial', header: { config: { provider: 'example', model: 'example' } } } },
  { type: 'request/messages', data: { version: 1, turn: 1, step: 1, messages: null } },
  { type: 'assistant/message', surfaceOp: 'append', data: { turn: 1, step: 1, message: assistant, stream: [], reason: { kind: 'stop' } } },
  { type: 'step/end', data: { turn: 1, step: 1 } },
  { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
].map((event, seq) => ({ ...event, seq, time: 0 }))
