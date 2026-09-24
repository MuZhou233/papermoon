/** Initializes sessions from immutable revision attachments. No compiler or artifact-cache imports. */
import { z } from 'zod'
import type { RevisionId, PlaybookId } from '@papermoon/playbook-core'
import type { PlaybookRepository } from '@papermoon/playbook-core/repository'
import { RevisionArtifacts } from '@papermoon/playbook-compiler/revisions'
import { PlaybookRuntime } from '@papermoon/playbook-compiler/execution'
import { PerformanceActions, projectActions } from './actions.ts'
import { digest } from '@papermoon/playbook-compiler/runtime'
import type { Host, Agent, Dispose, InputMessage } from '../../playbook-workspaces/src/host.ts'
import type { PlaybookWorkspaces } from '../../playbook-workspaces/src/index.ts'
import { inspectExecution, executionPosition, type InspectionCursor, type InspectionMode } from './inspection.ts'
import { PerformanceContext, contextRecord, eventMessage } from './composition.ts'
import { configureLiteralPrompt } from '../../playbook-workspaces/src/prompt.ts'
import { performanceState, openingMessages, type FrozenPerformance } from './model.ts'
import { Worldlines, activeRecords, pathTo, pathRanges, recordsFor, type WorldOperation } from './worldlines.ts'
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
export const startSchema = z.strictObject({ sessionId: id, playbookId: id, revisionId: id, key: id,
  model: z.strictObject({ provider: id, model: id, reasoningEffort: id.optional() }).optional() })
