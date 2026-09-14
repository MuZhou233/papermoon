/** Initializes sessions from immutable revision attachments. No compiler or artifact-cache imports. */
import { z } from 'zod'
import type { RevisionId, ScriptId } from '@papermoon/story-core'
import type { StoryRepository } from '@papermoon/story-core/repository'
import { RevisionArtifacts } from '@papermoon/story-compiler/revisions'
import { StoryRuntime } from '@papermoon/story-compiler/execution'
import { PerformanceActions, projectActions } from './actions.ts'
import { digest } from '@papermoon/story-compiler/runtime'
import type { Host, Agent, Dispose, InputMessage } from '../../story-workspaces/src/host.ts'
import type { StoryWorkspaces } from '../../story-workspaces/src/index.ts'
import { configureLiteralPrompt } from '../../story-workspaces/src/prompt.ts'
import { performanceState, openingMessages, type FrozenPerformance } from './model.ts'
import { PRESET, CONFIG_KEY, PREPARATION_KEY } from './constants.ts'
export interface ModelSelection { provider: string; model: string; reasoningEffort?: string }
export interface ModelCatalog { default: ModelSelection; routableProviders: string[]; groups: { id: string; name: string; models: { id: string; name: string; reasoning?: { defaultEffort?: string; efforts: { id: string; name: string }[] } }[] }[]; failures: { id: string; name: string; message: string }[] }
export interface PerformanceHost extends Host {
  sessions: { flush(session: Agent['session']): Promise<boolean> }
  sessionController: Host['sessionController'] & {
    create(input: { sessionId: string; workspaceId: string; agentPreset: string }): Promise<{ sessionId: string }>
    selectModel(input: ModelSelection & { sessionId: string }): Promise<unknown>
    modelCatalog(): Promise<ModelCatalog>
    list(request: object, signal: AbortSignal): Promise<{ items: readonly { sessionId: string }[] }>
  }
}
const id = z.string().min(1)
export const startSchema = z.strictObject({ sessionId: id, scriptId: id, revisionId: id, key: id,
  model: z.strictObject({ provider: id, model: id, reasoningEffort: id.optional() }).optional() })
