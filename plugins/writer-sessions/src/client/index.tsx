/** Client registrations depend on public services and slots, never DSH component implementations. */
import { Runtime, type ClientHost } from './runtime.ts'
import { PlaybookPicker, WriterPicker } from './controls.tsx'
import { contextDefinition, ContextGroup } from './context.tsx'
import { en, zh } from './locales.ts'
import './style.css'
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces', 'uiAgentPreset', 'conversation', 'uiConversation', 'layout']
interface Host extends ClientHost { uiConversation: { events: { register(definition: typeof contextDefinition): () => void } } }
export function apply(ctx: Host): void {
  ctx.effect(() => ctx.locale.register('papermoon-writer-sessions', { en, zh }), 'papermoon.writer-session-copy')
  const boundDisposers = new Set<() => Promise<void>>()
  ctx.effect(() => async () => { await Promise.all([...boundDisposers].map(dispose => dispose())) })
  const runtimes = new Map<object | undefined, Runtime>()
  const runtimeFor = (sessionId?: string) => {
    const binding = sessionId === undefined ? undefined : ctx.sessions.binding(sessionId)
    const previous = runtimes.get(binding)
    if (previous) return previous
    const runtime = new Runtime(ctx, sessionId)
    runtimes.set(binding, runtime)
    const dispose = (binding?.ctx ?? ctx).effect(() => {
      const sessions = ctx.sessions.list.subscribe(runtime.observe), modes = runtime.preset.store.subscribe(runtime.observe)
      const focus = () => void runtime.refresh()
      window.addEventListener('focus', focus)
      void runtime.preset.load().then(runtime.observe)
      runtime.observe()
      return () => { sessions(); modes(); window.removeEventListener('focus', focus); runtime.dispose(); runtimes.delete(binding); boundDisposers.delete(dispose) }
    }, 'papermoon.writer-session-client')
    if (binding) boundDisposers.add(dispose)
    return runtime
  }
  for (const [name, component] of [['conversation.hero.target', PlaybookPicker], ['conversation.hero.options', WriterPicker]] as const)
    ctx.slots.inject(name, () => ctx.slots.register({ name, id: 'papermoon-writer', locale: 'papermoon-writer-sessions', inject: sessionId => ({ runtime: runtimeFor(sessionId) }) }, component))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'papermoon-writer', locale: 'papermoon-writer-sessions', inject: sessionId => ({ runtime: runtimeFor(sessionId), active: true }) }, WriterPicker))
  ctx.effect(() => ctx.uiConversation.events.register(contextDefinition), 'papermoon.writer-context-nodes')
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'papermoon-writer-context', locale: 'papermoon-writer-sessions' }, ContextGroup))
}
