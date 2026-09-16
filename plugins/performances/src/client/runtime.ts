import type { ComponentType } from 'react'
import type { Performances } from '../service.ts'
import { PRESET, ACTION_KEY } from '../constants.ts'
import type { T } from './locales.ts'
export interface Observable<T> { getSnapshot(): T; subscribe(listener: () => void): () => void }
interface EventWindow { historySelection?: { version: number }; change: { kind: string; entries?: readonly { event: { type: string; data: unknown } }[] } }
export interface ClientHost {
  chatPresentation: { preserveReplies(preset: string): () => void; preserveUserInputs(producer: string): () => void }
  connection: { rpc: { call(channel: string, method: string, payload: unknown, signal?: AbortSignal): Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string; code: string } }> } }
  sessions: { list: Observable<{ current?: string; byId: Record<string, { blank: boolean; projectionValues?: { agentPreset?: string } } | undefined> }>; refresh(): Promise<void>; open(id: string): void; binding(id: string): { ctx: unknown; session: Observable<{ running: boolean }>; eventSource: Observable<EventWindow> } | undefined }
  uiAgentPreset: { store: Observable<{ current: string; busy: boolean }>; load(): Promise<void> }
  conversation: { blocks: { set(id: string, block: { reason: string; submissionOnly?: boolean } | undefined, owner?: string): void } }
  layout: { selectPanel(id: string | null): void }
  locale: { register(ns: string, dictionaries: object): () => void; bind(ns: string): T }
  effect(body: () => () => void, label?: string): unknown
  slots: { inject(name: string, body: () => () => void): unknown; register<P>(options: { name: string; key?: string; id?: string; order?: number; label?: () => string; locale?: string; select?: (owner: { seq: number }, hooks: unknown) => object | null; inject?: () => object }, component: ComponentType<P>): () => void }
  uiConversation: { events: { register(definition: object): () => void } }
}
export type View = Awaited<ReturnType<Performances['view']>>
export class Runtime {
  readonly abort = new AbortController()
  private listeners = new Set<() => void>()
  private state: { sessionId?: string; view?: View; error?: string } = {}
  private generation = 0
  private observed = ''
  private followed?: string
  private stopEvents?: () => void
  private stopStatus?: () => void
  private refreshTimer?: ReturnType<typeof setTimeout>
  private blocked = new Set<string>()
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  readonly getSnapshot = () => this.state
  constructor(readonly host: ClientHost) {}
  async call<T>(method: string, payload: unknown = {}): Promise<T> {
    const result = await this.host.connection.rpc.call('/api', 'papermoon-performances/' + method, payload, this.abort.signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value as T
  }
  observe = () => {
    const list = this.host.sessions.list.getSnapshot(), mode = this.host.uiAgentPreset.store.getSnapshot().current
    const target = mode === PRESET ? list.current : undefined
    if (target !== this.followed) {
      this.stopEvents?.(); this.stopStatus?.(); this.stopEvents = undefined; this.stopStatus = undefined; this.followed = target
      const binding = target ? this.host.sessions.binding(target) : undefined
      const source = binding?.eventSource
      if (binding) this.stopStatus = binding.session.subscribe(() => this.publish(this.state))
      if (source) this.stopEvents = source.subscribe(() => {
        const change = source.getSnapshot().change
        if (change.kind === 'replace' || change.entries?.some(({event}) => event.type === 'history/selected' || event.type === 'turn/end' || (event.type === 'session/configuration' && (event.data as {key?: string}).key === ACTION_KEY))) this.scheduleRefresh()
      })
    }
    const identity = JSON.stringify([list.current, list.current && list.byId[list.current]?.blank, mode])
    if (identity !== this.observed) { this.observed = identity; this.scheduleRefresh() }
  }
  private scheduleRefresh() { clearTimeout(this.refreshTimer); this.refreshTimer = setTimeout(() => { void this.refresh() }, 150) }
  private publish(state: typeof this.state) {
    this.state = state
    for (const id of this.blocked) this.host.conversation.blocks.set(id, undefined, 'papermoon-performance')
    this.blocked.clear()
    if (state.sessionId && this.host.uiAgentPreset.store.getSnapshot().current === PRESET && !state.view?.fixed) {
      this.host.conversation.blocks.set(state.sessionId, { reason: state.error ?? this.host.locale.bind('papermoon-performances')('unavailable') }, 'papermoon-performance')
      this.blocked.add(state.sessionId)
    }
    const running = state.sessionId && this.host.sessions.binding(state.sessionId)?.session.getSnapshot().running
    if (state.sessionId && state.view?.worldline && (running || state.view.worldline.pending || state.view.worldline.legacy)) {
      const t = this.host.locale.bind('papermoon-performances')
      this.host.conversation.blocks.set(state.sessionId, { reason: t(state.view.worldline.legacy ? 'legacy' : 'generating'), submissionOnly: !state.view.worldline.legacy }, 'papermoon-performance')
      this.blocked.add(state.sessionId)
    }
    for (const listener of this.listeners) listener()
  }
  async refresh() {
    const generation = ++this.generation, sessionId = this.host.sessions.list.getSnapshot().current
    if (!sessionId || this.host.uiAgentPreset.store.getSnapshot().current !== PRESET) { this.publish({ sessionId }); return }
    this.publish({ sessionId, view: this.state.sessionId === sessionId ? this.state.view : undefined })
    try { const view = await this.call<View>('state', { sessionId }); if (generation === this.generation) this.publish({ sessionId, view }) }
    catch (error) { if (generation === this.generation && !this.abort.signal.aborted) this.publish({ sessionId, error: String(error) }) }
  }
  launch(scriptId?: string, revisionId?: string) { window.dispatchEvent(new CustomEvent('papermoon:performance', { detail: { scriptId, revisionId } })) }
  async open(sessionId: string) {
    await this.host.sessions.refresh()
    this.host.sessions.open(sessionId)
    this.host.layout.selectPanel(null)
    history.replaceState(null, '', '#conversation')
    await this.refresh()
  }
  async operation(kind: 'select' | 'candidate' | 'reroll' | 'edit', nodeId: string, edit?: { text: string; expectedVersion: number }) {
    const { sessionId, view } = this.state
    if (!sessionId || !view?.worldline) throw new Error('worldline unavailable')
    await this.call<Awaited<ReturnType<Performances['operation']>>>('operation', {
      sessionId, kind, nodeId, expectedVersion: edit?.expectedVersion ?? view.worldline.version, operationId: crypto.randomUUID(),
      ...(kind === 'edit' ? { text: edit!.text } : {}),
    })
    await this.refresh()
  }
  dispose() { this.stopEvents?.(); this.stopStatus?.(); clearTimeout(this.refreshTimer); this.abort.abort(); for (const id of this.blocked) this.host.conversation.blocks.set(id, undefined, 'papermoon-performance') }
}
