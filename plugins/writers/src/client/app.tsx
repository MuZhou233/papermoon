import { useState, useSyncExternalStore } from 'react'
import { Button, Field, Input, Modal, Tabs } from '@papermoon/ui'
import { PromptPanel } from './prompts.tsx'
import type { State, WriterStore } from './store.ts'
import type { T } from './locales.ts'
import './style.css'
export interface Props {
  store: WriterStore
  t: T
}
export function App({ store, t }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot),
    [query, setQuery] = useState(''),
    [toolQuery, setToolQuery] = useState('')
  const { draft, saved, busy } = state,
    readonly = !saved || busy
  const filtered = state.writers.filter((writer) =>
    writer.name
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  )
  const tools = state.catalog.filter((tool) =>
    `${tool.name} ${tool.description}`
      .toLocaleLowerCase()
      .includes(toolQuery.toLocaleLowerCase()),
  )
  return (
    <main className="pw-app pm-theme">
      <header className="pw-header">
        <h1>{t('title')}</h1>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => store.requestCreate(t('newWriterName'))}
        >
          {t('newWriter')}
        </Button>
      </header>
      <div className="pw-columns">
        <aside className="pw-list">
          <Input
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <nav aria-label={t('title')}>
            {filtered.map((writer) => (
              <button
                key={writer.id}
                aria-current={writer.id === saved?.id ? 'page' : undefined}
                onClick={() => store.select(writer)}
              >
                <span>{writer.name}</span>
                {writer.description && <small>{writer.description}</small>}
              </button>
            ))}
          </nav>
          {state.writers.length > 0 && !filtered.length && <p className="pw-muted">{t('noWriters')}</p>}
        </aside>
        <section className="pw-detail">
          {!draft && state.error && (
            <div role="alert" className="pw-error">
              {state.error}
              <Button disabled={busy} onClick={() => void store.load()}>
                {t('refresh')}
              </Button>
            </div>
          )}
          {!draft || !saved ? (
            <p className="pw-empty">{t(state.writers.length ? 'emptySelection' : 'emptyWriters')}</p>
          ) : (
            <>
              <div className="pw-toolbar">
                <h2>{draft.name}</h2>
              </div>
              <Tabs
                value={state.tab}
                items={[
                  { id: 'prompts', label: t('prompts') },
                  { id: 'tools', label: t('tools') },
                  { id: 'settings', label: t('settings') },
                ]}
                label={t('tabs')}
                onChange={(tab) => store.tab(tab as State['tab'])}
              />
              {state.error && (
                <div role="alert" className="pw-error">
                  {state.error}
                  <Button
                    disabled={busy}
                    onClick={() => store.request(() => store.load(saved.id))}
                  >
                    {t('refresh')}
                  </Button>
                </div>
              )}
              <div className="pw-body" role="tabpanel" aria-label={t(state.tab)}>
                {state.tab !== 'tools' && (
                  <div className="pw-tab-actions">
                    {store.dirty && <span role="status" className="pw-muted">{t('unsaved')}</span>}
                    {state.tab === 'prompts' && (
                      <Button
                        disabled={busy}
                        onClick={() => state.editing ? store.exitEditing() : store.beginEditing()}
                      >
                        {state.editing ? t('exitEditing') : t('edit')}
                      </Button>
                    )}
                    {(state.tab === 'settings' || state.editing) && (
                      <Button
                        variant="primary"
                        disabled={busy || !store.dirty || !draft.name.trim()}
                        onClick={() => void store.save()}
                      >
                        {busy ? t('saving') : t('save')}
                      </Button>
                    )}
                  </div>
                )}
                {state.tab === 'prompts' ? (
                  <PromptPanel store={store} t={t} />
                ) : state.tab === 'settings' ? (
                  <>
                    <div className="pw-fields">
                      <Field label={t('name')}>
                        <Input aria-label={t('name')} value={draft.name} disabled={readonly} onChange={(e) => store.edit({ name: e.target.value })} />
                      </Field>
                      <Field label={t('description')}>
                        <Input aria-label={t('description')} value={draft.description ?? ''} disabled={readonly} onChange={(e) => store.edit({ description: e.target.value })} />
                      </Field>
                    </div>
                    <div className="pw-settings-actions">
                      <Button disabled={busy} onClick={() => store.requestCopy(t('copySuffix'))}>{t('copy')}</Button>
                      <Button className="pm-danger" variant="outline" disabled={busy} onClick={() => store.requestDelete()}>{t('delete')}</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{t('builtInTools')}</h3>
                    <p className="pw-muted">{t('toolsHint')}</p>
                    <Input
                      aria-label={t('searchTools')}
                      placeholder={t('searchTools')}
                      value={toolQuery}
                      onChange={(e) => setToolQuery(e.target.value)}
                    />
                    {(['program', 'texts', 'history'] as const).map(
                      (group) =>
                        tools.some((tool) => tool.group === group) && (
                          <section key={group}>
                            <h3>{t(group)}</h3>
                            {tools
                              .filter((tool) => tool.group === group)
                              .map((tool) => (
                                <details className="pw-tool" key={tool.name}>
                                  <summary>
                                    <code>{tool.name}</code>
                                    <span className="pw-badge">
                                      {tool.readonly
                                        ? t('readonly')
                                        : t('modifies')}
                                    </span>
                                  </summary>
                                  <p>{tool.description}</p>
                                  <h4>{t('parameters')}</h4>
                                  <pre>
                                    {JSON.stringify(tool.parameters, null, 2)}
                                  </pre>
                                  <h4>{t('result')}</h4>
                                  <p>{tool.output.description}</p>
                                  <pre>
                                    {JSON.stringify(
                                      tool.output.schema,
                                      null,
                                      2,
                                    )}
                                  </pre>
                                </details>
                              ))}
                          </section>
                        ),
                    )}
                    {!tools.length && <p>{t('noTools')}</p>}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
/** Lives in the shell overlay, so a pending decision survives a main-panel transition. */
export function Decisions({ store, t }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return (
    <>
      <Modal
        open={!!state.pending}
        title={t('leave')}
        description={t('leaveBody')}
        closeLabel={t('close')}
        onClose={() => {
          if (!state.busy) void store.choose('cancel')
        }}
        footer={
          <>
            <Button
              disabled={state.busy}
              onClick={() => void store.choose('cancel')}
            >
              {t('cancel')}
            </Button>
            <Button
              disabled={state.busy}
              onClick={() => void store.choose('discard')}
            >
              {t('discard')}
            </Button>
            <Button
              variant="primary"
              disabled={state.busy}
              onClick={() => void store.choose('save')}
            >
              {t('save')}
            </Button>
          </>
        }
      >
        {state.error && <p role="alert">{state.error}</p>}
      </Modal>
      <Modal
        open={!!state.creating}
        title={t(state.creating?.sourceId ? 'copy' : 'newWriter')}
        closeLabel={t('close')}
        onClose={() => store.cancelCreation()}
        footer={
          <>
            <Button disabled={state.busy} onClick={() => store.cancelCreation()}>{t('cancel')}</Button>
            <Button variant="primary" type="submit" form="pw-create-writer"
              disabled={state.busy || !state.creating?.name.trim()}>
              {t(state.creating?.sourceId ? 'confirmCopy' : 'confirmCreate')}
            </Button>
          </>
        }
      >
        {state.creating && <form id="pw-create-writer" className="pm-theme pw-fields"
          onSubmit={(event) => { event.preventDefault(); void store.confirmCreation() }}>
          <Field label={t('name')}>
            <Input aria-label={t('name')} value={state.creating.name} disabled={state.busy}
              onChange={(event) => store.editCreation({ name: event.target.value })} />
          </Field>
          <Field label={t('description')}>
            <Input aria-label={t('description')} value={state.creating.description} disabled={state.busy}
              onChange={(event) => store.editCreation({ description: event.target.value })} />
          </Field>
          {state.error && <p role="alert">{state.error}</p>}
        </form>}
      </Modal>
      <Modal
        open={!!state.deleting}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        closeLabel={t('close')}
        onClose={() => {
          if (!state.busy) store.cancelDelete()
        }}
        footer={
          <>
            <Button disabled={state.busy} onClick={() => store.cancelDelete()}>
              {t('cancel')}
            </Button>
            <Button
              className="pm-danger"
              variant="primary"
              disabled={state.busy}
              onClick={() => void store.remove()}
            >
              {t('delete')}
            </Button>
          </>
        }
      >
        {state.error && <p role="alert">{state.error}</p>}
      </Modal>
    </>
  )
}
