/** DSH-facing registration only; page components depend on PaperMoon's API and UI. */
import type { ComponentType } from 'react'
import { BookIcon } from '@papermoon/ui'
import { App, type AppProps, type Runtime } from './app.tsx'
import { createApi, type Connection } from './api.ts'
import { browserBackups } from './buffers.ts'
import { en, zh, type T } from './locales.ts'
export const inject = ['slots', 'layout', 'locale', 'connection']
type Dispose = () => void | Promise<void>
interface Options {
  name: string
  key?: string
  id?: string
  order?: number
  label?: () => string
  locale?: string
  inject?: () => { runtime: Runtime }
}
export interface ClientHost {
  connection: Connection
  effect(body: () => Dispose, label?: string): unknown
  slots: {
    inject(name: string, body: () => Dispose): unknown
    register<P>(options: Options, component: ComponentType<P>): Dispose
  }
  layout: { selectPanel(id: string | null): void }
  locale: {
    register(
      namespace: string,
      dictionaries: { en: Record<string, string>; zh: Record<string, string> },
    ): Dispose
    bind(namespace: string): T
  }
}
export function apply(ctx: ClientHost): void {
  const controller = new AbortController()
  ctx.effect(() => () => controller.abort(), 'papermoon.editor-requests')
  ctx.effect(
    () => ctx.locale.register('papermoon', { en, zh }),
    'papermoon.editor-locale',
  )
  const runtime: Runtime = {
    api: createApi(ctx.connection, controller.signal),
    backups: browserBackups(),
    drafts: new Map(),
    show: () => ctx.layout.selectPanel('papermoon'),
  }
  ctx.effect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (
        [...runtime.drafts.values()].some(
          (draft) => draft.getSnapshot().operations.length,
        )
      ) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, 'papermoon.pending-drafts')
  ctx.effect(
    () => async () => {
      await Promise.all(
        [...runtime.drafts.values()].map((draft) => draft.flush()),
      )
      await runtime.backups.close?.()
    },
    'papermoon.backup-connection',
  )
  const t = ctx.locale.bind('papermoon')
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: 'papermoon',
        order: -10,
        label: () => t('overview'),
      },
      BookIcon,
    ),
  )
  ctx.slots.inject('main', () => {
    const dispose = ctx.slots.register<AppProps>(
      {
        name: 'main',
        key: 'papermoon',
        locale: 'papermoon',
        inject: () => ({ runtime }),
      },
      App,
    )
    const navigate = () => {
      if (location.hash.startsWith('#papermoon') || !location.hash)
        runtime.show()
      else if (location.hash === '#conversation') ctx.layout.selectPanel(null)
    }
    window.addEventListener('popstate', navigate)
    window.addEventListener('hashchange', navigate)
    navigate()
    return () => {
      window.removeEventListener('popstate', navigate)
      window.removeEventListener('hashchange', navigate)
      void dispose()
    }
  })
}
