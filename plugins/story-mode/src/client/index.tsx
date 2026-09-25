/** Chapters guide the normal navigation and native Conversation page. */
import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { BookIcon } from '@papermoon/ui'
import { App, Introduction, Progress } from './app.tsx'
import { Runtime, type Connection } from './runtime.ts'
import { en, zh, type T } from '../locales.ts'
import { observeVisibleTarget } from '../../../ui-guidance/src/client/visibility.ts'
export const inject = ['slots', 'layout', 'locale', 'connection', 'uiWorkspace', 'settingsNavigation', 'uiConversation']
type Dispose = () => void
interface Pages {
  constrain(id: string, policy: { textOnly: boolean; readOnly: boolean; revealViews: string[] }): Dispose
  isDisplayed(id: string, view: string): boolean
  subscribe(listener: () => void): Dispose
}
interface Host {
  connection: Connection
  effect(body: () => Dispose, label: string): unknown
  slots: {
    inject(name: string, body: () => Dispose): unknown
    register<P>(options: { name: string; key?: string; id?: string; order?: number; priority?: number; label?: () => string; locale?: string; inject?: () => object }, component: ComponentType<P>): Dispose
  }
  layout: { selectPanel(id: string | null): void; panelInfo: { getSnapshot(): { activePanelId: string | null } } }
  locale: { register(name: string, dictionaries: { en: Record<string, string>; zh: Record<string, string> }): Dispose; bind(name: string): T }
  uiWorkspace: { openSession(target: { kind: 'session'; sessionId: string }): void; closeSession(id: string): void; interceptStartSession(handler: () => boolean): Dispose }
  uiConversation: { pages: Pages }
  settingsNavigation: { open(id: string): boolean; subscribe(listener: (id: string | undefined) => void): Dispose }
}
function Guide({ runtime, t, pages, renderFactorySlot }: { runtime: Runtime; t: T; pages: Pages; renderFactorySlot(name: string, props: object): ReactNode }) {
  const { active, attempt, guideDismissed } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const sessionId = attempt?.step === 3 && !attempt.exampleSeen ? attempt.id : attempt?.step === 5 && !attempt.trajectorySeen ? attempt.sessionId : undefined
  const displayed = useSyncExternalStore(listener => pages.subscribe(listener), () => !!sessionId && pages.isDisplayed(sessionId, 'trajectory'))
  if (!active || !sessionId || guideDismissed || displayed) return null
  return renderFactorySlot('anchored-guidance', {
    target: `[data-conversation-view-tab="trajectory"][data-session-id="${sessionId}"]`,
    text: t('traceHint'), dismissLabel: t('dismissGuide'), onDismiss: runtime.dismissGuide,
  })
}
export function apply(ctx: Host): void {
  let progress: Dispose | undefined
  const runtime = new Runtime(ctx.connection, () => ctx.layout.selectPanel('papermoon-story'), () => ctx.settingsNavigation.open('models'), active => {
    if (!active) { progress?.(); progress = undefined }
    else if (!progress) progress = ctx.slots.register({ name: 'sidebar.workspaces', priority: -100, locale: 'papermoon-story', inject: () => ({ runtime }) }, Progress)
  })
  const t = ctx.locale.bind('papermoon-story')
  ctx.effect(() => ctx.locale.register('papermoon-story', { en, zh }), 'story-mode: dictionaries')
  ctx.effect(() => {
    const leases = new Map<string, { readOnly: boolean; release: Dispose }>()
    let destination: string | undefined
    let observing = false
    let navigation = -1
    const release = () => {
      destination = undefined
      for (const [id, lease] of leases) { ctx.uiWorkspace.closeSession(id); lease.release() }
      leases.clear()
    }
    const observe = () => {
      const { active, attempt, busy } = runtime.getSnapshot()
      if (!active || !attempt || observing || busy) return
      const id = attempt.step === 3 && !attempt.exampleSeen ? attempt.id : attempt.step === 5 && !attempt.trajectorySeen ? attempt.sessionId : undefined
      if (!id || !ctx.uiConversation.pages.isDisplayed(id, 'trajectory')) return
      observing = true
      void runtime.act(attempt.step === 3 ? 'example-seen' : 'trajectory-seen').finally(() => { observing = false })
    }
    const navigate = (force = false) => {
      const { active, attempt, example, conversation } = runtime.getSnapshot()
      if (!active || !attempt) { release(); return }
      if (navigation !== runtime.getSnapshot().navigation) { force = true; navigation = runtime.getSnapshot().navigation }
      // Policies follow the owning attempt, including while Settings or another panel is open.
      const targets = new Map<string, boolean>()
      if (example?.id === attempt.id) targets.set(example.id, true)
      if (conversation && conversation.id === attempt.sessionId) targets.set(conversation.id, false)
      for (const [id, lease] of leases) {
        if (targets.get(id) !== lease.readOnly) { lease.release(); leases.delete(id); if (!targets.has(id)) ctx.uiWorkspace.closeSession(id) }
      }
      for (const [id, readOnly] of targets) if (!leases.has(id)) leases.set(id, { readOnly, release: ctx.uiConversation.pages.constrain(id, { textOnly: true, readOnly, revealViews: ['trajectory'] }) })
      const target = attempt.step === 1 ? 'introduction:' + attempt.id : attempt.step <= 3 ? example?.id : conversation?.id
      if (target && (force || destination !== target)) {
        destination = target
        if (attempt.step === 1) ctx.layout.selectPanel('papermoon-story-introduction')
        else ctx.uiWorkspace.openSession({ kind: 'session', sessionId: target })
      }
    }
    const unsubscribe = runtime.subscribe(() => navigate())
    const stopObservation = observeVisibleTarget(() => {
      const { active, attempt, example, conversation } = runtime.getSnapshot()
      if (!active || !attempt) return null
      const source = attempt.step === 3 && !attempt.exampleSeen ? example : attempt.step === 5 && !attempt.trajectorySeen ? conversation : undefined
      if (!source || !ctx.uiConversation.pages.isDisplayed(source.id, 'trajectory')) return null
      const turn = attempt.step === 3 ? source.successfulTurn : attempt.successfulTurn
      const reply = source.events.findLast(event => event.type === 'assistant/message' && event.data.turn === turn)
      if (!reply) return null
      return document.querySelector<HTMLElement>(`[data-conversation-view="trajectory"][data-session-id="${source.id}"] [data-kind="message"][data-source-seq="${reply.seq}"]`)
    }, observe)
    const stopStart = ctx.uiWorkspace.interceptStartSession(() => { if (!runtime.getSnapshot().active) return false; navigate(true); return true })
    const route = () => {
      if (location.hash === '#story-mode/hello-world') { runtime.enter(); navigate(true) }
      else if (location.hash === '#story-mode') runtime.leave()
    }
    window.addEventListener('hashchange', route)
    runtime.start()
    if (location.hash === '#story-mode/hello-world' || sessionStorage.getItem('papermoon.story.active') === 'hello-world') runtime.enter()
    else if (location.hash === '#story-mode') runtime.show()
    return () => {
      window.removeEventListener('hashchange', route); stopStart(); stopObservation(); unsubscribe()
      release(); runtime.dispose()
      if (ctx.layout.panelInfo.getSnapshot().activePanelId?.startsWith('papermoon-story')) ctx.layout.selectPanel(null)
      if (location.hash.startsWith('#story-mode')) history.replaceState(null, '', '#conversation')
    }
  }, 'story-mode: native page lifecycle')
  ctx.effect(() => ctx.settingsNavigation.subscribe(runtime.settingsDisplayed), 'story-mode: settings observation')
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'papermoon-story', order: -9, label: () => t('title') }, BookIcon))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'papermoon-story-guide', locale: 'papermoon-story', inject: () => ({ runtime, pages: ctx.uiConversation.pages }) }, Guide))
  ctx.slots.inject('main', () => {
    const list = ctx.slots.register({ name: 'main', key: 'papermoon-story', locale: 'papermoon-story', inject: () => ({ runtime }) }, App)
    const introduction = ctx.slots.register({ name: 'main', key: 'papermoon-story-introduction', locale: 'papermoon-story', inject: () => ({ runtime }) }, Introduction)
    return () => { introduction(); list() }
  })
}
