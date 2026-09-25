/** Plugin-owned text conversations use DSH Agents and their durable Session logs. */
import { randomUUID } from 'node:crypto'
import type { ConversationView, EventRecord, ModelChoice, ModelInfo } from './types.ts'

type Dispose = () => void | Promise<void>
export interface AgentScope {
  systemPrompt: { section(section: { name: string; order: number; text: string; complete: boolean }): Dispose; suppressRuntimeContext(): Dispose }
  tools: { restrict(filter: { allow: string[] }): Dispose; presentAs(mode: 'native'): Dispose }
  on(name: 'agent/request', listener: (payload: unknown, next: () => Promise<ModelChoice>) => Promise<ModelChoice>): Dispose
  on(name: 'agent/request-messages', listener: (payload: { turn: number; step: number }, next: () => Promise<number | undefined>) => Promise<number | undefined>): Dispose
}
export interface TextAgent {
  id: string; status: string
  session: { snapshotEvents(): readonly EventRecord[]; deriveRequestMessages(seq: number): unknown[]; append(type: string, data: unknown): { seq: number } }
  followup(message: { id: string; role: 'user'; content: { type: 'text'; text: string }[]; source: { kind: 'user' } }): void
  cancel(cause: { kind: 'user' }): void
  whenIdle(): Promise<void>
}
export interface AgentHandle { agent: TextAgent; dispose(): Promise<void> }
/** Pass the consuming plugin's traced Agent registry to bind lifetime to that owner. */
export interface AgentOwner {
  agents: {
    create(options: { sessionId: string; agentOptions: Partial<ModelChoice>; seed?: readonly EventRecord[]; setup(scope: AgentScope, agent: TextAgent): void }): Promise<AgentHandle>
    resume(options: { resumeSessionId: string; agentOptions: Partial<ModelChoice>; setup(scope: AgentScope, agent: TextAgent): void }): Promise<AgentHandle>
  }
}
export interface TextHost {
  agentDefaultModel?: { currentSelection(): ModelChoice }
  sessionController?: { expose(agent: TextAgent, options: { readOnly: boolean; beforePrompt?: (request: { content: readonly { type: string }[] }) => Promise<void> }): () => void }

