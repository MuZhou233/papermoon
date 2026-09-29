/** Story context follows the active Playbook page or its real Session. */
import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { BookIcon, Button } from '@papermoon/ui'
import { App, Guide, AuthoringControls } from './app.tsx'
import { Runtime, type Connection } from './runtime.ts'
import { en, zh, type T } from '../locales.ts'
import { chapter } from '../content.ts'
export const inject = ['slots', 'layout', 'locale', 'connection', 'uiWorkspace', 'settingsNavigation', 'sidebarRight', 'sidebarRightTabs', 'sidebarRightPages', 'papermoonEditor']
type Dispose = () => void
interface Observable<T> { getSnapshot(): T; subscribe(listener: () => void): Dispose }
interface Host {
  connection: Connection
  effect(body: () => Dispose, label?: string): unknown
  slots: { inject(name: string, body: () => Dispose): unknown; register<P>(options: { name: string; key?: string; id?: string; order?: number; label?: () => string; locale?: string; inject?: () => object }, component: ComponentType<P>): Dispose }
  layout: { selectPanel(id: string | null): void; panelInfo: Observable<{ activePanelId: string | null }> }
  locale: { register(ns: string, dictionaries: object): Dispose; bind(ns: string): T }
  uiWorkspace: { openSession(target: { kind: 'session'; sessionId: string }): void }
  settingsNavigation: { open(id: string): boolean }
  papermoonEditor: { registerPanel(id: string, component: ComponentType<{playbookId: string}>): Dispose; savePending(id: string): Promise<void> }
  sidebarRight: { mounted: Observable<string | undefined>; openTab(kind: string): void; ensureTabIn(id: string, kind: string): void; isExpanded(): boolean; toggleExpanded(): void }
  sidebarRightTabs: { register(definition: { id: string; kind: string; title: (address: string) => string; keepMounted: boolean }): Dispose }
  sidebarRightPages: { ensure(context: string, kind: string): void; bind(panel: string, context: string | null): void; open(context: string, kind: string): void; surface(context: string): { setExpanded(value: boolean): void } | undefined }
}
const KIND = 'papermoon-story-guide'
function Notice({ runtime, t }: { runtime: Runtime; t: T }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  return state.id && state.unread && state.hint !== 'open-guide' ? <Button className="pm-story-notice" onClick={runtime.openGuide}>{t('progressUpdated')}</Button> : null
}
function Title({ runtime, t }: { runtime: Runtime; t: T }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  return <>{t('guide')}{state.unread && <span className="pm-story-unread" aria-label={t('progressUpdated')}>●</span>}</>
}
function SessionGuide({ runtime, t, useTabInfo }: { runtime: Runtime; t: T; useTabInfo(): { tab: { visible: boolean } } }) {
  const info = useTabInfo()
  return <Guide runtime={runtime} t={t} visible={info.tab.visible} />
}
function Hint({ runtime, t, renderFactorySlot }: { runtime: Runtime; t: T; renderFactorySlot(name: string, props: object): ReactNode }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const section = state.view?.progress.section
  const target = section === 1 ? 'continue' : section === 2 ? 'opening' : section === 3 ? 'system-prompt' : 'model'
  const copy = chapter[t('title') === '故事模式' ? 'zh' : 'en'].sections[(section ?? 1) - 1]!
  const text = section === 5 ? copy.states[state.view?.progress.started ? 3 : 1] : copy.hint
  const selector = state.hint === 'open-guide' ? '[data-sidebar-right-expand]' : section === 5 && state.view?.progress.started ? '[data-composer-input]' : `[data-story-target="${target}"]`
  if (!state.id || !state.hint) return null
  return <>{renderFactorySlot('anchored-guidance', { target: selector, text: state.hint === 'open-guide' ? t('openGuideHint') : text, dismissLabel: t('dismiss'), onDismiss: () => runtime.update({ hint: null }) })}{state.hint === 'operation' && <Button variant="outline" className="pm-story-return" onClick={() => { runtime.update({ hint: null }); runtime.openGuide() }}>{t('guide')}</Button>}</>
}
export function apply(ctx: Host) {
  const t = ctx.locale.bind('papermoon-story')
  let pendingOpen = false
  const openGuide = () => {
    const id = runtime.getSnapshot().id
    if (!id) return
    if (ctx.layout.panelInfo.getSnapshot().activePanelId === 'papermoon') { ctx.sidebarRightPages.bind('papermoon', id); ctx.sidebarRightPages.open(id, KIND) }
    else if (ctx.layout.panelInfo.getSnapshot().activePanelId === null && ctx.sidebarRight.mounted.getSnapshot()) ctx.sidebarRight.openTab(KIND)
    else pendingOpen = true
  }
  const runtime = new Runtime(ctx.connection, id => {
    history.pushState(null, '', '#papermoon/' + encodeURIComponent(id) + '?tab=draft'); ctx.layout.selectPanel('papermoon'); window.dispatchEvent(new Event('papermoon:navigate'))
  }, sessionId => { pendingOpen = !runtime.getSnapshot().hint; ctx.uiWorkspace.openSession({ kind: 'session', sessionId }) }, openGuide, () => {
    const id = runtime.getSnapshot().id
    if (id && ctx.layout.panelInfo.getSnapshot().activePanelId === 'papermoon') ctx.sidebarRightPages.surface(id)?.setExpanded(false)
    else if (ctx.sidebarRight.isExpanded()) ctx.sidebarRight.toggleExpanded()
  }, id => ctx.papermoonEditor.savePending(id), () => { ctx.settingsNavigation.open('models') })
  function CentralControls({ playbookId }: { playbookId: string }) {
    const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
    return state.id === playbookId ? <AuthoringControls runtime={runtime} t={t} /> : null
  }
  ctx.effect(() => ctx.papermoonEditor.registerPanel('story-model', CentralControls), 'story: model selection')
  ctx.effect(() => ctx.locale.register('papermoon-story', { en, zh }), 'story: copy')
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: KIND, kind: KIND, title: () => t('guide'), keepMounted: true }), 'story: guide tab')
  const injected = () => ({ runtime })
  for (const [name, component] of [['sidebar.right.pane.tab', SessionGuide], ['sidebar.right.page.tab', Guide], ['sidebar.right.pane.tab.title', Title], ['sidebar.right.page.tab.title', Title]] as const)
    ctx.slots.inject(name, () => ctx.slots.register({ name, key: KIND, locale: 'papermoon-story', inject: injected }, component))
  for (const name of ['sidebar.right.notice', 'sidebar.right.page.notice']) ctx.slots.inject(name, () => ctx.slots.register({ name, id: KIND, locale: 'papermoon-story', inject: injected }, Notice))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'papermoon-story', order: -9, label: () => t('title') }, BookIcon))
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'papermoon-story', locale: 'papermoon-story', inject: injected }, App))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: KIND, locale: 'papermoon-story', inject: injected }, Hint))
  ctx.effect(() => {
    let generation = 0, disposed = false, timer: ReturnType<typeof setTimeout>
    const follow = async () => {
      const current = ++generation, panel = ctx.layout.panelInfo.getSnapshot().activePanelId
      let id: string | undefined
      try {
        if (panel === 'papermoon') {
          const match = location.hash.match(/^#papermoon\/([^?]+)/)
          if (match) { const candidate = decodeURIComponent(match[1]!); const result = await ctx.connection.rpc.call('/api', 'papermoon/playbook', { playbookId: candidate }, runtime.abort.signal); if (result.ok && (result.value as { playbook: { metadata: { storyline?: string } } }).playbook.metadata.storyline) id = candidate }
        } else if (panel === null) {
          const sessionId = ctx.sidebarRight.mounted.getSnapshot()
          if (sessionId) id = (await runtime.call<{ playbookId: string } | null>('context', { sessionId }))?.playbookId
        }
        if (current !== generation || disposed) return
        ctx.sidebarRightPages.bind('papermoon', panel === 'papermoon' && id ? id : null)
        if (panel === 'papermoon' && id) ctx.sidebarRightPages.ensure(id, KIND)
        await runtime.context(id)
        if (panel === null && id) { const sessionId = ctx.sidebarRight.mounted.getSnapshot(); if (sessionId) ctx.sidebarRight.ensureTabIn(sessionId, KIND) }
        if (pendingOpen && id) { pendingOpen = false; if (runtime.getSnapshot().hint !== 'open-guide') openGuide() }
      } catch (error) { if (current === generation && !disposed) runtime.update({ error: String(error) }) }
    }
    const changed = () => { void follow() }
    const offPanel = ctx.layout.panelInfo.subscribe(changed), offSession = ctx.sidebarRight.mounted.subscribe(changed)
    window.addEventListener('papermoon:navigate', changed); window.addEventListener('hashchange', changed)
    const tick = async () => { await runtime.refresh(); if (!disposed) timer = setTimeout(() => void tick(), 1000) }
    void follow(); void tick()
    return () => { disposed = true; generation++; clearTimeout(timer); offPanel(); offSession(); window.removeEventListener('papermoon:navigate', changed); window.removeEventListener('hashchange', changed); ctx.sidebarRightPages.bind('papermoon', null); runtime.dispose() }
  }, 'story: page context')
}
