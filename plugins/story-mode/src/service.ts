/** Story orchestration persists only through the Playbook policy controller. */
import { randomUUID } from 'node:crypto'
import type { JsonObject, PlaybookId, ProjectId, RevisionId } from '@papermoon/playbook-core'
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { PlaybookCompiler } from '@papermoon/playbook-compiler'
import type { Performances, PerformanceHost, ModelSelection } from '../../performances/src/service.ts'
import { PRESET } from '../../performances/src/constants.ts'
import { chapter } from './content.ts'
import { CHAPTER_TAG, POLICY, STORYLINE, initialProgress, policy, progressSchema, type Progress } from './state.ts'

export class StoryMode {
  private readonly controller
  private readonly compiler = new PlaybookCompiler()
  private closed = false
  private readonly pending = new Map<string, Promise<unknown>>()
  private readonly failures = new Map<string, string>()
  readonly repository: PlaybookRepository
  constructor(private readonly core: PlaybookRepository, private readonly host: PerformanceHost, private readonly performances: Performances) {
    this.controller = core.registerPolicy(POLICY, policy)
    this.repository = this.controller.repository
  }
  run<T>(id: string, task: () => Promise<T>): Promise<T> {
    const next = (this.pending.get(id) ?? Promise.resolve()).catch(() => {}).then(() => { if (this.closed) throw new Error('Story Mode is unavailable.'); return task() })
    this.pending.set(id, next)
    void next.finally(() => { if (this.pending.get(id) === next) this.pending.delete(id) }).catch(() => {})
    return next
  }
  create(input: { name: string; projectId: string; storyline: string; language: string }) {
    if (input.storyline !== STORYLINE) throw new Error('Unknown storyline.')
    return this.repository.createPlaybook({ name: input.name, projectId: input.projectId as ProjectId, defaultLanguage: input.language,
      metadata: { storyline: STORYLINE }, draftMetadata: { $managed: { policy: POLICY, binding: STORYLINE, state: initialProgress() } } })
  }
  read(id: string) {
    const managed = this.core.managed(id as PlaybookId)
    if (!managed || managed.policy !== POLICY || managed.binding !== STORYLINE) throw new Error('Story save is unavailable.')
    const snapshot = this.repository.readSnapshot({ kind: 'draft', playbookId: id as PlaybookId })
    return { managed, progress: progressSchema.parse(managed.state), snapshot }
  }
  private update(id: string, expectedSequence: number, progress: Progress) {
    const { managed } = this.read(id)
    return this.repository.updateManaged(id as PlaybookId, expectedSequence, { ...managed, state: progress })
  }
  list() {
    const items = []
    let after: string | undefined
    do {
      const page = this.core.queryPlaybooks({ after, limit: 1000 })
      for (const item of page.items) if (this.core.managed(item.id)?.policy === POLICY) items.push({ ...item, progress: this.read(item.id).progress })
      after = page.next
    } while (after)
    return items
  }
  private async selection(sessionId: string): Promise<ModelSelection | undefined> {
    const saved = await this.host.sessionController.inspect(sessionId)
    const record = saved.events.findLast(event => event.type === 'model/selection')
    return record?.data as ModelSelection | undefined
  }
  private async validate(choice: ModelSelection) {
    const catalog = await this.host.sessionController.modelCatalog()
    const group = catalog.groups.find(group => group.id === choice.provider)
    const model = group?.models.find(model => model.id === choice.model)
    if (!model || !catalog.routableProviders.includes(choice.provider)) throw new Error('Select an available configured model.')
    if (choice.reasoningEffort !== undefined && !model.reasoning?.efforts.some(effort => effort.id === choice.reasoningEffort)) throw new Error('Select a reasoning effort supported by this model.')
    return choice
  }
  async choose(id: string, choice: ModelSelection) {
    let { progress, snapshot } = this.read(id)
    this.core.require(id as PlaybookId, 'model')
    if (choice.reasoningEffort !== undefined) this.core.require(id as PlaybookId, 'effort')
    await this.validate(choice)
    if (!progress.sessionId) {
      progress = { ...progress, sessionId: randomUUID() }
      this.update(id, snapshot.draft.sequence, progress)
    }
    const sessionId = progress.sessionId!
    const known = await this.host.sessionController.list({}, new AbortController().signal)
    if (!this.host.agents.get(sessionId) && !known.items.some(item => item.sessionId === sessionId)) {
      const workspace = await this.performances.workspaces.workspace(id)
      await this.host.sessionController.create({ sessionId, workspaceId: workspace.id, agentPreset: PRESET })
    }
    const resolved = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in resolved) throw new Error('Performance preparation is unavailable.')
    this.performances.prepare(resolved.agent, id)
    await this.host.sessionController.selectModel({ sessionId, ...choice })
    if (!await this.host.sessions.flush(resolved.agent.session)) throw new Error('Model selection persistence is unconfirmed.')
    const current = this.read(id)
    if (!current.progress.started) this.update(id, current.snapshot.draft.sequence, { ...current.progress, step: 3 })
    return this.state(id)
  }
  async advance(id: string, section: number, expectedSequence: number) {
    const { progress, snapshot } = this.read(id)
    if (progress.section !== section || section >= 5) throw new Error('Continue from the current section.')
    if (section === 2 && !progress.openingSaved) throw new Error('Save the current opening messages before continuing.')
    if (section === 3 && !snapshot.content.systemPrompt.text.trim()) throw new Error('Save a system prompt containing text before continuing.')
    if (section === 4) {
      const choice = progress.sessionId && await this.selection(progress.sessionId)
      if (!choice) throw new Error('Select an available configured model.')
      await this.validate(choice)
    }
    this.update(id, expectedSequence, { ...progress, section: section + 1, step: 1 })
    return this.state(id)
  }
  async start(id: string, expectedSequence: number) {
    let { progress, snapshot, managed } = this.read(id)
    this.core.require(id as PlaybookId, 'performance')
    if (!progress.sessionId) throw new Error('Select an available configured model.')
    if (progress.completed) return { sessionId: progress.sessionId }
    if (!progress.started) {
      const choice = await this.selection(progress.sessionId)
      if (!choice) throw new Error('Select an available configured model.')
      await this.validate(choice)
      if (!snapshot.content.systemPrompt.text.trim()) throw new Error('Save a system prompt containing text before starting.')
      if (!progress.openingSaved) throw new Error('Save the current opening messages before starting.')
      const prepared = await this.compiler.compile(snapshot.content)
      if (!prepared.ok) throw new Error(prepared.diagnostics.map(item => item.message).join('\n'))
      progress = { ...progress, started: true, step: 4 }
      const state = { ...managed, state: progress }
      this.repository.commitRevision({ playbookId: id as PlaybookId, expectedSequence, description: 'Your First Character · performance source',
        metadata: { $managed: state }, draftMetadata: { ...snapshot.draft.metadata, $managed: state },
        attachments: [{ key: 'opening/0', value: prepared.artifact as unknown as JsonObject, metadata: { artifactId: prepared.artifact.id } }, { key: 'story/teaching', value: chapter }],
        attachmentMetadata: { compilation: { format: 'papermoon.compilation', status: 'success', sourceHash: prepared.artifact.sourceHash,
          targets: [{ entry: prepared.artifact.options.entry, language: prepared.artifact.options.language, diagnostics: [], attachmentKey: 'opening/0' }] } } })
      snapshot = this.read(id).snapshot
    }
    const revisionId = snapshot.draft.baseRevisionId
    if (!revisionId) throw new Error('The performance source is unavailable.')
    await this.performances.start({ playbookId: id, sessionId: progress.sessionId!, revisionId, key: 'opening/0' })
    return { sessionId: progress.sessionId! }
  }
  async complete(id: string) {
    const { progress, snapshot, managed } = this.read(id)
    if (!progress.started || progress.completed || !progress.sessionId) return
    const success = await this.performances.successful(progress.sessionId)
    if (!success) return
    const source = snapshot.draft.baseRevisionId
    if (!source) throw new Error('The performance source is unavailable.')
    const teaching = this.repository.readRevisionAttachment(source, 'story/teaching').value
    const artifact = this.repository.readRevisionAttachment(source, 'opening/0')
    const state = { ...managed, state: { ...progress, completed: true, step: 4 } }
    this.repository.commitRevision({ playbookId: id as PlaybookId, expectedSequence: snapshot.draft.sequence, sourceRevisionId: source,
      tag: CHAPTER_TAG, description: 'Fogbound Earthshine · Your First Character', metadata: { $managed: state },
      draftMetadata: { ...snapshot.draft.metadata, $managed: state }, historyMetadata: { tag: CHAPTER_TAG },
      attachments: [{ key: 'story/teaching', value: teaching }, { key: 'story/records', value: success as unknown as JsonObject }, { key: 'opening/0', value: artifact.value, metadata: artifact.metadata }],
      attachmentMetadata: this.repository.getRevision(source).attachments.metadata })
    this.failures.delete(id)
  }
  async state(id: string) {
    if (!this.failures.has(id)) try { await this.complete(id) } catch (error) { this.failures.set(id, error instanceof Error ? error.message : String(error)) }
    const { progress, snapshot } = this.read(id)
    const choice = progress.sessionId ? await this.selection(progress.sessionId).catch(() => undefined) : undefined
    const modelValid = choice ? await this.validate(choice).then(() => true, () => false) : false
    const execution = progress.started && progress.sessionId && !progress.completed ? await this.performances.view(progress.sessionId).catch(() => undefined) : undefined
    const latest = execution?.worldline?.nodes.at(-1)?.outcome
    return { responseFailed: latest !== undefined && ['failed', 'cancelled', 'interrupted', 'blocked'].includes(latest), requirements: { systemSaved: !!snapshot.content.systemPrompt.text.trim(), modelValid }, playbook: this.core.getPlaybook(id as PlaybookId), progress, sequence: snapshot.draft.sequence, choice, capabilities: this.core.access(id as PlaybookId), submissionError: this.failures.get(id) }
  }
  async retry(id: string) { this.failures.delete(id); await this.complete(id); return this.state(id) }
  async review(id: string) {
    const { progress } = this.read(id)
    if (!progress.completed) throw new Error('Complete the chapter to open its review.')
    const revision = this.repository.listRevisions(id as PlaybookId, { descending: true, limit: 1000 }).items.find(item => item.metadata.tag === CHAPTER_TAG)?.revision
    if (!revision) throw new Error('The chapter submission is unavailable.')
    const boundary = this.repository.readRevisionAttachment(revision.id, 'story/records').value as unknown as { sessionId: string; ranges: { start: number; end: number }[] }
    let records: Awaited<ReturnType<Performances['reviewRecords']>> = [], recordsError: string | undefined
    try { records = await this.performances.reviewRecords(boundary.sessionId, boundary.ranges) } catch (error) { recordsError = error instanceof Error ? error.message : String(error) }
    return { revision, content: this.repository.readSnapshot({ kind: 'revision', revisionId: revision.id as RevisionId }).content,
      teaching: this.repository.readRevisionAttachment(revision.id, 'story/teaching').value, records, recordsError }
  }
  async dispose() { this.closed = true; this.controller.dispose(); await this.compiler.close(); await Promise.allSettled(this.pending.values()) }
}
export type StoryView = Awaited<ReturnType<StoryMode['state']>>
