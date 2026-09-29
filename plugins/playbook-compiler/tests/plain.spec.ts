import { afterEach, beforeEach, expect, test } from 'vitest'
import { applyOperations, createContent, decodeContent, encodeContent } from '@papermoon/playbook-core'
import { PlaybookCompiler } from '../src/index.ts'
let compiler: PlaybookCompiler
beforeEach(() => { compiler = new PlaybookCompiler() })
afterEach(() => compiler.close())
test('plain text preserves role order and literal markup without evaluating inactive scripts', async () => {
  const content = applyOperations(createContent({ defaultLanguage: 'en' }), [
    { kind: 'set-system-prompt', text: '# Keeper\r\n<identity>{{literal}}' },
    { kind: 'set-opening-messages', messages: [{ id: 'a', role: 'assistant', content: '<incomplete\n' }, { id: 'b', role: 'assistant', content: '${also literal}' }, { id: 'c', role: 'user', content: '' }] },
    { kind: 'create-file', path: 'playbook.js', source: 'throw new Error("inactive")' },
  ])
  expect(decodeContent(encodeContent(content))).toEqual(content)
  const result = await compiler.compile(content)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('preparation failed')
  expect(result.artifact.compiler).toBe('papermoon.playbook.plain')
  expect(result.artifact.context).toEqual({ systemPrompt: content.systemPrompt.text, messages: content.opening.messages.map(({ role, content }) => ({ role, content })) })
})
test.each([['plain', 'script'], ['script', 'plain']] as const)('mixed %s/%s selects components independently and retains inactive text', async (system, opening) => {
  const content = applyOperations(createContent({ defaultLanguage: 'en', systemMode: system, openingMode: opening }), [
    { kind: 'set-system-prompt', text: 'literal system' }, { kind: 'set-opening-messages', messages: [{ id: 'a', role: 'user', content: 'literal opening' }] },
    { kind: 'create-file', path: 'playbook.js', source: 'module.exports={systemPrompt:"script system",messages:[{role:"assistant",content:"script opening"}]}' },
  ])
  const result = await compiler.compile(content)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  expect(result.artifact.context.systemPrompt).toBe(system === 'plain' ? 'literal system' : 'script system')
  expect(result.artifact.context.messages[0]!.content).toBe(opening === 'plain' ? 'literal opening' : 'script opening')
  const switched = applyOperations(content, [{ kind: 'set-authoring-mode', target: 'systemPrompt', mode: 'plain' }, { kind: 'set-authoring-mode', target: 'opening', mode: 'plain' }])
  expect(switched.systemPrompt.text).toBe('literal system'); expect(switched.opening.messages[0]!.id).toBe('a')
})
