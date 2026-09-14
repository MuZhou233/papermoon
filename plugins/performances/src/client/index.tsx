import { useSyncExternalStore, useRef, useEffect } from 'react'
import { Button } from '@papermoon/ui'
import { PRESET } from '../constants.ts'
import { Runtime, type ClientHost } from './runtime.ts'
import { Launch } from './launch.tsx'
import { Opening, openingDefinition, initializationDefinition, actionDefinition } from './context.tsx'
import { en, zh, type T } from './locales.ts'
import './style.css'
export const inject = ['slots', 'locale', 'connection', 'sessions', 'uiAgentPreset', 'conversation', 'uiConversation', 'layout', 'chatPresentation']
function StartButton({ runtime, t }: { runtime: Runtime; t: T }) {
  const mode = useSyncExternalStore(runtime.host.uiAgentPreset.store.subscribe, runtime.host.uiAgentPreset.store.getSnapshot)
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  return mode.current === PRESET && !state.view?.fixed ? <Button variant="ghost" onClick={() => runtime.launch(state.view?.scriptId)}>{t('start')}</Button> : null
}
function Source({ runtime, t }: { runtime: Runtime; t: T }) {
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; menu.current.querySelector('summary')?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  if (!view?.fixed) return null
  const fixed = view.fixed
  return <details ref={menu} className="ppm-source"><summary>{t('source')} · {fixed.ordinal}</summary><div><strong>{fixed.scriptName} · {t('revision')} {fixed.ordinal}</strong><p className="ppm-preserve">{fixed.description}</p><p>{fixed.artifact.options.language} · {fixed.artifact.options.entry}</p>
    {view.sourceMissing ? <p>{t('missing')}</p> : <Button onClick={() => { history.pushState(null, '', '#papermoon/' + encodeURIComponent(fixed.scriptId) + '?tab=history&revision=' + encodeURIComponent(fixed.revisionId)); runtime.host.layout.selectPanel('papermoon'); window.dispatchEvent(new Event('papermoon:navigate')) }}>{t('open')}</Button>}
    {view.runtime && <section className="ppm-inspection" aria-label={t('state')}>
      <details><summary>{t('state')}</summary><pre>{JSON.stringify(view.runtime.state, null, 2)}</pre></details>
      <details><summary>{t('actions')} · {view.runtime.actions.length}</summary>{view.runtime.actions.map(({action, seq}) => <details key={action.checksum}><summary>{seq} · {action.call.name}</summary><pre>{JSON.stringify(action, null, 2)}</pre></details>)}</details>
      <Button variant="ghost" onClick={() => void runtime.refresh()}>{t('refresh')}</Button>
    </section>}
  </div></details>
}
export function apply(ctx: ClientHost) {
  ctx.effect(() => ctx.chatPresentation.preserveReplies(PRESET))
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
  for (const definition of [openingDefinition, initializationDefinition, actionDefinition]) ctx.effect(() => ctx.uiConversation.events.register(definition))
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'papermoon-opening', locale: 'papermoon-performances' }, Opening))
}