export class Performances {
  private readonly runtimes = new Map<Agent, Dispose>()
  private readonly contextsByAgent = new Map<Agent, PerformanceContext>()
  private readonly actions = new Map<Agent, PerformanceActions>()
  private readonly lines = new Map<Agent, Worldlines>()
  private readonly execution = new PlaybookRuntime()
  private readonly starts = new Map<string, { identity: string; task: Promise<{ sessionId: string; fixed: FrozenPerformance }> }>()
  private closed = false
  readonly artifacts: RevisionArtifacts
  constructor(private readonly host: PerformanceHost, private readonly core: PlaybookRepository, readonly workspaces: PlaybookWorkspaces) { this.artifacts = new RevisionArtifacts(core) }
  choices(playbookId: string, revisionId?: string) {
    const playbook = this.core.getPlaybook(playbookId as PlaybookId), project = this.core.getProject(playbook.projectId)
    const entry = revisionId ? this.core.getHistoryEntry(playbook.id, revisionId as RevisionId) : this.core.listRevisions(playbook.id, { limit: 1, descending: true }).items[0]
    if (!entry) return { playbook, project, entry: null, compilation: null }
    return { playbook, project, entry, compilation: this.artifacts.describe(playbook.id, entry.revision.id) }
  }
  prepare(agent: Agent, playbookId: string) {
    const state = performanceState(agent.session)
    if (state.fixed) { if (state.fixed.playbookId !== playbookId) throw new Error('performance playbook is fixed'); return }
    this.core.getPlaybook(playbookId as PlaybookId)
    if (state.playbookId !== playbookId) agent.session.append('session/configuration', { key: PREPARATION_KEY, value: { playbookId } })
    this.attach(agent)
  }
  async view(sessionId: string) {
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const lines = this.lines.get(result.agent)
    await lines?.ready()
    const state = performanceState(result.agent.session)
    const tree = lines?.state()
    const path = tree?.selected ? pathTo(tree.nodes, tree.selected).map(node => node.id) : []
    const parents = new Set(path)
    let sourceMissing = false
    if (state.fixed) try { this.core.getPlaybook(state.fixed.playbookId as PlaybookId) } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found') sourceMissing = true; else throw error }
    return { ...state, sourceMissing, ...(state.fixed ? { runtime: projectActions(activeRecords(result.agent.session.snapshotEvents(), state.fixed), state.fixed) } : {}),
      worldline: tree ? { version: tree.version, selected: tree.selected, pending: tree.pending,
        path, count: tree.nodes.size,
        nodes: [...tree.nodes.values()].filter(node => {
          return parents.has(node.id) || (node.parent !== null && parents.has(node.parent))
        }) } : undefined }
  }
  /** Page immutable node summaries in their permanent creation order. */
  async tree(sessionId: string, offset = 0, limit = 100) {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid worldline page')
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const lines = this.lines.get(result.agent); if (!lines) throw new Error('worldline is unavailable')
    const tree = lines.state(), ordered = [...tree.nodes.values()], lanes = new Map<string, number>(), first = new Set<string>()
    let nextLane = 0
    for (const node of ordered) {
      const lane = node.parent === null ? 0 : first.has(node.parent) ? ++nextLane : lanes.get(node.parent)!
      lanes.set(node.id, lane); if (node.parent) first.add(node.parent)
    }
    return { offset, total: ordered.length, items: ordered.slice(offset, offset + limit).map(node => ({
      ...node, ...executionPosition(result.agent.session.snapshotEvents(), tree.nodes, node), input: node.input ? { ...node.input, content: [{ type: 'text', text: node.input.content.flatMap(part => part && typeof part === 'object' && 'text' in part ? [String(part.text)] : []).join('\n').slice(0,500) }] } : undefined,
      lane: lanes.get(node.id)!, parentLane: node.parent ? lanes.get(node.parent)! : null, parentOrdinal: node.parent ? tree.nodes.get(node.parent)!.ordinal : null,
    })) }
  }
  /** Read a fixed execution without changing the active history or re-running the playbook. */
  async inspection(sessionId: string, nodeId: string, mode: InspectionMode, cursor?: InspectionCursor, limit = 200) {
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const fixed = performanceState(result.agent.session).fixed
    if (!fixed) throw new Error('performance is not initialized')
    return inspectExecution(result.agent.session.snapshotEvents(),fixed,nodeId,mode,seq=>result.agent.session.deriveRequestMessages(seq),cursor,limit)
  }
  /** Read one immutable request, including records outside the active worldline. */
  async request(sessionId: string, seq: number) {
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('session does not exist')
    const agent = result.agent, events = agent.session.snapshotEvents(), event = events[seq]
    const data = event && contextRecord(event)
    if (!data) throw new Error('request does not exist')
      const header = events.slice(0, event.seq! + 1).findLast(entry => entry.type === 'request/header')
      const base = data.base === undefined ? undefined : contextRecord(events[data.base]!)
      const outcome = events.slice(event.seq! + 1).find(entry => entry.type === 'assistant/message' || entry.type === 'assistant/attempt' || entry.type === 'request/messages' || entry.type === 'turn/end')
      const messages = agent.session.deriveRequestMessages(event.seq)
      const origins = [...(base?.metadata.origins ?? []),...data.metadata.origins]
      for (const [index,origin] of origins.entries()) if (origin.hash && digest(origin.eventSeq === undefined ? messages[index] : eventMessage(events[origin.eventSeq]!)) !== origin.hash) throw new Error('request source checksum does not match')
      if (outcome && ['assistant/message','assistant/attempt'].includes(outcome.type) && ((outcome.data as {turn:number;step:number}).turn!==data.turn || (outcome.data as {step:number}).step!==data.step)) throw new Error('request outcome has conflicting execution identity')
      const completed = outcome && (outcome.type === 'assistant/message' || outcome.type === 'assistant/attempt')
      const response = completed ? outcome.data as { usage?: unknown; reason?: unknown } : undefined
      const meter = this.host.get?.('tokenMeter') as { estimateRequest?: (messages: readonly unknown[], header: unknown) => number } | undefined
      return {seq:event.seq!,nodeId:data.metadata.runId,parentId:data.metadata.parentId,turn:data.turn,step:data.step,
        messages,origins,header:header?.data ?? null,usage:response?.usage ?? null,
        status:completed ? 'recorded' : 'prepared', estimatedTokens:meter?.estimateRequest?.(messages, (header?.data as {header?: unknown} | undefined)?.header) ?? null}
  }
  async operation(sessionId: string, operation: WorldOperation) {
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const lines = this.lines.get(result.agent); if (!lines) throw new Error('worldline is unavailable')
    this.contextsByAgent.get(result.agent)?.assertAvailable()
    await lines.ready()
    return lines.operate(operation)
  }
  async node(sessionId: string, nodeId: string) {
    const result = await this.host.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    const lines = this.lines.get(result.agent), fixed = performanceState(result.agent.session).fixed
    if (!lines || !fixed) throw new Error('worldline is unavailable')
    const tree = lines.state(), node = tree.nodes.get(nodeId)
    if (!node) throw new Error('worldline node does not exist')
    const events = recordsFor(result.agent.session.snapshotEvents(), pathRanges(tree.nodes, nodeId))
    const siblings = [...tree.nodes.values()].filter(item => item.parent === node.parent).map(({ id, ordinal, outcome }) => ({ id, ordinal, outcome }))
    return { node, siblings, events, runtime: projectActions(events, fixed), version: tree.version }
  }
  observe(session: Agent['session'], event: import('../../playbook-workspaces/src/host.ts').LogRecord) {
    if (event.type !== 'turn/end') return
    for (const [agent, lines] of this.lines) if (agent.session === session && lines.state().pending)
      queueMicrotask(() => { void lines.settle().catch(() => {}) }) // The worldline retains the error and blocks subsequent operations.

  }
  start(input: z.infer<typeof startSchema>) {
    if (this.closed) return Promise.reject(new Error('performance service is closed'))
    const identity = JSON.stringify([input.playbookId, input.revisionId, input.key]), prior = this.starts.get(input.sessionId)
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
    const choice = this.choices(input.playbookId, input.revisionId)
    if (!choice.entry) throw new Error('revision does not exist')
    const artifact = this.artifacts.read(choice.playbook.id, choice.entry.revision.id, input.key)
    const payload = { originSessionId: input.sessionId, playbookId: input.playbookId, revisionId: input.revisionId, ordinal: choice.entry.ordinal, playbookName: choice.playbook.name, projectName: choice.project.name, description: choice.entry.revision.description, attachmentKey: input.key, artifact }
    const fixed: FrozenPerformance = { ...payload, checksum: digest(payload) }
    const workspace = await this.workspaces.workspace(input.playbookId)
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
      this.prepare(agent, input.playbookId)
      agent.session.append('session/configuration', { key: CONFIG_KEY, value: fixed, presentation: { initialized: true, label: '演绎', text: [fixed.artifact.context.systemPrompt, ...fixed.artifact.context.messages.map(message => message.content)].join('\n') } })
      this.bindActions(agent, fixed)
      await this.lines.get(agent)!.initialize()
      return { sessionId: agent.id, fixed }
    })
  }
  private async same(input: z.infer<typeof startSchema>, fixed: FrozenPerformance) {
    if (fixed.playbookId !== input.playbookId || fixed.revisionId !== input.revisionId || fixed.attachmentKey !== input.key) throw new Error('performance version and artifact are fixed')
    const result = await this.host.sessionController.resolveAgent(input.sessionId)
    if ('error' in result) throw new Error('performance session is unavailable')
    this.attach(result.agent)
    const lines = this.lines.get(result.agent)!
    await lines.ready()
    if (!lines.state().selected) throw new Error('performance initialization is incomplete')
    if (!await this.host.sessions.flush(result.agent.session)) throw new Error('performance initialization persistence is unconfirmed')
    return { sessionId: input.sessionId, fixed }
  }
  async admit(agent: Agent, message: InputMessage, persist = true) {
    const state = performanceState(agent.session)
    if (state.mode === PRESET && !state.fixed) throw new Error('initialize the performance before sending')
    this.contextsByAgent.get(agent)?.assertAvailable()
    return state.mode === PRESET ? this.lines.get(agent)!.admit(message, persist) : message
  }
  attach(agent: Agent) {
    if (performanceState(agent.session).mode !== PRESET) { this.runtimes.get(agent)?.(); return }
    if (this.runtimes.has(agent)) { const fixed = performanceState(agent.session).fixed; if (fixed) this.bindActions(agent, fixed); return }
    const disposers: Dispose[] = []
    let disposed = false
    const dispose = () => { if (disposed) return; disposed = true; for (const remove of disposers.reverse()) remove(); this.runtimes.delete(agent); this.actions.get(agent)?.dispose(); this.actions.delete(agent); this.lines.get(agent)?.dispose(); this.lines.delete(agent) }
    const required = () => { const fixed = performanceState(agent.session).fixed; if (!fixed) throw new Error('performance initialization is missing'); return fixed }
    try {
      disposers.push(...configureLiteralPrompt(agent, 'papermoon_performance_prompt', () => { required(); return '' }))
      disposers.push(agent.ctx.tools.presentAs('native'))
      disposers.push(agent.ctx.on('agent/pre-step', async (_payload, next) => {
        const fixed = required(); const decision = await next()
        if (decision.kind === 'enter') this.lines.get(agent)!.validateInput(decision.messages)
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
    const context = new PerformanceContext(agent, fixed, this.execution, () => this.host.sessions.flush(agent.session))
    const disposers: Dispose[] = []
    const dispose = () => { this.contextsByAgent.delete(agent); actions.dispose(); for (const remove of disposers.splice(0).reverse()) remove(); if (this.actions.get(agent) === actions) this.actions.delete(agent) }
    try {
      disposers.push(agent.ctx.on('agent/request-messages', async (payload, next) => {
        if (await next() !== undefined) throw new Error('performance context conflicts with another request assembler')
        return context.request(payload.turn, payload.step, payload.signal)
      }))
      for (const tool of actions.tools()) disposers.push(agent.ctx.tools.register({ ...tool, execute: (args, execution) => {
        if (!this.lines.get(agent)?.state().pending) throw new Error('performance function requires an active worldline execution')
        return tool.execute(args, execution)
      } }))
      this.contextsByAgent.set(agent, context)
      this.actions.set(agent, actions)
      const lines = new Worldlines(agent, fixed, () => this.host.sessions.flush(agent.session), actions, (content, operation) => this.host.sessionController.submitUserInput({ sessionId: agent.id, requestId: operation.operationId, mode: 'queue', content, historyVersion: operation.expectedVersion, ...(operation.clientTimeZone === undefined ? {} : { clientTimeZone: operation.clientTimeZone }), admission: { 'papermoon.worldline': operation } }))
      this.lines.set(agent, lines)
      if (lines.state().pending && agent.status === 'idle') queueMicrotask(() => { void lines.settle().catch(() => {}) })
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
