/** Runtime-only entry checks reject accidental compiler execution dependencies. */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
const guard = registerHooks({ resolve(specifier, context, next) {
  if (['node:sqlite', 'typescript'].includes(specifier) || specifier.endsWith('/story-compiler/lib/index.js') || specifier === '@papermoon/story-compiler' || specifier === '@papermoon/story-compiler/service' || specifier.endsWith('/jsdoc.js')) throw new Error('performance imported execution service: ' + specifier)
  return next(specifier, context)
} })
try {
  const { Performances } = await import('../lib/index.js')
  const { RevisionArtifacts } = await import('../../story-compiler/lib/revisions.js')
  const { createArtifact } = await import('../../story-compiler/lib/runtime.js')
  const artifact = createArtifact('0'.repeat(64), { entry: 'story.js', language: 'en', limits: { inputBytes: 1, modules: 1, outputBytes: 1000, executionMs: 1, totalMs: 1, concurrency: 1, memoryMb: 1 } }, { context: { systemPrompt: 'Frozen', messages: [] }, state: { initial: {}, schema: { type: 'object' } }, functions: [], composition: null, program: { files: { 'story.js': '' }, texts: {} } })
  const revision = { attachments: { metadata: { compilation: { format: 'papermoon.compilation', version: 1, status: 'success', sourceHash: artifact.sourceHash, targets: [{ entry: 'story.js', language: 'en', diagnostics: [], attachmentKey: 'opening/0' }] } }, items: [{ key: 'opening/0' }] } }
  const reader = new RevisionArtifacts({ getHistoryEntry() { return { revision } }, readRevisionAttachment() { return { value: artifact, metadata: { artifactId: artifact.id } } } })
  assert.equal(reader.preview('script', 'revision', 'opening/0').systemPrompt, 'Frozen')
  assert.equal(typeof Performances, 'function')
  console.log('PaperMoon: performance imports and frozen artifact reads passed with compiler execution blocked')
} finally { guard.deregister() }
