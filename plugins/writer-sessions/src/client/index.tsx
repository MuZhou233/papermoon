/** Client registrations depend on public services and slots, never DSH component implementations. */
import { Runtime, type ClientHost } from './runtime.ts'
import { ScriptPicker, WriterPicker } from './controls.tsx'
import { contextDefinition, ContextGroup } from './context.tsx'
import { en, zh } from './locales.ts'
import './style.css'
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces', 'uiAgentPreset', 'conversation', 'uiConversation', 'layout']
interface Host extends ClientHost { uiConversation: { events: { register(definition: typeof contextDefinition): () => void } } }
export function apply(ctx: Host): void {
  const runtime = new Runtime(ctx)
  ctx.effect(() => ctx.locale.register('papermoon-writer-sessions', { en, zh }), 'papermoon.writer-session-copy')
  ctx.effect(() => {
    const sessions = ctx.sessions.list.subscribe(runtime.observe), modes = ctx.uiAgentPreset.store.subscribe(runtime.observe)
    const focus = () => void runtime.refresh()
    window.addEventListener('focus', focus)
    void ctx.uiAgentPreset.load().then(runtime.observe)
    runtime.observe()
    return () => { sessions(); modes(); window.removeEventListener('focus', focus); runtime.dispose() }
  }, 'papermoon.writer-session-client')
  for (const [name, component] of [['conversation.hero.target', ScriptPicker], ['conversation.hero.options', WriterPicker]] as const)
    ctx.slots.inject(name, () => ctx.slots.register({ name, id: 'papermoon-writer', locale: 'papermoon-writer-sessions', inject: () => ({ runtime }) }, component))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'papermoon-writer', locale: 'papermoon-writer-sessions', inject: () => ({ runtime, active: true }) }, WriterPicker))
  ctx.effect(() => ctx.uiConversation.events.register(contextDefinition), 'papermoon.writer-context-nodes')
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'papermoon-writer-context', locale: 'papermoon-writer-sessions' }, ContextGroup))
}
