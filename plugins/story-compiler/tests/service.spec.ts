import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from '@papermoon/story-core/repository'
import { createStoryTools } from '@papermoon/story-tools'
import { StoryObservations } from '../../story-tools/src/observations.ts'
import { RevisionArtifacts } from '../src/revisions.ts'
import { CompilationService } from '../src/service.ts'
import { ArtifactStore } from '../src/store.ts'
import { createArtifact } from '../src/runtime.ts'

const cleanups: Array<() => unknown> = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'papermoon-compiler-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  const storage = new StoryStorage({ path: join(directory, 'story.sqlite') })
  cleanups.push(() => storage.close())
  const repository = new StoryRepository(storage), project = repository.createProject({ name: 'Compiler' })
  const script = repository.createScript({ projectId: project.id, name: 'Opening', defaultLanguage: 'en' })
  repository.editDraft({ scriptId: script.id, expectedSequence: 0, operations: [
    { kind: 'create-file', path: 'story.js', source: 'const {t}=require("@papermoon/story");module.exports={systemPrompt:t("opening"),messages:[]};' },
    { kind: 'create-text', key: 'opening' }, { kind: 'set-translation', key: 'opening', language: 'en', text: 'First' },
  ] })
  const store = new ArtifactStore(join(directory, 'compiled')), service = new CompilationService(repository, store)
  cleanups.push(() => service.close())
  const source = (sequence = 1) => ({ scriptId: script.id, ref: { kind: 'draft' as const, sequence } })
  return { directory, repository, script, store, service, source }
}
describe('saved compilation', () => {
  it('compiles the program help example through the bound tools', async () => {
    const f = await fixture()
    const empty = f.repository.createScript({ projectId: f.script.projectId, name: 'Help example', defaultLanguage: 'en' })
    const tools = createStoryTools(f.repository, empty.id, undefined, f.service)
    const execute = (name: string, args: unknown) => tools.find(tool => tool.name === name)!.execute(args, { signal: new AbortController().signal })
    expect(await execute('story_help', {})).toEqual(await execute('story_help', { topic: 'overview' }))
    const example = await execute('story_help', { topic: 'program' }) as { topic: string; text: string }
    const block = /```json\n([\s\S]*?)\n```/.exec(example.text)
    if (!block) throw new Error('program help has no executable example')
    expect(await execute('story_program_edit', JSON.parse(block[1]!))).toMatchObject({ sequence: 1 })
    expect(await execute('story_compile', { ref: { kind: 'draft', sequence: 1 } })).toMatchObject({ ok: true, context: { systemPrompt: '', messages: [] } })
  })
  it('keeps the snapshot fixed during edits and restores a matching artifact without executing', async () => {
    const f = await fixture()
    expect(await f.service.find(f.source())).toBeNull()
    const compiling = f.service.compile(f.source())
    f.repository.editDraft({ scriptId: f.script.id, expectedSequence: 1, operations: [{ kind: 'set-translation', key: 'opening', language: 'en', text: 'Later' }] })
    const first = await compiling
    expect(first).toMatchObject({ ok: true, source: { sequence: 1 }, context: { systemPrompt: 'First' } })
    if (!first.ok) throw new Error('fixture compilation failed')
    expect(() => f.service.compile(f.source())).toThrow(expect.objectContaining({ code: 'conflict' }))
    expect(await f.service.find(f.source(2))).toBeNull()
    const second = await f.service.compile(f.source(2))
    expect(second).toMatchObject({ ok: true, context: { systemPrompt: 'Later' } })
    expect(await f.service.find(f.source(2))).toEqual(second)
    expect(f.repository.readSnapshot({ kind: 'draft', scriptId: f.script.id }).draft.sequence).toBe(2)
    expect(f.repository.listRevisions(f.script.id).items).toEqual([])
    await f.service.close()
    const reopened = new CompilationService(f.repository, new ArtifactStore(f.store.directory))
    cleanups.push(() => reopened.close())
    expect(await reopened.find(f.source(2))).toEqual(second)
    f.repository.deleteScript(f.script.id)
    expect(await reopened.initialize(first.artifactId)).toMatchObject({ systemPrompt: 'First' })
    expect(() => reopened.compile(f.source(2))).toThrow()
  })
  it('freezes compilation with a revision independently of the preview directory', async () => {
    const f = await fixture(), reader = new RevisionArtifacts(f.repository)
    const result = await f.service.submit({ scriptId: f.script.id, expectedSequence: 1, description: 'Opening' })
    if (!result.committed) throw new Error('fixture submission failed')
    expect(result.compilation.status).toBe('success')
    expect(await readdir(f.directory)).not.toContain('compiled')
    expect(reader.preview(f.script.id, result.revision.id, 'opening/0').systemPrompt).toBe('First')
    expect(f.repository.listPublications({ scriptId: f.script.id }).items).toEqual([])
    expect(f.repository.readSnapshot({ kind: 'draft', scriptId: f.script.id }).draft.sequence).toBe(2)
  })
  it('requires explicit permission for script errors and never attaches a partial target set', async () => {
    const f = await fixture()
    const input = { scriptId: f.script.id, expectedSequence: 1, description: 'Incomplete', targets: [{ entry: 'story.js' }, { entry: 'missing.js' }] }
    expect(await f.service.submit(input)).toMatchObject({ committed: false, compilation: { status: 'failed' } })
    expect(f.repository.listRevisions(f.script.id).items).toEqual([])
    const result = await f.service.submit({ ...input, allowCompilationFailure: true })
    if (!result.committed) throw new Error('expected incomplete revision')
    expect(result.revision.attachments.items).toEqual([])
    expect(new RevisionArtifacts(f.repository).describe(f.script.id, result.revision.id)?.status).toBe('failed')
    expect(() => new RevisionArtifacts(f.repository).read(f.script.id, result.revision.id, 'opening/0')).toThrow()
  })
  it('attaches successful results even when failure is permitted and preserves target order', async () => {
    const f = await fixture()
    f.repository.editDraft({ scriptId: f.script.id, expectedSequence: 1, operations: [{ kind: 'create-file', path: 'other.js', source: 'module.exports={systemPrompt:"Other",messages:[]}' }] })
    const result = await f.service.submit({ scriptId: f.script.id, expectedSequence: 2, description: 'Two', allowCompilationFailure: true, targets: [{ entry: 'other.js' }, { entry: 'story.js' }] })
    if (!result.committed) throw new Error('fixture submission failed')
    const reader = new RevisionArtifacts(f.repository)
    expect(reader.preview(f.script.id, result.revision.id, 'opening/0').systemPrompt).toBe('Other')
    expect(reader.preview(f.script.id, result.revision.id, 'opening/1').systemPrompt).toBe('First')
  })
  it('does not commit on cancellation, invalid targets, concurrent edits or attachment limits', async () => {
    const f = await fixture(), input = { scriptId: f.script.id, expectedSequence: 1, description: 'Opening', allowCompilationFailure: true }
    expect(() => f.service.submit({ ...input, targets: [] })).toThrow()
    expect(() => f.service.submit({ ...input, targets: [{}, { entry: 'story.js', language: 'en' }] })).toThrow()
    const cancelled = new AbortController(); cancelled.abort()
    await expect(f.service.submit(input, cancelled.signal)).rejects.toThrow()
    const limited = new CompilationService(f.repository, f.store, {}, 1)
    cleanups.push(() => limited.close())
    await expect(limited.submit(input)).rejects.toMatchObject({ code: 'attachment-limit' })
    const pending = f.service.submit(input)
    f.repository.editDraft({ scriptId: f.script.id, expectedSequence: 1, operations: [{ kind: 'set-translation', key: 'opening', language: 'en', text: 'Changed' }] })
    await expect(pending).rejects.toMatchObject({ code: 'conflict' })
    expect(f.repository.listRevisions(f.script.id).items).toEqual([])
  })
  it('writes identical artifacts concurrently, refuses different results for a key and rejects corruption', async () => {
    const f = await fixture(), result = await f.service.compile(f.source())
    if (!result.ok) throw new Error('fixture compilation failed')
    const artifact = await f.service.read(result.artifactId)
    const copies = await Promise.all([f.store.save(artifact), f.store.save(artifact)])
    expect(copies).toEqual([artifact, artifact])
    const conflicting = createArtifact(artifact.sourceHash, artifact.options, { context: { systemPrompt: 'Different', messages: [] }, state: artifact.state, functions: artifact.functions, program: artifact.program, composition: artifact.composition })
    await expect(f.store.save(conflicting)).rejects.toMatchObject({ code: 'artifact-conflict' })
    expect(await f.store.read(artifact.id)).toEqual(artifact)
    expect(await readdir(f.store.directory)).toEqual([artifact.id + '.json'])
    await writeFile(join(f.store.directory, artifact.id + '.json'), '{}')
    await expect(f.service.read(artifact.id)).rejects.toMatchObject({ code: 'unsupported-artifact' })
    await expect(f.service.read('../other')).rejects.toMatchObject({ code: 'invalid-artifact' })
  })
  it('does not report success after write failure, cancellation or service disposal', async () => {
    const f = await fixture(), path = join(f.directory, 'file')
    await writeFile(path, 'not a directory')
    const failing = new CompilationService(f.repository, new ArtifactStore(path))
    cleanups.push(() => failing.close())
    await expect(failing.compile(f.source())).rejects.toThrow()
    const controller = new AbortController(), pending = f.service.compile(f.source(), {}, controller.signal)
    controller.abort()
    expect(await pending).toMatchObject({ ok: false, diagnostics: [{ code: 'cancelled' }] })
    const active = f.service.compile(f.source())
    await f.service.close()
    expect(await active).toMatchObject({ ok: false })
    await expect(f.service.read('0'.repeat(64))).rejects.toMatchObject({ code: 'closed' })
  })
  it('exposes async compilation only with its service and never grants observation rights', async () => {
    const f = await fixture(), observations = new StoryObservations()
    expect(createStoryTools(f.repository, f.script.id).some(t => t.name === 'story_compile')).toBe(false)
    const tools = createStoryTools(f.repository, f.script.id, observations, f.service)
    const execute = (name: string, args: unknown, signal = new AbortController().signal) => tools.find(t => t.name === name)!.execute(args, { signal })
    expect(await execute('story_compile', { ref: { kind: 'draft', sequence: 1 } })).toMatchObject({ ok: true, context: { systemPrompt: 'First' } })
    await expect(execute('story_program_edit', { operations: [{ kind: 'replace-file', path: 'story.js', source: '' }] })).rejects.toThrow()
    const controller = new AbortController(); controller.abort()
    await expect(execute('story_compile', { ref: { kind: 'draft', sequence: 1 } }, controller.signal)).rejects.toThrow()
    expect(f.repository.readSnapshot({ kind: 'draft', scriptId: f.script.id }).draft.sequence).toBe(1)
  })
})

