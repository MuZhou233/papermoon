import type { ComponentType } from 'react'
import type { Performances } from '../service.ts'
import { PRESET } from '../constants.ts'
import type { T } from './locales.ts'
export interface Observable<T> { getSnapshot(): T; subscribe(listener: () => void): () => void }
export interface ClientHost {
  connection: { rpc: { call(channel: string, method: string, payload: unknown, signal?: AbortSignal): Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string; code: string } }> } }
  sessions: { list: Observable<{ current?: string; byId: Record<string, { blank: boolean; projectionValues?: { agentPreset?: string } } | undefined> }>; refresh(): Promise<void>; open(id: string): void }
  uiAgentPreset: { store: Observable<{ current: string; busy: boolean }>; load(): Promise<void> }
  conversation: { blocks: { set(id: string, block: { reason: string } | undefined, owner?: string): void } }
  layout: { selectPanel(id: string | null): void }
  locale: { register(ns: string, dictionaries: object): () => void; bind(ns: string): T }
  effect(body: () => () => void, label?: string): unknown
  slots: { inject(name: string, body: () => () => void): unknown; register<P>(options: { name: string; key?: string; id?: string; locale?: string; inject?: () => object }, component: ComponentType<P>): () => void }
  uiConversation: { events: { register(definition: object): () => void } }
}
export type View = Awaited<ReturnType<Performances['view']>>
export class Runtime {
  readonly abort = new AbortController()
  private listeners = new Set<() => void>()
  private state: { sessionId?: string; view?: View; error?: string } = {}
  private generation = 0
  private observed = ''
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
    const identity = JSON.stringify([list.current, list.current && list.byId[list.current]?.blank, mode])
    if (identity !== this.observed) { this.observed = identity; void this.refresh() }
  }
  private publish(state: typeof this.state) {
    this.state = state
    for (const id of this.blocked) this.host.conversation.blocks.set(id, undefined, 'papermoon-performance')
    this.blocked.clear()
    if (state.sessionId && this.host.uiAgentPreset.store.getSnapshot().current === PRESET && !state.view?.fixed) {
      this.host.conversation.blocks.set(state.sessionId, { reason: state.error ?? this.host.locale.bind('papermoon-performances')('unavailable') }, 'papermoon-performance')
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
  dispose() { this.abort.abort(); for (const id of this.blocked) this.host.conversation.blocks.set(id, undefined, 'papermoon-performance') }
}
