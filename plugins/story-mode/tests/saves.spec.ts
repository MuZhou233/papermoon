import { afterEach, expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlaybookStorage } from '@papermoon/playbook-storage'
import { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { createPlaybookTools, PlaybookObservations } from '@papermoon/playbook-tools'
import type { PerformanceHost, Performances } from '../../performances/src/service.ts'
import type { LogRecord } from '../../playbook-workspaces/src/host.ts'
import { StoryMode } from '../src/service.ts'
import { CHAPTER_TAG, STORYLINE } from '../src/state.ts'
const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close() })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'story-saves-'))
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }))
  const storage = new PlaybookStorage({ path: join(directory, 'playbook.sqlite') }); cleanup.push(() => storage.close())
  const core = new PlaybookRepository(storage), project = core.createProject({ name: 'Stories' })
  const sessions = new Map<string, LogRecord[]>(), agents = new Map<string, unknown>()
  const host = {
    agents: { get: (id: string) => agents.get(id) }, sessions: { flush: async () => true },
    sessionController: {
      list: async () => ({ items: [...sessions.keys()].map(sessionId => ({ sessionId })) }),
      inspect: async (id: string) => ({ events: sessions.get(id) ?? [] }),
      modelCatalog: async () => ({ routableProviders: ['fixture'], groups: [{ id: 'fixture', models: [{ id: 'plain' }, { id: 'thinking', reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } }] }] }),
      create: async ({ sessionId }: { sessionId: string }) => { sessions.set(sessionId, []); agents.set(sessionId, { id: sessionId, session: {} }) },
      resolveAgent: async (id: string) => ({ agent: agents.get(id) }),
      selectModel: async ({ sessionId, ...choice }: { sessionId: string }) => sessions.get(sessionId)!.push({ seq: 1, type: 'model/selection', data: choice } as LogRecord),
    },
  } as unknown as PerformanceHost
  let success = false
  const performances = { view: vi.fn(async () => ({})), workspaces: { workspace: async () => ({ id: 'workspace' }) }, prepare: vi.fn(), start: vi.fn(async () => {}),
    successful: vi.fn(async (sessionId: string) => success ? ({ sessionId, nodeId: 'node', through: 8, ranges: [{ start: 1, end: 8 }] }) : null),
    reviewRecords: vi.fn(async () => [{ seq: 8, type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: 'First response' }] } } }]),
  } as unknown as Performances
  const story = new StoryMode(core, host, performances); cleanup.push(() => story.dispose())
  const save = () => story.create({ name: 'My character', projectId: project.id, storyline: STORYLINE, language: 'en' })
  const first = save()
  const advance = async () => { const s = story.read(first.id); return story.advance(first.id, s.progress.section, s.snapshot.draft.sequence) }
  const edit = (operations: Parameters<PlaybookRepository['editDraft']>[0]['operations']) => core.editDraft({ playbookId: first.id, expectedSequence: story.read(first.id).snapshot.draft.sequence, operations })
  const prepared = async () => { await advance(); edit([{ kind: 'set-opening-messages', messages: [] }]); await advance(); edit([{ kind: 'set-system-prompt', text: 'Keeper\r\n<identity>patient' }]); await advance(); await story.choose(first.id, { provider: 'fixture', model: 'plain' }); await advance() }
  return { core, storage, story, host, first, save, advance, edit, prepared, performances, succeed: () => { success = true } }
}
test('saves isolate progress and every public route enforces the current stage', async () => {
  const f = fixture(), second = f.save()
  expect(f.core.access(f.first.id)).toEqual([])
  expect(() => f.core.readSnapshot({ kind: 'draft', playbookId: f.first.id })).toThrow(expect.objectContaining({ code: 'forbidden' }))
  const oldTools = createPlaybookTools(f.core, f.first.id)
  expect(oldTools.map(tool => tool.name)).toEqual(['playbook_status', 'playbook_help'])
  await f.advance()
  expect(f.story.read(second.id).progress.section).toBe(1)
  await expect(f.advance()).rejects.toThrow(/Save/)
  expect(() => f.edit([{ kind: 'set-system-prompt', text: 'hidden' }])).toThrow(expect.objectContaining({ code: 'forbidden' }))
  expect(() => f.edit([{ kind: 'set-authoring-mode', target: 'opening', mode: 'script' }])).toThrow()
  const tools = createPlaybookTools(f.core, f.first.id, new PlaybookObservations())
  const call = (name: string, args: unknown) => tools.find(tool => tool.name === name)!.execute(args, { signal: new AbortController().signal })
  expect(JSON.stringify(await call('playbook_help', {}))).not.toContain('playbook_program_read')
  await call('playbook_opening_read', {})
  await call('playbook_opening_edit', { operations: [] })
  await f.advance()
  expect(f.story.read(f.first.id).progress.section).toBe(3)
  await expect(f.advance()).rejects.toThrow(/system prompt/)
  f.edit([{ kind: 'set-system-prompt', text: '  \n ' }]); await expect(f.advance()).rejects.toThrow()
  for (const action of [() => f.core.commitRevision({ playbookId: f.first.id, expectedSequence: 0, description: 'spoof' }), () => f.core.listRevisions(f.first.id), () => f.core.copyPlaybook({ sourcePlaybookId: f.first.id, source: { kind: 'draft', expectedSequence: 0 }, targetProjectId: second.projectId, name: 'copy', history: 'none', publications: 'none' })]) expect(action).toThrow()
  await f.story.dispose()
  expect(f.core.access(f.first.id)).toEqual([])
  await expect(call('playbook_opening_read', {})).rejects.toThrow()
})
test('startup and chapter submission freeze their own content, retry and preserve later drafts', async () => {
  const f = fixture(); await f.prepared()
  const before = f.story.read(f.first.id)
  const started = await f.story.start(f.first.id, before.snapshot.draft.sequence)
  const source = f.story.read(f.first.id).snapshot.draft.baseRevisionId!
  expect(await f.story.start(f.first.id, before.snapshot.draft.sequence)).toEqual(started)
  expect(f.story.repository.listRevisions(f.first.id).items).toHaveLength(1)
  expect(f.story.repository.listRevisions(f.first.id).items[0]!.metadata.tag).toBeUndefined()
  f.edit([{ kind: 'set-system-prompt', text: 'Later draft' }])
  expect((await f.story.state(f.first.id)).progress.completed).toBe(false)
  f.succeed()
  vi.spyOn(f.story.repository, 'commitRevision').mockImplementationOnce(() => { throw new Error('disk failure') })
  expect(await f.story.state(f.first.id)).toMatchObject({ progress: { completed: false }, submissionError: 'disk failure' })
  await f.story.retry(f.first.id)
  const result = f.story.read(f.first.id)
  expect(result.progress.completed).toBe(true)
  expect(result.snapshot.content.systemPrompt.text).toBe('Later draft')
  const revisions = f.story.repository.listRevisions(f.first.id).items
  expect(revisions.filter(entry => entry.metadata.tag === CHAPTER_TAG)).toHaveLength(1)
  expect(revisions[1]!.revision.source.baseRevisionId).toBe(source)
  const review = await f.story.review(f.first.id)
  expect(review.content.systemPrompt.text).toBe('Keeper\r\n<identity>patient')
  expect(review.teaching).toHaveProperty('zh')
  expect(f.performances.reviewRecords).toHaveBeenCalledWith(started.sessionId, [{ start: 1, end: 8 }])
  await Promise.all([f.story.retry(f.first.id), f.story.retry(f.first.id)])
  expect(f.story.repository.listRevisions(f.first.id).items).toHaveLength(2)
  expect(f.performances.start).toHaveBeenCalledTimes(2)
  expect(f.story.read(f.first.id).snapshot.draft.sequence).toBe(result.snapshot.draft.sequence)
})

test('reloading the policy resumes one startup and commits a saved success once', async () => {
  const f = fixture(); await f.prepared()
  const started = await f.story.start(f.first.id, f.story.read(f.first.id).snapshot.draft.sequence)
  f.edit([{ kind: 'set-system-prompt', text: 'Unperformed edit' }])
  f.succeed()
  await f.story.dispose()
  const resumed = new StoryMode(f.core, f.host, f.performances); cleanup.push(() => resumed.dispose())
  const states = await Promise.all([resumed.run(f.first.id, () => resumed.state(f.first.id)), resumed.run(f.first.id, () => resumed.state(f.first.id))])
  expect(states.every(state => state.progress.completed)).toBe(true)
  expect(await resumed.start(f.first.id, states[0]!.sequence)).toEqual(started)
  expect(resumed.repository.listRevisions(f.first.id).items).toHaveLength(2)
  expect(resumed.read(f.first.id).snapshot.content.systemPrompt.text).toBe('Unperformed edit')
  expect(f.performances.start).toHaveBeenCalledOnce()
})