it('does not permit service failures to create an uncompiled revision', async () => {
  const f = await fixture()
  const input = { scriptId: f.script.id, expectedSequence: 1, description: 'Stopped', allowCompilationFailure: true }
  const waiting = f.service.submit(input)
  const rejected = expect(waiting).rejects.toThrow()
  await f.service.close()
  await rejected
  expect(() => f.service.submit(input)).toThrow(expect.objectContaining({ code: 'closed' }))
  expect(f.repository.listRevisions(f.script.id).items).toEqual([])
})

it('simulates frozen draft content with raw results, rollback and no persistent changes', async () => {
  const f = await fixture()
  const program = `function factory({state}) {
/** Increase the value.
 * @param {number} amount Amount.
 * @returns {number} New value.
 */
return function add(amount) { state.value += amount; if(amount < 0) throw new Error('negative'); return state.value; }
}
module.exports={systemPrompt:'',messages:[],state:{initial:{value:0},schema:{type:'object',properties:{value:{type:'number'}},required:['value'],additionalProperties:false}},functions:[factory]};`
  f.repository.editDraft({ scriptId: f.script.id, expectedSequence: 1, operations: [{ kind: 'replace-file', path: 'story.js', source: program }] })
  const pending = f.service.simulate(f.source(2), [{ name: 'add', args: { amount: 3 } }, { name: 'add', args: { amount: -1 } }, { name: 'add', args: { amount: 2 } }])
  f.repository.editDraft({ scriptId: f.script.id, expectedSequence: 2, operations: [{ kind: 'replace-file', path: 'story.js', source: '' }] })
  const result = await pending
  expect(result).toMatchObject({ ok: true, source: { sequence: 2 }, state: { value: 5 }, steps: [
    { before: { value: 0 }, result: { ok: true, value: 3, state: { value: 3 } } },
    { before: { value: 3 }, result: { ok: false, diagnostics: [{ message: 'negative' }] } },
    { before: { value: 3 }, result: { ok: true, value: 5, state: { value: 5 } } },
  ] })
  expect(f.repository.readSnapshot({ kind: 'draft', scriptId: f.script.id }).draft.sequence).toBe(3)
  expect(f.repository.listRevisions(f.script.id).items).toHaveLength(0)
  expect(await readdir(f.directory)).not.toContain('compiled')
  const tools = createStoryTools(f.repository, f.script.id, undefined, f.service)
  expect(await tools.find(t => t.name === 'story_simulate')!.execute({ calls: [] }, { signal: new AbortController().signal })).toMatchObject({ ok: false })
})
