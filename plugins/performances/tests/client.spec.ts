import { afterEach, expect, test, vi } from 'vitest'
import { Runtime, type ClientHost, type Observable } from '../src/client/runtime.ts'
import { ACTION_KEY, PRESET } from '../src/constants.ts'
function store<T>(value: T) {
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    set(next: T) { value = next; for (const listener of listeners) listener() },
    listeners,
  }
}
type Value<T> = T extends Observable<infer V> ? V : never
type EventStore = NonNullable<ReturnType<ClientHost['sessions']['binding']>>['eventSource']
afterEach(() => { vi.useRealTimers() })
test('refreshes action commits without list activity, follows the selected session and releases subscriptions', async () => {
  vi.useFakeTimers()
  const list = store<Value<ClientHost['sessions']['list']>>({ current: 'a', byId: { a: { blank: false }, b: { blank: false } } })
  const mode = store({ current: PRESET, busy: false })
  const a = store<Value<EventStore>>({ change: { kind: 'replace', entries: [] } }), b = store<Value<EventStore>>({ change: { kind: 'replace', entries: [] } })
  const status = store({ running: false }), block = vi.fn()
  let count = 0
  const call = vi.fn(async () => ({ ok: true as const, value: { fixed: {}, worldline: { legacy: false, pending: undefined }, runtime: { state: { count }, actions: [] } } }))
  const host: ClientHost = {
    chatPresentation: { preserveReplies: () => () => {}, preserveUserInputs: () => () => {} },
    connection: { rpc: { call } }, sessions: { list, refresh: async () => {}, open: () => {}, binding: id => ({ ctx: {}, session: status, eventSource: id === 'a' ? a : b }) },
    uiAgentPreset: { store: mode, load: async () => {} }, conversation: { blocks: { set: block } }, layout: { selectPanel: () => {} },
    locale: { register: () => () => {}, bind: () => key => key }, effect: () => {},
    slots: { inject: () => {}, register: () => () => {} }, uiConversation: { events: { register: () => () => {} } },
  }
  const runtime = new Runtime(host)
  try {
    runtime.observe(); await vi.advanceTimersByTimeAsync(150)
    expect(runtime.getSnapshot().view?.runtime?.state).toEqual({ count: 0 })
    status.set({ running: true })
    expect(block).toHaveBeenLastCalledWith('a', { reason: 'generating', submissionOnly: true }, 'papermoon-performance')
    status.set({ running: false })
    count = 3
    a.set({ change: { kind: 'append', entries: [{ event: { type: 'session/configuration', data: { key: ACTION_KEY } } }] } })
    await vi.advanceTimersByTimeAsync(150)
    expect(runtime.getSnapshot().view?.runtime?.state).toEqual({ count: 3 })
    expect(call).toHaveBeenCalledTimes(2)
    a.set({ change: { kind: 'append', entries: [{ event: { type: 'assistant/live-chunk', data: {} } }] } })
    await vi.advanceTimersByTimeAsync(150)
    expect(call).toHaveBeenCalledTimes(2)
    list.set({ ...list.getSnapshot(), current: 'b' }); runtime.observe(); await vi.advanceTimersByTimeAsync(150)
    expect(a.listeners.size).toBe(0); expect(b.listeners.size).toBe(1)
    count = 5; b.set({ change: { kind: 'replace', entries: [] } }); await vi.advanceTimersByTimeAsync(150)
    expect(runtime.getSnapshot().view?.runtime?.state).toEqual({ count: 5 })
    expect(call).toHaveBeenCalledTimes(4)
  } finally { runtime.dispose() }
  expect(a.listeners.size + b.listeners.size + status.listeners.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})
