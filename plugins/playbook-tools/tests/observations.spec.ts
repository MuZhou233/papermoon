import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlaybookStorage } from '@papermoon/playbook-storage'
import { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { createPlaybookTools, PlaybookObservations } from '../src/index.ts'
import type { ToolName } from '../src/catalog.ts'
const cleanup: (() => void)[] = []
afterEach(() => { for (const dispose of cleanup.splice(0).reverse()) dispose() })
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'writer-observations-'))
  const storage = new PlaybookStorage({ path: join(dir, 'playbook.sqlite') })
  cleanup.push(() => { storage.close(); rmSync(dir, { recursive: true, force: true }) })
  const repository = new PlaybookRepository(storage)
  const project = repository.createProject({ name: 'Project' })
  const playbook = repository.createPlaybook({ projectId: project.id, name: 'Playbook', defaultLanguage: 'en' })
  repository.editDraft({ playbookId: playbook.id, expectedSequence: 0, operations: [
    { kind: 'create-file', path: 'main.js', source: 'first' },
    { kind: 'create-text', key: 'welcome' },
    { kind: 'set-translation', key: 'welcome', language: 'en', text: 'Hello' },
  ] })
  const session = () => {
    const tools = createPlaybookTools(repository, playbook.id, new PlaybookObservations())
    return (name: ToolName, args: unknown, signal = new AbortController().signal) => tools.find(tool => tool.name === name)!.execute(args, { signal })
  }
  const edit = (source: string, expectedSequence: number) => repository.editDraft({ playbookId: playbook.id, expectedSequence, operations: [{ kind: 'replace-file', path: 'main.js', source }] })
  return { repository, playbook, session, edit }
}
test('only a current complete read in the same session authorizes an existing file', async () => {
  const { repository, playbook, session } = setup(), a = session(), b = session()
  const change = { operations: [{ kind: 'replace-file', path: 'main.js', source: 'second' }] }
  repository.readFile({ kind: 'draft', playbookId: playbook.id }, 'main.js')
  await a('playbook_status', {}); await a('playbook_program_list', {}); await a('playbook_program_search', { query: 'first' })
  await expect(a('playbook_program_edit', change)).rejects.toThrow(/not-observed/)
  await a('playbook_program_read', { path: 'main.js' })
  await expect(b('playbook_program_edit', change)).rejects.toThrow(/not-observed/)
  await a('playbook_program_edit', change)
  await a('playbook_program_edit', change)
})
test('status does not refresh a stale file observation', async () => {
  const { session, edit } = setup(), call = session()
  await call('playbook_program_read', { path: 'main.js' }); edit('human', 1)
  await call('playbook_status', {})
  await expect(call('playbook_program_edit', { operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/observation-stale/)
  await call('playbook_program_read', { path: 'main.js' })
  await call('playbook_program_edit', { operations: [{ kind: 'delete-file', path: 'main.js' }] })
})
test('failed and canceled batches grant no observations and leave no partial files', async () => {
  const { session, repository, playbook } = setup(), call = session()
  const operations = [{ kind: 'create-file', path: 'new.js', source: '' }, { kind: 'delete-file', path: 'main.js' }]
  await expect(call('playbook_program_edit', { operations })).rejects.toThrow(/not-observed/)
  expect(repository.readSnapshot({ kind: 'draft', playbookId: playbook.id }).content.program.files.has('new.js')).toBe(false)
  await expect(call('playbook_program_read', { path: 'main.js' }, AbortSignal.abort())).rejects.toThrow()
  await expect(call('playbook_program_edit', { operations: [operations[1]] })).rejects.toThrow(/not-observed/)
  await call('playbook_program_edit', { operations: [{ kind: 'create-file', path: 'new.js', source: '' }, { kind: 'replace-file', path: 'new.js', source: 'new' }] })
})
test('translation reads grant only the returned language, complete entry reads grant entry edits', async () => {
  const { session } = setup(), call = session()
  await call('playbook_text_read', { key: 'welcome', language: 'en' })
  await call('playbook_text_edit', { operations: [{ kind: 'set-translation', key: 'welcome', language: 'en', text: 'Hi' }] })
  await expect(call('playbook_text_edit', { operations: [{ kind: 'delete-text', key: 'welcome' }] })).rejects.toThrow(/not-observed/)
  await call('playbook_text_read', { key: 'welcome' })
  await call('playbook_text_edit', { operations: [{ kind: 'set-translation', key: 'welcome', language: 'en', text: 'Hello again' }] })
  await call('playbook_text_edit', { operations: [{ kind: 'rename-text', key: 'welcome', to: 'greeting' }] })
})
test('historical reads do not grant draft authority, explicit restore invalidates observations', async () => {
  const { repository, playbook, session } = setup(), call = session()
  const revision = repository.commitRevision({ playbookId: playbook.id, expectedSequence: 1, description: 'First' }).revision
  await call('playbook_program_read', { path: 'main.js', ref: { kind: 'revision', revisionId: revision.id } })
  await expect(call('playbook_program_edit', { operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/not-observed/)
  await call('playbook_program_read', { path: 'main.js' })
  await call('playbook_restore', { expectedSequence: 2, revisionId: revision.id, selection: { kind: 'all' } })
  await expect(call('playbook_program_edit', { operations: [{ kind: 'delete-file', path: 'main.js' }] })).rejects.toThrow(/not-observed/)
})
