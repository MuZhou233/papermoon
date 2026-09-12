/** Check the emitted pure entry while Node built-ins and Cordis imports are forbidden. */
import assert from 'node:assert/strict'
import { builtinModules, registerHooks } from 'node:module'
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')))
const guard = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('node:') || builtins.has(specifier) || specifier.includes('cordis')) throw new Error(`pure entry loaded ${specifier}`)
    return next(specifier, context)
  },
})
try {
  const { createContent, applyOperations, encodeContent, decodeContent, lookupTranslation } = await import('../lib/index.js')
  const content = applyOperations(createContent({ defaultLanguage: 'zh-CN' }), [
    { kind: 'add-language', language: 'en' },
    { kind: 'create-text', key: 'empty' },
    { kind: 'set-translation', key: 'empty', language: 'zh-CN', text: '' },
  ])
  assert.deepEqual(decodeContent(encodeContent(content)), content)
  assert.deepEqual(lookupTranslation(content, 'empty', 'en'), { kind: 'missing', reason: 'translation' })
  console.log('PaperMoon core: emitted pure entry imports and content operations passed')
} finally { guard.deregister() }
