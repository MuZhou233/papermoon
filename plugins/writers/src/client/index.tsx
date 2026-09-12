/** Thin DSH registrations; the settings model and page have no host implementation imports. */
import { useEffect, useRef, type ComponentType } from 'react'
import { BookIcon } from '@papermoon/ui'
import { App, Decisions, type Props } from './app.tsx'
import { WriterStore } from './store.ts'
import { createApi, type Connection } from './api.ts'
import { en, zh, type T } from './locales.ts'
export const inject = ['slots', 'layout', 'locale', 'connection']
type Dispose = () => void | Promise<void>
interface Options {
  name: string
  key?: string
  id?: string
  order?: number
  locale?: string
  inject?: () => object
}
interface Host {
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
  }
}
interface Runtime {
  store: WriterStore
  show(): void
  select(id: string | null): void
}
interface ShellProps extends Props {
  runtime: Runtime
  usePanelInfo<T>(selector: (info: { activePanelId: string | null }) => T): T
}
function Guard(props: ShellProps) {
  const active = props.usePanelInfo((info) => info.activePanelId),
    previous = useRef(active)
  useEffect(() => {
    const before = previous.current
    previous.current = active
    if (before !== 'writers' || active === 'writers') return
    const destinationHash = location.hash.startsWith('#writers')
      ? '#' + encodeURIComponent(active ?? 'conversation')
      : location.hash
    const leave = () => {
      props.store.exitEditing()
      history.replaceState(null, '', location.pathname + location.search + destinationHash)
      props.runtime.select(active)
      window.dispatchEvent(new Event('popstate'))
    }
    if (props.store.dirty) {
      props.runtime.select('writers')
      props.store.request(leave)
    } else {
      leave()
    }
  }, [active, props.runtime, props.store])
  return <Decisions store={props.store} t={props.t} />
}
function Footer({
  wide,
  runtime,
  t,
}: {
  wide: boolean
  runtime: Runtime
  t: T
}) {
  return (
    <button
      type="button"
      className="pw-footer"
      data-wide={wide}
      title={t('title')}
      aria-label={t('title')}
      onClick={() => runtime.show()}
    >
      <BookIcon size={wide ? 16 : 18} />
      {wide && <span>{t('title')}</span>}
    </button>
  )
}
export function apply(ctx: Host): void {
  const abort = new AbortController()
  ctx.effect(() => () => abort.abort(), 'papermoon.writers-requests')
  ctx.effect(
    () => ctx.locale.register('papermoon-writers', { en, zh }),
    'papermoon.writers-locale',
  )
  const store = new WriterStore(
    createApi(ctx.connection, abort.signal),
    (id, tab) => {
      try {
        localStorage.setItem(
          'papermoon.writers.position',
          JSON.stringify({ id, tab }),
        )
      } catch {
        // Browsers can deny preference writes; this does not undo saved server settings.
      }
    },
  )
  const runtime: Runtime = {
    store,
    select: (id) => {
      if (id === 'writers') history.replaceState(null, '', '#writers')
      ctx.layout.selectPanel(id)
    },
    show() {
      history.pushState(null, '', '#writers')
      ctx.layout.selectPanel('writers')
    },
  }
  ctx.effect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (store.dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, 'papermoon.writers-edits')
  ctx.slots.inject('main', () => {
    const dispose = ctx.slots.register<Props>(
      {
        name: 'main',
        key: 'writers',
        locale: 'papermoon-writers',
        inject: () => ({ store }),
      },
      App,
    )
    let id: string | undefined,
      tab: 'prompts' | 'tools' | 'settings' = 'prompts'
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem('papermoon.writers.position') ?? 'null',
      )
      if (
        saved &&
        typeof saved === 'object' &&
        'id' in saved &&
        typeof saved.id === 'string'
      )
        id = saved.id
      if (
        saved &&
        typeof saved === 'object' &&
        'tab' in saved &&
        (saved.tab === 'tools' || saved.tab === 'settings')
      )
        tab = saved.tab
    } catch {
      /* Invalid browser navigation data has no saved position. */
    }
    void store.load(id, tab)
    const navigate = () => {
      if (location.hash.startsWith('#writers'))
        ctx.layout.selectPanel('writers')
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
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'papermoon-writers',
        locale: 'papermoon-writers',
        inject: () => ({ runtime }),
      },
      Footer,
    ),
  )
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'papermoon-writers-decisions',
        locale: 'papermoon-writers',
        inject: () => ({ store, runtime }),
      },
      Guard,
    ),
  )
}
