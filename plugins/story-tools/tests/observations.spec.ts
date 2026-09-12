import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from '@papermoon/story-core/repository'
import { createStoryTools, StoryObservations } from '../src/index.ts'
import type { ToolName } from '../src/catalog.ts'
const cleanup: (() => void)[] = []
afterEach(() => { for (const dispose of cleanup.splice(0).reverse()) dispose() })
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'writer-observations-'))
  const storage = new StoryStorage({ path: join(dir, 'story.sqlite') })
  cleanup.push(() => { storage.close(); rmSync(dir, { recursive: true, force: true }) })
  const repository = new StoryRepository(storage)
  const project = repository.createProject({ name: 'Project' })
  const script = repository.createScript({ projectId: project.id, name: 'Script', defaultLanguage: 'en' })
  repository.editDraft({ scriptId: script.id, expectedSequence: 0, operations: [
    { kind: 'create-file', path: 'main.js', source: 'first' },
    { kind: 'create-text', key: 'welcome' },
    { kind: 'set-translation', key: 'welcome', language: 'en', text: 'Hello' },
  ] })
  const session = () => {
    const tools = createStoryTools(repository, script.id, new StoryObservations())
    return (name: ToolName, args: unknown, signal = new AbortController().signal) => tools.find(tool => tool.name === name)!.execute(args, { signal })
  }
  const edit = (source: string, expectedSequence: number) => repository.editDraft({ scriptId: script.id, expectedSequence, operations: [{ kind: 'replace-file', path: 'main.js', source }] })
  return { repository, script, session, edit }
}
test('only a current complete read in the same session authorizes an existing file', async () => {
  const { repository, script, session } = setup(), a = session(), b = session()
  const change = { expectedSequence: 1, operations: [{ kind: 'replace-file', path: 'main.js', source: 'second' }] }
  repository.readFile({ kind: 'draft', scriptId: script.id }, 'main.js')
  await a('story_status', {}); await a('story_program_list', {}); await a('story_program_search', { query: 'first' })
  await expect(a('story_program_edit', change)).rejects.toThrow(/not-observed/)
  await a('story_program_read', { path: 'main.js' })
  await expect(b('story_program_edit', change)).rejects.toThrow(/not-observed/)
  await a('story_program_edit', change)
  await a('story_program_edit', { ...change, expectedSequence: 2 })
})
test('refreshing the draft sequence does not refresh a stale file observation', async () => {
  const { session, edit } = setup(), call = session()
  await call('story_program_read', { path: 'main.js' }); edit('human', 1)
  await call('story_status', {})
  await expect(call('story_program_edit', { expectedSequence: 2, operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/observation-stale/)
  await call('story_program_read', { path: 'main.js' })
  await call('story_program_edit', { expectedSequence: 2, operations: [{ kind: 'delete-file', path: 'main.js' }] })
})
test('failed and canceled batches grant no observations and leave no partial files', async () => {
  const { session, repository, script } = setup(), call = session()
  const operations = [{ kind: 'create-file', path: 'new.js', source: '' }, { kind: 'delete-file', path: 'main.js' }]
  await expect(call('story_program_edit', { expectedSequence: 1, operations })).rejects.toThrow(/not-observed/)
  expect(repository.readSnapshot({ kind: 'draft', scriptId: script.id }).content.program.files.has('new.js')).toBe(false)
  await expect(call('story_program_read', { path: 'main.js' }, AbortSignal.abort())).rejects.toThrow()
  await expect(call('story_program_edit', { expectedSequence: 1, operations: [operations[1]] })).rejects.toThrow(/not-observed/)
  await call('story_program_edit', { expectedSequence: 1, operations: [{ kind: 'create-file', path: 'new.js', source: '' }, { kind: 'replace-file', path: 'new.js', source: 'new' }] })
})
test('translation reads grant only the returned language, complete entry reads grant entry edits', async () => {
  const { session } = setup(), call = session()
  await call('story_text_read', { key: 'welcome', language: 'en' })
  await call('story_text_edit', { expectedSequence: 1, operations: [{ kind: 'set-translation', key: 'welcome', language: 'en', text: 'Hi' }] })
  await expect(call('story_text_edit', { expectedSequence: 2, operations: [{ kind: 'delete-text', key: 'welcome' }] })).rejects.toThrow(/not-observed/)
  await call('story_text_read', { key: 'welcome' })
  await call('story_text_edit', { expectedSequence: 2, operations: [{ kind: 'set-translation', key: 'welcome', language: 'en', text: 'Hello again' }] })
  await call('story_text_edit', { expectedSequence: 3, operations: [{ kind: 'rename-text', key: 'welcome', to: 'greeting' }] })
})
test('historical reads do not grant draft authority, explicit restore invalidates observations', async () => {
  const { repository, script, session } = setup(), call = session()
  const revision = repository.commitRevision({ scriptId: script.id, expectedSequence: 1, description: 'First' }).revision
  await call('story_program_read', { path: 'main.js', ref: { kind: 'revision', revisionId: revision.id } })
  await expect(call('story_program_edit', { expectedSequence: 2, operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/not-observed/)
  await call('story_program_read', { path: 'main.js' })
  await call('story_restore', { expectedSequence: 2, revisionId: revision.id, selection: { kind: 'all' } })
  await expect(call('story_program_edit', { expectedSequence: 3, operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/not-observed/)
})
