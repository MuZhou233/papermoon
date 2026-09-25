/** Deterministic model routes for the real hosted Web application. */
import { LlmAdapter } from '../../../dsh/packages/llm/llm/lib/index.js'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
export const inject = ['llm']
export function apply(ctx) {
  class Adapter extends LlmAdapter {
    async listModels(provider) {
      const path = join(process.env.PAPERMOON_DATA_DIR, 'availability')
      const availability = existsSync(path) ? readFileSync(path, 'utf8') : 'ready'
      if (availability === 'error') throw new Error('Fixture model discovery failed')
      if (availability === 'missing') return []
      return ['off-model', 'low-model', 'plain-model'].map(id => ({ provider, id, name: id })) }
    async resolveModel(provider, id) {
      return { provider, id, name: id, ...(id === 'plain-model' ? {} : { reasoning: { efforts: (id === 'off-model' ? ['off', 'high'] : ['low', 'high']).map(id => ({ id, name: id })) } }) }
    }
    async *stream(options) {
      appendFileSync(join(process.env.PAPERMOON_DATA_DIR, 'requests.jsonl'), JSON.stringify(options) + '\n')
      const text = options.messages.at(-1)?.content.find(block => block.type === 'text')?.text
      if (text === 'fail') throw new Error('Fixture request failed')
      if (text === 'wait') await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 60_000)
        options.signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('Fixture cancelled')) }, { once: true })
      })
      options.signal?.throwIfAborted()
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello from the fixture.' } }
      yield { type: 'finish', reason: { kind: 'stop' }, usage: { inputTokens: 8, outputTokens: 6 } }
    }
  }
  ctx.llm.registerAdapter(['story-fixture'], new Adapter())
}
