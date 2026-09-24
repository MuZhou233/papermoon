import type { ComponentType } from 'react'
import type { WriterSessions } from '../service.ts'
import { PRESET } from '../model.ts'
import type { T } from './locales.ts'
export interface Observable<T> { getSnapshot(): T; subscribe(listener: () => void): () => void }
export type View = ReturnType<WriterSessions['view']>
export interface ClientHost {
  connection: { rpc: { call(channel: string, method: string, payload: unknown, signal?: AbortSignal): Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string; code: string } }> } }
  sessions: { list: Observable<{ byId: Record<string, { blank: boolean; projectionValues?: { agentPreset?: string } } | undefined> }>; binding(id: string): { ctx: { effect(body: () => (() => void | Promise<void>), label?: string): () => Promise<void> } } | undefined }
  workspaces: { list: Observable<{ items: readonly { workspaceId: string }[] }> }
  uiAgentPreset: { binding(sessionId?: string): { store: Observable<{ current: string; busy: boolean }>; load(): Promise<void> } }
  conversation: { blocks: { set(id: string, block: { reason: string } | undefined, owner?: string): void } }
  layout: { selectPanel(id: string | null): void }
  locale: { register(ns: string, dictionaries: object): () => void; bind(ns: string): T }
  effect(body: () => (() => void | Promise<void>), label?: string): () => Promise<void>
  slots: { inject(name: string, body: () => () => void): unknown; register<P>(options: { name: string; key?: string; id?: string; locale?: string; inject?: (sessionId?: string) => object }, component: ComponentType<P>): () => void }
}
interface State { sessionId?: string; view?: View; busy: boolean; error?: string }
export class Runtime {
  readonly abort = new AbortController()
  private listeners = new Set<() => void>()
  private state: State = { busy: false }
  private generation = 0
  private observed = ''
  private blocked = new Set<string>()
  readonly getSnapshot = () => this.state
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  readonly preset: ReturnType<ClientHost['uiAgentPreset']['binding']>
  constructor(readonly host: ClientHost, readonly sessionId?: string) { this.preset = host.uiAgentPreset.binding(sessionId) }
  private publish(state: State) { this.state = state; this.block(); for (const listener of this.listeners) listener() }
  async call<T>(method: string, payload: unknown = {}): Promise<T> {
    const response = await this.host.connection.rpc.call('/api', `papermoon-writer-sessions/${method}`, payload, this.abort.signal)
    if (!response.ok) throw Object.assign(new Error(response.error.message), { code: response.error.code })
    return response.value as T
  }
  observe = () => {
    const list = this.host.sessions.list.getSnapshot(), id = this.sessionId, summary = id ? list.byId[id] : undefined
    const identity = JSON.stringify([id, summary?.blank, summary?.projectionValues?.agentPreset, this.preset.store.getSnapshot().current])
    if (identity === this.observed) return
    this.observed = identity
    void this.refresh()
  }
  async refresh() {
    const generation = ++this.generation, id = this.sessionId
    const mode = this.preset.store.getSnapshot().current
    if (!id || mode !== PRESET) { this.publish({ sessionId: id, busy: false }); return }
    this.publish({ ...this.state, sessionId: id, ...(this.state.sessionId === id ? {} : { view: undefined }), busy: true, error: undefined })
    try {
      const view = await this.call<View>('state', { sessionId: id })
      if (generation === this.generation) this.publish({ sessionId: id, view, busy: false })
    } catch (error) { if (generation === this.generation && !this.abort.signal.aborted) this.publish({ sessionId: id, busy: false, error: String(error) }) }
  }
  async configure(id: string, sequence: number) {
    const sessionId = this.state.sessionId
    if (!sessionId) return
    const generation = ++this.generation
    this.publish({ ...this.state, busy: true, error: undefined })
    try {
      const view = await this.call<View>('configure', { sessionId, writerId: id, writerSequence: sequence })
      if (generation === this.generation) this.publish({ sessionId, view, busy: false })
    } catch (error) { if (generation === this.generation) this.publish({ ...this.state, busy: false, error: String(error) }) }
  }
  async workspace(playbookId: string): Promise<string> {
    const { workspaceId } = await this.call<{ workspaceId: string }>('workspace', { playbookId })
    const source = this.host.workspaces.list
    if (source.getSnapshot().items.some(item => item.workspaceId === workspaceId)) return workspaceId
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { stop(); clearTimeout(timer); this.abort.signal.removeEventListener('abort', canceled) }
      const canceled = () => { cleanup(); reject(this.abort.signal.reason) }
      const check = () => { if (source.getSnapshot().items.some(item => item.workspaceId === workspaceId)) { cleanup(); resolve() } }
      const stop = source.subscribe(check)
      const timer = setTimeout(() => { cleanup(); reject(new Error('workspace stream did not acknowledge creation')) }, 10000)
      this.abort.signal.addEventListener('abort', canceled, { once: true })
      check()
    })
    return workspaceId
  }
  private block() {
    const { sessionId, view, busy, error } = this.state, t = this.host.locale.bind('papermoon-writer-sessions')
    for (const id of this.blocked) if (id !== sessionId) { this.host.conversation.blocks.set(id, undefined, 'papermoon-writer'); this.blocked.delete(id) }
    if (!sessionId) return
    const writerMode = this.preset.store.getSnapshot().current === PRESET
    const reason = !writerMode ? undefined : error ? error : busy ? t('loading') : view?.targetMissing ? t('missing') : !view?.fixed && !view?.preparation?.writer ? t('required') : undefined
    this.host.conversation.blocks.set(sessionId, reason ? { reason } : undefined, 'papermoon-writer')
    if (reason) this.blocked.add(sessionId); else this.blocked.delete(sessionId)
  }
  dispose() { this.abort.abort(); for (const id of this.blocked) this.host.conversation.blocks.set(id, undefined, 'papermoon-writer'); this.blocked.clear() }
  manage() { history.pushState(null, '', '#writers'); this.host.layout.selectPanel('writers') }
}
