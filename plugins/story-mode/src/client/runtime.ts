import type { StoryView } from '../service.ts'
import type { ModelCatalog, ModelSelection } from '../../../performances/src/service.ts'
import type { StoryMode } from '../service.ts'
export interface Connection { rpc: { call(channel: string, method: string, payload: unknown, signal?: AbortSignal): Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }> } }
export interface Snapshot { id?: string; view?: StoryView; error?: string; busy: boolean; unread: boolean; hint: 'open-guide' | 'operation' | null; review?: Awaited<ReturnType<StoryMode['review']>>; models?: ModelCatalog }
export class Runtime {
  private value: Snapshot = { busy: false, unread: false, hint: null }
  private listeners = new Set<() => void>()
  private generation = 0
  readonly abort = new AbortController()
  getSnapshot = () => this.value
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  constructor(readonly connection: Connection, readonly navigate: (id: string) => void, readonly openSession: (id: string) => void,
    readonly openGuide: () => void, readonly collapse: () => void, readonly savePending: (id: string) => Promise<void>, readonly openSettings: () => void) {}
  update(value: Partial<Snapshot>) { this.value = { ...this.value, ...value }; for (const listener of this.listeners) listener() }
  async call<T>(method: string, payload: unknown = {}): Promise<T> {
    const result = await this.connection.rpc.call('/api', 'papermoon-story/' + method, payload, this.abort.signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value as T
  }
  async context(id?: string) {
    if (id === this.value.id) return
    this.generation++
    this.update({ id, view: undefined, review: undefined, error: undefined, hint: null, unread: false, busy: false, models: undefined })
    await this.refresh()
  }
  private mark(view: StoryView) {
    if (this.value.view && view.sequence < this.value.view.sequence) return
    const progress = JSON.stringify(view.progress)
    const seen = localStorage.getItem('papermoon.story.seen/' + view.playbook.id)
    if (this.value.view && JSON.stringify(this.value.view.progress) !== progress) window.dispatchEvent(new Event('papermoon:progress'))
    this.update({ view, unread: progress !== seen })
  }
  async refresh() {
    const { id, busy } = this.value, generation = this.generation
    if (!id || busy || this.abort.signal.aborted) return
    try {
      const view = await this.call<StoryView>('state', { playbookId: id })
      if (generation === this.generation) this.mark(view)
    } catch (error) { if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : String(error) }) }
  }
  seen() {
    if (this.value.hint === 'open-guide') this.update({ hint: null })
    if (!this.value.view || !this.value.unread) return
    localStorage.setItem('papermoon.story.seen/' + this.value.view.playbook.id, JSON.stringify(this.value.view.progress))
    this.update({ unread: false })
  }
  async enter(id: string, created = false) {
    await this.context(id)
    if (this.value.id !== id) return
    this.navigate(id)
    if (created) { this.collapse(); this.update({ hint: 'open-guide' }) }
    else this.openGuide()
  }
  async action(kind: 'advance' | 'start' | 'retry' | 'review') {
    const id = this.value.id, generation = this.generation
    if (!id || this.value.busy) return
    this.update({ busy: true, error: undefined })
    try {
      if (kind === 'advance' || kind === 'start') await this.savePending(id)
      const view = await this.call<StoryView>('state', { playbookId: id })
      if (generation !== this.generation) return
      if (kind === 'review') { const review = await this.call<Snapshot['review']>('review', { playbookId: id }); if (generation === this.generation) this.update({ review }) }
      else if (kind === 'start') {
        const result = await this.call<{ sessionId: string }>('start', { playbookId: id, expectedSequence: view.sequence })
        if (generation === this.generation) this.openSession(result.sessionId)
      } else { const result = await this.call<StoryView>(kind, { playbookId: id, ...(kind === 'advance' ? { section: view.progress.section, expectedSequence: view.sequence } : {}) }); if (generation === this.generation) this.mark(result) }
    } catch (error) { if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : String(error) }) }
    finally { if (generation === this.generation) this.update({ busy: false }) }
  }
  async models() { const generation = this.generation; try { const models = await this.call<ModelCatalog>('models'); if (generation === this.generation) this.update({ models }) } catch (error) { if (generation === this.generation) this.update({ error: String(error) }) } }
  async choose(choice: ModelSelection) {
    const id = this.value.id, generation = this.generation
    if (!id) return
    this.update({ busy: true, error: undefined })
    try { const view = await this.call<StoryView>('choose', { playbookId: id, choice }); if (generation === this.generation) this.mark(view) } catch (error) { if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : String(error) }) }
    finally { if (generation === this.generation) this.update({ busy: false }) }
  }
  locate() { this.update({ hint: 'operation' }); if (this.value.view?.progress.started) { this.openSession(this.value.view.progress.sessionId!); if (innerWidth < 760) this.collapse() } else if ((this.value.view?.progress.section ?? 1) > 1) { if (this.value.id) this.navigate(this.value.id); if (innerWidth < 760) this.collapse() } }
  dispose() { this.abort.abort(); this.listeners.clear() }
}
