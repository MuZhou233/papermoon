import { useSyncExternalStore } from 'react'
import { Button } from '@papermoon/ui'
import { PRESET } from '../constants.ts'
import { Runtime, type ClientHost } from './runtime.ts'
import { Launch } from './launch.tsx'
import { Opening, openingDefinition, initializationDefinition } from './context.tsx'
import { en, zh, type T } from './locales.ts'
import './style.css'
export const inject = ['slots', 'locale', 'connection', 'sessions', 'uiAgentPreset', 'conversation', 'uiConversation', 'layout']
function StartButton({ runtime, t }: { runtime: Runtime; t: T }) {
  const mode = useSyncExternalStore(runtime.host.uiAgentPreset.store.subscribe, runtime.host.uiAgentPreset.store.getSnapshot)
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  return mode.current === PRESET && !state.view?.fixed ? <Button variant="ghost" onClick={() => runtime.launch(state.view?.scriptId)}>{t('start')}</Button> : null
}
function Source({ runtime, t }: { runtime: Runtime; t: T }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  if (!view?.fixed) return null
  const fixed = view.fixed
  return <details className="ppm-source"><summary>{t('source')} · {fixed.ordinal}</summary><div><strong>{fixed.scriptName} · {t('revision')} {fixed.ordinal}</strong><p className="ppm-preserve">{fixed.description}</p><p>{fixed.artifact.options.language} · {fixed.artifact.options.entry}</p>
    {view.sourceMissing ? <p>{t('missing')}</p> : <Button onClick={() => { history.pushState(null, '', '#papermoon/' + encodeURIComponent(fixed.scriptId) + '?tab=history&revision=' + encodeURIComponent(fixed.revisionId)); runtime.host.layout.selectPanel('papermoon'); window.dispatchEvent(new Event('papermoon:navigate')) }}>{t('open')}</Button>}
  </div></details>
}
export function apply(ctx: ClientHost) {
  const runtime = new Runtime(ctx)
  ctx.effect(() => ctx.locale.register('papermoon-performances', { en, zh }))
  ctx.effect(() => {
    const off = ctx.sessions.list.subscribe(runtime.observe), offMode = ctx.uiAgentPreset.store.subscribe(runtime.observe)
    const refresh = () => void runtime.refresh()
    window.addEventListener('focus', refresh); void ctx.uiAgentPreset.load().then(runtime.observe); runtime.observe()
    return () => { off(); offMode(); window.removeEventListener('focus', refresh); runtime.dispose() }
  })
  for (const [slot, component] of [['shell.overlay', Launch], ['conversation.hero.options', StartButton], ['conversation.session.header.actions', Source]] as const)
    ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, id: 'papermoon-performance', locale: 'papermoon-performances', inject: () => ({ runtime }) }, component))
  for (const definition of [openingDefinition, initializationDefinition]) ctx.effect(() => ctx.uiConversation.events.register(definition))
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'papermoon-opening', locale: 'papermoon-performances' }, Opening))
}