export class Performances {
  private readonly runtimes = new Map<Agent, Dispose>()
  private readonly actions = new Map<Agent, PerformanceActions>()
  private readonly execution = new StoryRuntime()
  private readonly starts = new Map<string, { identity: string; task: Promise<{ sessionId: string; fixed: FrozenPerformance }> }>()
  private closed = false
  readonly artifacts: RevisionArtifacts
  constructor(private readonly host: PerformanceHost, private readonly core: StoryRepository, readonly workspaces: StoryWorkspaces) { this.artifacts = new RevisionArtifacts(core) }
  choices(scriptId: string, revisionId?: string) {
    const script = this.core.getScript(scriptId as ScriptId), project = this.core.getProject(script.projectId)
    const entry = revisionId ? this.core.getHistoryEntry(script.id, revisionId as RevisionId) : this.core.listRevisions(script.id, { limit: 1, descending: true }).items[0]
    if (!entry) return { script, project, entry: null, compilation: null }
    return { script, project, entry, compilation: this.artifacts.describe(script.id, entry.revision.id) }
  }
  prepare(agent: Agent, scriptId: string) {
    const state = performanceState(agent.session)
    if (state.fixed) { if (state.fixed.scriptId !== scriptId) throw new Error('performance script is fixed'); return }
    this.core.getScript(scriptId as ScriptId)
    if (state.scriptId !== scriptId) agent.session.append('session/configuration', { key: PREPARATION_KEY, value: { scriptId } })
    this.attach(agent)
  }
  async view(sessionId: string) {
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const state = performanceState(result.agent.session)
    let sourceMissing = false
    if (state.fixed) try { this.core.getScript(state.fixed.scriptId as ScriptId) } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') sourceMissing = true; else throw error }
    return { ...state, sourceMissing, ...(state.fixed ? { runtime: projectActions(result.agent.session.snapshotEvents(), state.fixed) } : {}) }
  }
  start(input: z.infer<typeof startSchema>) {
    if (this.closed) return Promise.reject(new Error('performance service is closed'))
    const identity = JSON.stringify([input.scriptId, input.revisionId, input.key]), prior = this.starts.get(input.sessionId)
    if (prior) return prior.identity === identity ? prior.task : Promise.reject(new Error('session initialization is already in progress for another source'))
    const task = this.initialize(input), operation = { identity, task }
    this.starts.set(input.sessionId, operation)
    void task.finally(() => { if (this.starts.get(input.sessionId) === operation) this.starts.delete(input.sessionId) }).catch(() => {}) // The original task owns errors; cleanup does not create a second failure.
    return task
  }
  private async initialize(input: z.infer<typeof startSchema>) {
    // Resolve retained sessions first so a retry can succeed after source deletion.
    const existing = this.host.agents.get(input.sessionId)
    if (existing) {
      const fixed = performanceState(existing.session).fixed
      if (fixed) return this.same(input, fixed)
      if (performanceState(existing.session).mode !== PRESET) throw new Error('session belongs to another mode')
    } else {
      const known = await this.host.sessionController.list({}, new AbortController().signal)
      if (known.items.some(item => item.sessionId === input.sessionId)) {
        const saved = await this.host.sessionController.inspect(input.sessionId)
        const state = performanceState({ header: saved.meta, snapshotEvents: () => saved.events })
        if (state.fixed) return this.same(input, state.fixed)
        if (state.mode !== PRESET) throw new Error('session belongs to another mode')
      }
    }
    const choice = this.choices(input.scriptId, input.revisionId)
    if (!choice.entry) throw new Error('revision does not exist')
    const artifact = this.artifacts.read(choice.script.id, choice.entry.revision.id, input.key)
    const payload = { version: 2 as const, originSessionId: input.sessionId, scriptId: input.scriptId, revisionId: input.revisionId, ordinal: choice.entry.ordinal, scriptName: choice.script.name, projectName: choice.project.name, description: choice.entry.revision.description, attachmentKey: input.key, artifact }
    const fixed: FrozenPerformance = { ...payload, checksum: digest(payload) }
    const workspace = await this.workspaces.workspace(input.scriptId)
    if (this.closed) throw new Error('performance service is closed')
    await this.host.sessionController.create({ sessionId: input.sessionId, workspaceId: workspace.id, agentPreset: PRESET })
    const result = await this.host.sessionController.resolveAgent(input.sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const agent = result.agent
    if (performanceState(agent.session).mode !== PRESET) throw new Error('session belongs to another mode')
    if (input.model) await this.host.sessionController.selectModel({ sessionId: input.sessionId, ...input.model })
    return agent.runMaintenance(async signal => {
      signal.throwIfAborted()
      if (this.closed) throw new Error('performance service is closed')
      const state = performanceState(agent.session)
      if (state.fixed) return this.same(input, state.fixed)
      if (state.mode !== PRESET || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new Error('performance session is not ready for initialization')
      this.prepare(agent, input.scriptId)
      agent.session.append('session/configuration', { key: CONFIG_KEY, value: fixed, presentation: { initialized: true, label: '演绎', text: [fixed.artifact.context.systemPrompt, ...fixed.artifact.context.messages.map(message => message.content)].join('\n') } })
      this.bindActions(agent, fixed)
      return { sessionId: agent.id, fixed }
    })
  }
  private same(input: z.infer<typeof startSchema>, fixed: FrozenPerformance) {
    if (fixed.scriptId !== input.scriptId || fixed.revisionId !== input.revisionId || fixed.attachmentKey !== input.key) throw new Error('performance version and artifact are fixed')
    return { sessionId: input.sessionId, fixed }
  }
  admit(agent: Agent, message: InputMessage) {
    const state = performanceState(agent.session)
    if (state.mode === PRESET && !state.fixed) throw new Error('initialize the performance before sending')
    return message
  }
  attach(agent: Agent) {
    if (performanceState(agent.session).mode !== PRESET) { this.runtimes.get(agent)?.(); return }
    if (this.runtimes.has(agent)) { const fixed = performanceState(agent.session).fixed; if (fixed) this.bindActions(agent, fixed); return }
    const disposers: Dispose[] = []
    let disposed = false
    const dispose = () => { if (disposed) return; disposed = true; for (const remove of disposers.reverse()) remove(); this.runtimes.delete(agent); this.actions.get(agent)?.dispose(); this.actions.delete(agent) }
    const required = () => { const fixed = performanceState(agent.session).fixed; if (!fixed) throw new Error('performance initialization is missing'); return fixed }
    try {
      disposers.push(...configureLiteralPrompt(agent, 'papermoon_performance_prompt', () => required().artifact.context.systemPrompt))
      disposers.push(agent.ctx.tools.presentAs('native'))
      disposers.push(agent.ctx.on('agent/pre-step', async (_payload, next) => {
        const fixed = required(); await this.actions.get(agent)?.recover(); const decision = await next()
        return decision.kind === 'reject' ? decision : { ...decision, initialMessages: [...(decision.initialMessages ?? []), ...openingMessages(fixed)] }
      }))
      this.runtimes.set(agent, dispose)
      agent.ctx.effect(() => dispose, 'papermoon.performance-runtime')
      const fixed = performanceState(agent.session).fixed
      if (fixed) this.bindActions(agent, fixed)
    } catch (error) { dispose(); throw error }
  }
  private bindActions(agent: Agent, fixed: FrozenPerformance) {
    if (this.actions.has(agent)) return
    const actions = new PerformanceActions(agent, fixed, this.execution, () => this.host.sessions.flush(agent.session))
    const disposers: Dispose[] = []
    const dispose = () => { actions.dispose(); for (const remove of disposers.splice(0).reverse()) remove(); if (this.actions.get(agent) === actions) this.actions.delete(agent) }
    try {
      for (const tool of actions.tools()) disposers.push(agent.ctx.tools.register(tool))
      this.actions.set(agent, actions)
      agent.ctx.effect(() => dispose, 'papermoon.performance-actions')
      const previous = this.runtimes.get(agent)!
      this.runtimes.set(agent, () => { dispose(); previous() })
    } catch (error) { dispose(); throw error }
  }
  async close() {
    this.closed = true
    await Promise.allSettled([...this.starts.values()].map(value => value.task))
    const pending = [...this.actions.values()].map(actions => actions.close())
    for (const dispose of this.runtimes.values()) dispose()
    await this.execution.close(); await Promise.all(pending)
  }
}