  llm: {
    listProviders(): { id: string }[]
    listModels(provider: string): Promise<{ provider: string; id: string; name: string }[]>
    resolveModelInfo(provider: string, model: string): Promise<Omit<ModelInfo, 'ready'>>
    listConfigurableProviders(): { provider: string; settingsNs: string; settingsPath: readonly string[]; error?: string }[]
  }
  settings: { describe(options: { redactSecrets: true }): { ns: string; value: unknown }[] }
  credentials: { describe(ref: string): Promise<{ configured: boolean }> }
  sessions: { flush(session: TextAgent['session']): Promise<boolean> }
}
export class TextConversation {
  constructor(readonly handle: AgentHandle, private choice: ModelChoice | undefined, private readonly host: TextHost, private readonly native = false) {}
  get agent() { return this.handle.agent }
  view(): ConversationView {
    const events = this.agent.session.snapshotEvents()
    const end = events.find(event => event.type === 'turn/end' && (event.data.reason as { kind?: string } | undefined)?.kind === 'completed')
    return { id: this.agent.id, choice: this.selected(), events, running: this.agent.status === 'running', ...(end ? { successfulTurn: end.data.turn as number } : {}) }
  }
  /** Selection is request-local; changes are refused while this Agent is running. */
  select(choice: ModelChoice) {
    if (this.agent.status !== 'idle') throw new Error('conversation is busy')
    this.choice = { ...choice }
    if (this.native) this.agent.session.append('model/selection', this.choice)
  }
  selected(): ModelChoice | undefined {
    if (this.native) {
      const event = this.agent.session.snapshotEvents().findLast(event => event.type === 'model/selection' || event.type === 'request/header')
      const selected = event?.type === 'model/selection' ? event.data : (event?.data.header as { config?: ModelChoice } | undefined)?.config
      if (selected && typeof selected.provider === 'string' && typeof selected.model === 'string') return { provider: selected.provider, model: selected.model, ...(typeof selected.reasoningEffort === 'string' ? { reasoningEffort: selected.reasoningEffort } : {}) }
    }
    return this.choice ?? (this.native ? this.host.agentDefaultModel?.currentSelection() : undefined)
  }
  async send(text: string) {
    if (!text.trim()) throw new Error('text must not be empty')
    if (this.agent.status !== 'idle') throw new Error('conversation is busy')
    this.agent.followup({ id: randomUUID(), role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } })
    await this.host.sessions.flush(this.agent.session)
  }
  stop() { this.agent.cancel({ kind: 'user' }) }
  async flush() { await this.host.sessions.flush(this.agent.session) }
  async dispose() { await this.handle.dispose() }
  /** Inspect the original request position, never the current selection. */
  request(turn: number, step: number) {
    const events = this.agent.session.snapshotEvents()
    const request = events.find(event => event.type === 'request/messages' && event.data.turn === turn && event.data.step === step)
    if (!request) throw new Error('request is unavailable')
    const header = events.slice(0, request.seq + 1).findLast(event => event.type === 'request/header')
    const result = events.slice(request.seq + 1).find(event => ['assistant/message', 'assistant/attempt', 'turn/end'].includes(event.type))
    return { messages: this.agent.session.deriveRequestMessages(request.seq), header: header?.data, result: result?.data }
  }
}
export class TextConversations {
  constructor(private readonly host: TextHost) {}
  defaultSelection(): ModelChoice | undefined { return this.host.agentDefaultModel?.currentSelection() }
  /** Read configured routes and credential availability without making an inference request. */
  async models(): Promise<ModelInfo[]> {
    const directory = this.host.llm.listConfigurableProviders()
    const settings = this.host.settings.describe({ redactSecrets: true })
    const groups = await Promise.all(this.host.llm.listProviders().map(async provider => {
      const entry = directory.find(row => row.provider === provider.id)
      let ready = !entry?.error
      if (entry) {
        let config = settings.find(row => row.ns === entry.settingsNs)?.value
        for (const part of entry.settingsPath) config = config && typeof config === 'object' ? (config as Record<string, unknown>)[part] : undefined
        if (config === undefined) ready = false
        const ref = config && typeof config === 'object' ? (config as { apiKeyEnv?: unknown }).apiKeyEnv : undefined
        if (typeof ref === 'string') ready = ready && (await this.host.credentials.describe(ref)).configured
      }
      const models = await this.host.llm.listModels(provider.id)
      return Promise.all(models.map(async model => ({ ...await this.host.llm.resolveModelInfo(provider.id, model.id), ready })))
    }))
    return groups.flat()
  }
  async validate(choice: ModelChoice): Promise<ModelChoice> {
    const model = (await this.models()).find(model => model.provider === choice.provider && model.id === choice.model)
    if (!model?.ready) throw new Error('model configuration is incomplete')
    if (!model.reasoning?.efforts.length) return { provider: choice.provider, model: choice.model }
    if (choice.reasoningEffort !== undefined && !model.reasoning.efforts.some(effort => effort.id === choice.reasoningEffort)) throw new Error('effort is unavailable for this model')
    return { ...choice }
  }
  /** Compose a tool-free Agent. Native callers may omit choice and use the native model selector. */
  async open(owner: AgentOwner, input: { id: string; resume: boolean; title?: string; prompt: string; choice?: ModelChoice; native?: { readOnly: boolean; beforePrompt?: () => Promise<void> }; seed?: readonly EventRecord[] }): Promise<TextConversation> {
    let conversation: TextConversation | undefined
    const choice = input.choice
    const setup = (scope: AgentScope, agent: TextAgent) => {
      scope.systemPrompt.section({ name: 'text-conversation', order: 0, text: input.prompt, complete: true })
      scope.systemPrompt.suppressRuntimeContext()
      scope.tools.restrict({ allow: [] })
      scope.tools.presentAs('native')
      if (!input.native) scope.on('agent/request', async (_payload, next) => {
        const { reasoningEffort: _inherited, ...config } = await next()
        return { ...config, ...(conversation?.selected() ?? choice) }
      })
      // A DSH request boundary pins ordinary history without copying messages or changing selection.
      scope.on('agent/request-messages', async ({ turn, step }, next) =>
        await next() ?? agent.session.append('request/messages', { version: 1, turn, step, messages: null }).seq)
    }
    const handle = input.resume
      ? await owner.agents.resume({ resumeSessionId: input.id, agentOptions: choice ?? {}, setup })
      : await owner.agents.create({ sessionId: input.id, agentOptions: choice ?? {}, ...(input.seed ? { seed: input.seed } : {}), setup })
    conversation = new TextConversation(handle, choice, this.host, !!input.native)
    if (input.native) {
      if (!this.host.sessionController) { await handle.dispose(); throw new Error('native session controller is unavailable') }
      this.host.sessionController.expose(handle.agent, { readOnly: input.native.readOnly, beforePrompt: async request => {
        if (request.content.some(block => block.type !== 'text')) throw new Error('this conversation accepts text only')
        await input.native?.beforePrompt?.()
      } })
      if (!input.resume && !input.native.readOnly && choice) handle.agent.session.append('model/selection', choice)
    }
    if (input.title && !handle.agent.session.snapshotEvents().some(event => event.type === 'session/title')) {
      handle.agent.session.append('session/title', { title: input.title, messageSeqs: [], source: { kind: 'user' } })
    }
    await this.host.sessions.flush(handle.agent.session)
    return conversation
  }
}
