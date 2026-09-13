import { StoryWorkspaces } from '../../story-workspaces/src/index.ts'
import { configureLiteralPrompt } from '../../story-workspaces/src/prompt.ts'
/** Session selection, admission and Agent-local tool ownership. */
import { z } from 'zod'
import type { ScriptId } from '@papermoon/story-core'
import { createStoryTools, StoryObservations } from '@papermoon/story-tools'
import { CONFIG_KEY, PRESET, WriterSessionError, writerState, initialContext, type Preparation, type FixedWriter } from './model.ts'
import type { Agent, Host, Services, Dispose, InputMessage } from './host.ts'
export const configureSchema = z.strictObject({ sessionId: z.string().min(1), writerId: z.string().min(1), writerSequence: z.number().int().nonnegative() })
export class WriterSessions {
  private readonly runtimes = new Map<Agent, { scriptId?: string; observations: StoryObservations; dispose: Dispose }>()
  constructor(private readonly host: Host, private readonly services: Services, readonly cwd: string) {}
  private target(scriptId: string) {
    try { return this.services.core.getScript(scriptId as ScriptId) }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'not-found')
        throw new WriterSessionError('target-missing', 'script target no longer exists')
      throw error
    }
  }
  async agent(id: string): Promise<Agent> {
    const result = await this.host.sessionController.resolveAgent(id)
    if ('error' in result) throw new WriterSessionError('unavailable', 'session cannot be resumed')
    this.attach(result.agent)
    return result.agent
  }
  view(agent: Agent) {
    const state = writerState(agent.session)
    const scriptId = state.fixed?.scriptId ?? state.preparation?.scriptId
    let target: ReturnType<WriterSessions['target']> | undefined
    if (scriptId) {
      try { target = this.target(scriptId) }
      catch (error) { if (!(error instanceof WriterSessionError) || error.code !== 'target-missing') throw error }
    }
    return { ...state, target, targetMissing: scriptId !== undefined && target === undefined }
  }
  async configure(input: z.infer<typeof configureSchema>) {
    const agent = await this.agent(input.sessionId)
    return agent.runMaintenance(async signal => {
      signal.throwIfAborted()
      const state = writerState(agent.session)
      if (state.fixed) throw new WriterSessionError('locked', 'writer configuration is fixed after accepted input')
      if (state.mode !== PRESET) throw new WriterSessionError('wrong-mode', 'select writer mode first')
      if (!state.preparation) throw new WriterSessionError('unconfigured', 'select a script workspace first')
      if (agent.inbox.nextTurn.length || agent.inbox.nextStep.length) throw new WriterSessionError('locked', 'pending input prevents configuration changes')
      this.target(state.preparation.scriptId)
      const writer = this.services.writers.get(input.writerId)
      if (writer.sequence !== input.writerSequence) throw new WriterSessionError('conflict', 'writer configuration changed; reload before selecting')
      const preparation: Preparation = { ...state.preparation, writer: { id: writer.id, sequence: writer.sequence } }
      agent.session.append('session/configuration', { key: CONFIG_KEY, value: preparation, presentation: { label: '编剧' } })
      this.attach(agent)
      return this.view(agent)
    })
  }
  prepare(agent: Agent, scriptId: string): void {
    const state = writerState(agent.session)
    if (state.fixed && state.fixed.scriptId !== scriptId) throw new WriterSessionError('locked', 'script is fixed after accepted input')
    this.target(scriptId)
    if (state.preparation?.scriptId === scriptId) return
    agent.session.append('session/configuration', { key: CONFIG_KEY, value: { version: 1, scriptId }, presentation: { label: '编剧' } })
    this.attach(agent)
  }
  /** Validation creates no durable state: the returned metadata freezes only with inbox insertion. */
  admit(agent: Agent, message: InputMessage): InputMessage {
    const state = writerState(agent.session)
    if (state.mode !== PRESET) return message
    const scriptId = state.fixed?.scriptId ?? state.preparation?.scriptId
    if (!scriptId) throw new WriterSessionError('unconfigured', 'select a script workspace')
    this.target(scriptId)
    if (state.fixed) { this.attach(agent); return message }
    const choice = state.preparation?.writer
    if (!choice) throw new WriterSessionError('unconfigured', 'select a writer')
    const writer = this.services.writers.get(choice.id)
    if (writer.sequence !== choice.sequence) throw new WriterSessionError('conflict', 'writer configuration changed; reload and select it again')
    const fixed: FixedWriter = { version: 1, originSessionId: agent.id, scriptId, writer }
    this.attach(agent)
    return { ...message, source: { ...message.source, admission: { ...message.source.admission, [CONFIG_KEY]: fixed } } }
  }
  /** An Agent owns observations and registrations; the standing preset owns neither. */
  attach(agent: Agent): void {
    const state = writerState(agent.session), scriptId = state.fixed?.scriptId ?? state.preparation?.scriptId
    const existing = this.runtimes.get(agent)
    if (state.mode !== PRESET) { existing?.dispose(); this.runtimes.delete(agent); return }
    if (existing?.scriptId === scriptId && existing) return
    existing?.dispose()
    const observations = new StoryObservations(), disposers: Dispose[] = []
    let disposed = false
    const dispose = () => { if (disposed) return; disposed = true; for (const remove of disposers.splice(0).reverse()) remove(); observations.clear(); this.runtimes.delete(agent) }
    try {
      disposers.push(...configureLiteralPrompt(agent, 'papermoon_writer_prompt', () => {
        const fixed = writerState(agent.session).fixed
        if (!fixed) throw new WriterSessionError('unconfigured', 'writer input has not been accepted')
        return fixed.writer.systemPrompt
      }))
      disposers.push(agent.ctx.tools.presentAs('native'))
      if (scriptId) for (const tool of createStoryTools(this.services.core, scriptId as ScriptId, observations, this.services.compiler))
        disposers.push(agent.ctx.tools.register({ ...tool, execute: async (...args) => {
          this.target(scriptId)
          if (writerState(agent.session).mode !== PRESET) throw new WriterSessionError('wrong-mode', 'writer mode is required')
          return tool.execute(...args)
        } }))
      disposers.push(agent.ctx.on('agent/pre-step', async (_payload, next) => {
        const fixed = writerState(agent.session).fixed
        if (!fixed) throw new WriterSessionError('unconfigured', 'writer input has not been accepted')
        this.target(fixed.scriptId)
        const decision = await next()
        if (decision.kind === 'reject') return decision
        const candidates = initialContext(fixed.originSessionId, fixed.writer)
        return { ...decision, initialMessages: [...(decision.initialMessages ?? []), ...candidates] }
      }))
      this.runtimes.set(agent, { scriptId, observations, dispose })
      agent.ctx.effect(() => dispose, 'papermoon.writer-runtime')
    } catch (error) { dispose(); throw error }
  }
  dispose(): void { for (const runtime of this.runtimes.values()) runtime.dispose() }
  private workspaces() { return new StoryWorkspaces(this.host, this.services.core, this.cwd) }
  scripts() { return this.workspaces().scripts() }
  async refreshWorkspaceTitles(): Promise<void> { for (const workspace of this.host.workspaceRegistry.list()) await this.workspaces().refreshTitle(workspace) }
  workspace(scriptId: string) { return this.workspaces().workspace(scriptId) }
}
