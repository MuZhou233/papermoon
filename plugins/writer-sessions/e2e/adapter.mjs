/** Deterministic, test-owned adapter. Requests are written only to the fixture data directory. */
import { LlmAdapter, ToolCallId } from '../../../dsh/packages/llm/llm/lib/index.js'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
export const inject = ['llm']
export function apply(ctx) {
  class Adapter extends LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'fixture', name: 'Fixture model' }] }
    async *stream(options) {
      options.signal?.throwIfAborted()
      appendFileSync(join(process.env.PAPERMOON_DATA_DIR, 'requests.jsonl'), JSON.stringify(options) + '\n')
      const hasResult = options.messages.some(message => message.content.some(block => block.type === 'tool-result'))
      if (!hasResult && options.tools?.some(tool => tool.name === 'increment')) {
        yield { type: 'block-start', index: 0, blockType: 'reasoning' }
        yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'Fixture intermediate reasoning.' } }
        yield { type: 'block-start', index: 1, blockType: 'text' }
        yield { type: 'block-end', index: 1, block: { type: 'text', text: 'Fixture intermediate reply.' } }
        yield { type: 'block-start', index: 2, blockType: 'tool-call' }
        yield { type: 'block-end', index: 2, block: { type: 'tool-call', id: ToolCallId('fixture-increment'), name: 'increment', arguments: '{"amount":3}' } }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      } else if (!hasResult && options.tools?.some(tool => tool.name === 'story_status')) {
        yield { type: 'block-start', index: 0, blockType: 'tool-call' }
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('fixture-status'), name: 'story_status', arguments: '{}' } }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      } else {
        yield { type: 'block-start', index: 0, blockType: 'reasoning' }
        yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'Fixture reasoning.' } }
        yield { type: 'block-start', index: 1, blockType: 'text' }
        yield { type: 'block-end', index: 1, block: { type: 'text', text: 'Fixture reply.' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['writer-fixture'], new Adapter()))
}
