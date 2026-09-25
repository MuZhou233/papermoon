import type { Attempt } from '../state.ts'
import type { ConversationView, ModelChoice, ModelInfo } from '../../../text-conversations/src/types.ts'
import { StoryError, type StoryErrorKey, type StoryFailure } from '../errors.ts'
export interface Snapshot {
  attempt?: Attempt; conversation?: ConversationView; example?: ConversationView; models: readonly ModelInfo[]
  modelsStatus: 'loading' | 'ready' | 'error'
  active: boolean; navigation: number; guideDismissed: boolean; choice?: ModelChoice; busy: boolean; error?: StoryFailure
}
export interface Connection {
  rpc: { call(channel: string, method: string, payload: unknown, signal: AbortSignal): Promise<{ ok: true; value: unknown } | { ok: false; error: { code?: string; message: string } }> }
}
type State = { attempt: Attempt; conversation?: ConversationView; example?: ConversationView }
const errorKeys: readonly StoryErrorKey[] = ['disabled', 'staleAttempt', 'notReady', 'wrongStep', 'practiceNotReady', 'exampleNotReady', 'cannotSend', 'configurationMissing']
function failure(error: unknown): StoryFailure { return error instanceof StoryError ? { key: error.key, message: error.message } : { message: error instanceof Error ? error.message : String(error) } }
export class Runtime {
  private state: Snapshot = { models: [], modelsStatus: 'loading', active: false, navigation: 0, guideDismissed: false, busy: false }
  private listeners = new Set<() => void>()
  readonly lifetime = new AbortController()
  private poll: ReturnType<typeof setTimeout> | undefined
  private refreshing = false
  private revision = 0
  private settingsSection: string | undefined
  constructor(private readonly connection: Connection, readonly show: () => void, readonly openSettings: () => boolean, readonly activeChanged: (active: boolean) => void) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(value: Partial<Snapshot>) {
    if (value.attempt && (value.attempt.id !== this.state.attempt?.id || value.attempt.step !== this.state.attempt?.step)) value.guideDismissed = false
    this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener() }
  async call<T>(method: string, payload: unknown): Promise<T> {
    const result = await this.connection.rpc.call('/api', 'papermoon-story/' + method, payload, this.lifetime.signal)
    if (!result.ok) {
      const key = errorKeys.find(key => result.error.code === 'story/' + key)
      throw key ? new StoryError(key) : new Error(result.error.message)
    }
    return result.value as T
  }
  async refresh() {
    if (this.refreshing || this.state.busy || this.lifetime.signal.aborted) return
    this.refreshing = true
    const revision = this.revision
    try {
      const [state, models] = await Promise.allSettled([
        this.call<State>('state', { resume: this.state.active }),
        this.call<ModelInfo[]>('models', {}),
      ])
      if (this.lifetime.signal.aborted || revision !== this.revision) return
      this.update({
        ...(state.status === 'fulfilled' ? { ...state.value, choice: state.value.conversation?.choice, error: undefined } : { error: failure(state.reason) }),
        ...(models.status === 'fulfilled' ? { models: models.value, modelsStatus: 'ready' } : { models: [], modelsStatus: 'error' }),
      })
    } finally { this.refreshing = false }
  }
  retry = () => { this.update({ modelsStatus: 'loading' }); void this.refresh() }
  start() {
    const tick = async () => { await this.refresh(); if (!this.lifetime.signal.aborted) this.poll = setTimeout(tick, this.state.active ? 750 : 3000) }
    void tick()
  }
  enter() { sessionStorage.setItem('papermoon.story.active', 'hello-world'); this.activeChanged(true); this.update({ active: true, navigation: this.state.navigation + 1 }); history.replaceState(null, '', '#story-mode/hello-world'); void this.refresh() }
  leave() { sessionStorage.removeItem('papermoon.story.active'); this.update({ active: false }); this.activeChanged(false); history.replaceState(null, '', '#story-mode'); this.show() }
  dismissGuide = () => this.update({ guideDismissed: true })
  showGuide = () => this.update({ guideDismissed: false })
  async act(action: string) {
    if (!this.state.attempt) return
    this.revision++
    this.update({ busy: true, error: undefined })
    try {
      const value = await this.call<State>('act', { id: this.state.attempt.id, action })
      this.update({ ...value, choice: value.conversation?.choice, ...(action === 'restart' ? { modelsStatus: 'loading' } : {}) })
    } catch (error) { this.update({ error: failure(error) }) }
    finally { this.update({ busy: false }); void this.refresh() }
  }
  settingsDisplayed = (section: string | undefined) => {
    const wasModels = this.settingsSection === 'models'
    this.settingsSection = section
    if (this.state.active && this.state.attempt?.step === 1 && (wasModels || section === 'models')) this.retry()
  }
  dispose() { this.lifetime.abort(); clearTimeout(this.poll); sessionStorage.removeItem('papermoon.story.active'); this.update({ active: false }); this.activeChanged(false) }
}
