import { SubmissionDialog } from './submission.tsx'
import { FrozenCompilation } from './frozen.tsx'
import { useEffect, useState, useSyncExternalStore, useRef } from 'react'
import { BookIcon, Button, CodeDiff, Input, Select, Tabs } from '@papermoon/ui'
import type {
  Project,
  Script,
  ScriptId,
  ContentRef,
  RestoreSelection,
  HistoryEntry,
} from '@papermoon/story-core'
import type { ScriptSummary } from '@papermoon/story-storage'
import type { Api } from './api.ts'
import { ApiError } from './api.ts'
import { Dialog, type Ask, type DialogSpec } from './dialog.tsx'
import { ContentEditor } from './content.tsx'
import { CompilationPanel, type DiagnosticTarget } from './compilation.tsx'
import { DraftEditor } from './draft.ts'
import type { Backup, Backups } from './buffers.ts'
import { fromDTO, type SnapshotDTO } from '../wire.ts'
import { readRoute, writeRoute, type Route } from './navigation.ts'
import type { T } from './locales.ts'
import type { Results } from '../service.ts'
import './style.css'
export interface Runtime {
  api: Api
  backups: Backups
  drafts: Map<string, DraftEditor>
  show: () => void
}
export interface AppProps {
  runtime: Runtime
  t: T
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
export function App({ runtime, t }: AppProps) {
  const [route, setRoute] = useState(readRoute),
    [dialog, setDialog] = useState<DialogSpec | null>(null),
    [dialogId, setDialogId] = useState(0),
    [projects, setProjects] = useState<Project[]>([]),
    [projectNext, setProjectNext] = useState<string>(),
    [error, setError] = useState<unknown>(null),
    [refresh, setRefresh] = useState(0)
  const ask: Ask = (spec) => {
    setDialog(spec)
    setDialogId((id) => id + 1)
  }
  const reload = () => setRefresh((v) => v + 1)
  useEffect(() => {
    const changed = () => setRoute(readRoute())
    window.addEventListener('papermoon:navigate', changed)
    window.addEventListener('popstate', changed)
    window.addEventListener('hashchange', changed)
    return () => {
      window.removeEventListener('papermoon:navigate', changed)
      window.removeEventListener('popstate', changed)
      window.removeEventListener('hashchange', changed)
    }
  }, [])
  useEffect(() => {
    let alive = true
    runtime.api
      .call('projects', {})
      .then((page) => {
        if (alive) {
          setProjects(page.items)
          setProjectNext(page.next)
        }
      })
      .catch((e) => {
        if (alive) setError(e)
      })
    return () => {
      alive = false
    }
  }, [runtime, refresh])
  const go = (next: Route) => {
    writeRoute(next)
    runtime.show()
  }
  const newProject = () =>
    ask({
      title: t('newProject'),
      fields: [{ id: 'name', label: t('name') }],
      submit: async (v) => {
        await runtime.api.call('createProject', { name: v.name! })
        reload()
      },
    })
  const create = () => {
    let createdProject: string | undefined
    ask({
      title: t('newScript'),
      fields: [
        { id: 'name', label: t('name') },
        {
          id: 'project',
          label: t('project'),
          value: projects[0]?.id ?? '__new',
          options: [
            ...projects.map((p) => ({ id: p.id, label: p.name })),
            { id: '__new', label: t('newProject') },
          ],
        },
        {
          id: 'projectName',
          label: t('projectName'),
          when: { id: 'project', value: '__new' },
        },
        {
          id: 'language',
          label: t('defaultLanguage'),
          value: 'zh-CN',
          language: true,
        },
      ],
      submit: async (v) => {
        let projectId = v.project!
        if (projectId === '__new') {
          if (!createdProject) {
            const result = await runtime.api.call('createProject', {
              name: v.projectName!,
            })
            createdProject = result.id
            reload()
          }
          projectId = createdProject
        }
        const script = await runtime.api.call('createScript', {
          name: v.name!,
          projectId,
          defaultLanguage: v.language!,
        })
        go({ scriptId: script.id, tab: 'draft' })
      },
    })
  }
  return (
    <main className="pm-app pm-theme">
      <header className="pm-header" hidden={!!route.scriptId}>
        <div className="pm-heading">
          <span className="pm-eyebrow">PaperMoon</span>
          <h1>{t('overview')}</h1>
        </div>
      </header>
      {error != null && (
        <div role="alert" className="pm-error">
          {message(error)}
        </div>
      )}
      {route.scriptId ? (
        <Detail
          key={route.scriptId}
          id={route.scriptId}
          route={route}
          runtime={runtime}
          t={t}
          ask={ask}
          projects={projects}
          go={go}
        />
      ) : (
        <Overview
          runtime={runtime}
          t={t}
          ask={ask}
          projects={projects}
          projectNext={projectNext}
          loadProjects={async () => {
            const page = await runtime.api.call('projects', {
              after: projectNext,
            })
            setProjects((p) => [...p, ...page.items])
            setProjectNext(page.next)
          }}
          refresh={refresh}
          reload={reload}
          go={go}
          create={create}
          newProject={newProject}
        />
      )}
      {dialog && (
        <Dialog
          key={dialogId}
          spec={dialog}
          t={t}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  )
}
function Overview({
  runtime,
  t,
  ask,
  projects,
  projectNext,
  loadProjects,
  refresh,
  reload,
  go,
  create,
  newProject,
}: {
  runtime: Runtime
  t: T
  ask: Ask
  projects: Project[]
  projectNext?: string
  loadProjects: () => Promise<void>
  refresh: number
  reload: () => void
  go: (route: Route) => void
  create: () => void
  newProject: () => void
}) {
  const [query, setQuery] = useState(''),
    [project, setProject] = useState(() => {
      try {
        return localStorage.getItem('papermoon.project-filter') ?? ''
      } catch {
        return ''
      }
    }),
    [rows, setRows] = useState<ScriptSummary[]>([]),
    [next, setNext] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [manage, setManage] = useState(false),
    generation = useRef(0)
  const selectedProject = projects.some((p) => p.id === project) ? project : ''
  useEffect(() => {
    try {
      localStorage.setItem('papermoon.project-filter', selectedProject)
    } catch {
      /* Filtering remains usable without preference storage. */
    }
    const id = ++generation.current
    setBusy(true)
    const timer = setTimeout(() => {
      runtime.api
        .call('catalog', { query, projectId: selectedProject || undefined })
        .then((page) => {
          if (generation.current === id) {
            setRows(page.items)
            setNext(page.next)
            setError(null)
          }
        })
        .catch((e) => {
          if (generation.current === id) setError(e)
        })
        .finally(() => {
          if (generation.current === id) setBusy(false)
        })
    }, 150)
    return () => {
      clearTimeout(timer)
      generation.current++
    }
  }, [query, selectedProject, runtime, refresh])
  const more = async () => {
    const id = generation.current
    setBusy(true)
    try {
      const page = await runtime.api.call('catalog', {
        query,
        projectId: selectedProject || undefined,
        after: next,
      })
      if (id === generation.current) {
        setRows((before) => [...before, ...page.items])
        setNext(page.next)
      }
    } catch (e) {
      setError(e)
    } finally {
      if (id === generation.current) setBusy(false)
    }
  }
  return (
    <>
      <div className="pm-overview-toolbar">
        <Input
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          label={t('project')}
          value={selectedProject}
          options={[
            { id: '', label: t('allProjects') },
            ...projects.map((p) => ({ id: p.id, label: p.name })),
          ]}
          onChange={setProject}
        />
        <div className="pm-spacer" />
        <Button onClick={() => setManage(!manage)}>{t('projects')}</Button>
        <Button variant="primary" onClick={create}>
          {t('newScript')}
        </Button>
      </div>
      {manage && (
        <section className="pm-projects">
          <div className="pm-row">
            <h2>{t('projects')}</h2>
            <Button onClick={newProject}>{t('newProject')}</Button>
          </div>
          <p className="pm-muted">{t('projectHint')}</p>
          {projects.map((p) => (
            <div className="pm-project-row" key={p.id}>
              <span>{p.name}</span>
              <code className="pm-muted">{p.id.slice(0, 8)}</code>
              <div className="pm-spacer" />
              <Button
                size="sm"
                onClick={() =>
                  ask({
                    title: t('rename'),
                    fields: [{ id: 'name', label: t('name'), value: p.name }],
                    submit: async (v) => {
                      await runtime.api.call('renameProject', {
                        projectId: p.id,
                        name: v.name!,
                      })
                      reload()
                    },
                  })
                }
              >
                {t('rename')}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  ask({
                    title: t('delete') + ' · ' + p.name,
                    description: t('deleteProjectHint'),
                    danger: true,
                    submit: async () => {
                      await runtime.api.call('deleteProject', {
                        projectId: p.id,
                      })
                      reload()
                    },
                  })
                }
              >
                {t('delete')}
              </Button>
            </div>
          ))}
          {projectNext && (
            <Button onClick={() => void loadProjects().catch(setError)}>
              {t('more')}
            </Button>
          )}
        </section>
      )}
      {error != null && (
        <div role="alert" className="pm-error">
          {message(error)}
          <Button onClick={reload}>{t('refresh')}</Button>
        </div>
      )}
      <div className="pm-cards" aria-busy={busy}>
        {rows.map((script) => (
          <div key={script.id} className="pm-card-container"><button
            key={script.id}
            className="pm-script-card"
            onClick={() => go({ scriptId: script.id, tab: 'latest' })}
          >
            <span className="pm-card-icon">
              <BookIcon size={28} />
            </span>
            <span className="pm-muted">{script.projectName}</span>
            <h2>{script.name}</h2>
            <div className="pm-card-bottom">
              <span>
                {script.latestOrdinal
                  ? t('latest') + ' ' + script.latestOrdinal
                  : t('noRevisions')}
              </span>
              <span aria-hidden="true">↗</span>
            </div>
          </button><Button variant="primary" disabled={!script.latestOrdinal} onClick={() => window.dispatchEvent(new CustomEvent('papermoon:performance', { detail: { scriptId: script.id } }))}>{t('startPerformance')}</Button></div>
        ))}
      </div>
      {!rows.length && !busy && (
        <div className="pm-empty">
          <BookIcon size={40} />
          <h2>{query || selectedProject ? t('queryEmpty') : t('empty')}</h2>
          <p>{t('emptyHint')}</p>
          <Button variant="primary" onClick={create}>
            {t('newScript')}
          </Button>
        </div>
      )}
      {busy && <p className="pm-muted">{t('loading')}</p>}
      {next && (
        <Button disabled={busy} onClick={() => void more()}>
          {t('more')}
        </Button>
      )}
    </>
  )
}
function Detail({
  id,
  route,
  runtime,
  t,
  ask,
  projects,
  go,
}: {
  id: string
  route: Route
  runtime: Runtime
  t: T
  ask: Ask
  projects: Project[]
  go: (route: Route) => void
}) {
  const [info, setInfo] = useState<Results['script']>(),
    [editor, setEditor] = useState<DraftEditor>(),
    [error, setError] = useState<unknown>(null),
    [recoveries, setRecoveries] = useState<Backup[]>([]),
    [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    Promise.all([
      runtime.api.call('script', { scriptId: id }),
      runtime.api.call('snapshot', { ref: { kind: 'draft', scriptId: id } }),
    ])
      .then(([info, snapshot]) => {
        if (!alive) return
        if (snapshot.kind !== 'draft') throw new Error('expected draft')
        setInfo(info)
        let current = runtime.drafts.get(id)
        if (!current) {
          current = new DraftEditor(snapshot, runtime.api, runtime.backups)
          runtime.drafts.set(id, current)
          runtime.backups
            .list(id)
            .then((rows) => {
              if (alive) setRecoveries(rows)
            })
            .catch(setError)
        }
        setEditor(current)
        void current.refresh().catch(setError)
        setError(null)
      })
      .catch((e) => {
        if (alive) setError(e)
      })
    return () => {
      alive = false
    }
  }, [id, runtime, version])
  if (error instanceof ApiError && error.code === 'not-found')
    return (
      <div className="pm-empty">
        <p>{t('notFound')}</p>
        <Button onClick={() => go({ tab: 'draft' })}>{t('back')}</Button>
      </div>
    )
  if (!info || !editor)
    return (
      <div className="pm-empty">
        {error ? message(error) : t('loading')}
        <Button onClick={() => setVersion((v) => v + 1)}>{t('refresh')}</Button>
      </div>
    )
  return (
    <>
      {error != null && (
        <div role="alert" className="pm-error">
          {message(error)}
        </div>
      )}
      <header className="pm-header">
        <div className="pm-heading">
          <span className="pm-eyebrow">{info.project.name}</span>
          <h1>{info.script.name}</h1>
        </div>
      </header>
      <div className="pm-detail-heading">
        <Button onClick={() => go({ tab: 'draft' })}>‹ {t('back')}</Button>
      </div>
      <Tabs
        label={t('navigation')}
        value={route.tab}
        items={['latest', 'draft', 'history', 'settings'].map((id) => ({
          id,
          label: t(id as 'latest' | 'draft' | 'history' | 'settings'),
        }))}
        onChange={(tab) => go({ scriptId: id, tab: tab as Route['tab'] })}
      />
      {route.tab === 'settings' ? (
        <section className="pm-settings">
          <h2>{t('settings')}</h2>
          <p className="pm-muted">
            {t('project')}: {info.project.name}
          </p>
          <Button
            variant="outline"
            onClick={() =>
              ask({
                title: t('renameScript'),
                fields: [
                  { id: 'name', label: t('name'), value: info.script.name },
                ],
                submit: async (v) => {
                  await runtime.api.call('renameScript', {
                    scriptId: id,
                    name: v.name!,
                  })
                  setVersion((v) => v + 1)
                },
              })
            }
          >
            {t('renameScript')}
          </Button>
          <div className="pm-danger-zone">
            <p>{t('deleteScriptHint')}</p>
            <Button
              className="pm-danger"
              onClick={() =>
                ask({
                  title: t('deleteScript'),
                  description: t('deleteScriptHint'),
                  danger: true,
                  submit: async () => {
                    await runtime.api.call('deleteScript', { scriptId: id })
                    runtime.drafts.delete(id)
                    go({ tab: 'draft' })
                  },
                })
              }
            >
              {t('deleteScript')}
            </Button>
          </div>
        </section>
      ) : (
        <Workspace
          editor={editor}
          info={info.script}
          route={route}
          runtime={runtime}
          t={t}
          ask={ask}
          projects={projects}
          go={go}
          recoveries={recoveries}
          recovered={() => setRecoveries([])}
        />
      )}
    </>
  )
}
function Workspace({
  editor,
  info,
  route,
  runtime,
  t,
  ask,
  projects,
  go,
  recoveries,
  recovered,
}: {
  editor: DraftEditor
  info: Script
  route: Route
  runtime: Runtime
  t: T
  ask: Ask
  projects: Project[]
  go: (route: Route) => void
  recoveries: Backup[]
  recovered: () => void
}) {
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot),
    [error, setError] = useState<unknown>(null),
    [version, setVersion] = useState(0),
    [serverComparison, setServerComparison] = useState(false),
    [submission, setSubmission] = useState(false),
    [target, setTarget] = useState<DiagnosticTarget>()
  const { operations, base } = state,
    dirty = operations.length > 0
  useEffect(() => {
    const focus = () => {
      void editor.refresh().catch(setError)
    }
    window.addEventListener('focus', focus)
    window.addEventListener('online', focus)
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (editor.getSnapshot().operations.length) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!active) return
      if (document.visibilityState === 'visible' && !editor.getSnapshot().saving) {
        try { await editor.refresh() } catch (error) { if (active) setError(error) }
      }
      if (active) timer = setTimeout(() => void poll(), 5000)
    }
    timer = setTimeout(() => void poll(), 5000)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('focus', focus)
      window.removeEventListener('online', focus)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [editor])
  const requireSaved = () => {
    if (
      editor.getSnapshot().operations.length ||
      editor.getSnapshot().saving ||
      editor.getSnapshot().conflict
    )
      throw new Error(t('saveFirst'))
  }
  const copy = (revisionId?: string) => {
    try {
      requireSaved()
      ask({
        title: t('copy'),
        fields: [
          {
            id: 'name',
            label: t('name'),
            value: info.name + ' · ' + t('copy'),
          },
          {
            id: 'project',
            label: t('project'),
            value: info.projectId,
            options: projects.map((p) => ({ id: p.id, label: p.name })),
          },
          {
            id: 'history',
            label: t('history'),
            value: 'copy',
            options: [
              { id: 'copy', label: t('copyHistory') },
              { id: 'none', label: t('copyOnly') },
            ],
          },
        ],
        submit: async (v) => {
          requireSaved()
          const script = await runtime.api.call('copy', {
            sourceScriptId: info.id,
            source: revisionId
              ? { kind: 'revision', revisionId }
              : {
                  kind: 'draft',
                  expectedSequence: editor.getSnapshot().base.draft.sequence,
                },
            targetProjectId: v.project!,
            name: v.name!,
            history: v.history as 'copy' | 'none',
          })
          go({ scriptId: script.id, tab: 'draft' })
        },
      })
    } catch (e) {
      setError(e)
    }
  }
  const restore = (revisionId: string, selection: RestoreSelection) => {
    try {
      requireSaved()
      ask({
        title: t('restore'),
        description: t('restoreHint'),
        danger: true,
        submit: async () => {
          requireSaved()
          const result = await runtime.api.call('restore', {
            scriptId: info.id,
            expectedSequence: editor.getSnapshot().base.draft.sequence,
            revisionId,
            selection,
          })
          if (result.kind === 'draft') editor.discard(result)
        },
      })
    } catch (e) {
      setError(e)
    }
  }
  return (
    <>
      {(error || state.error) && (
        <div role="alert" className="pm-error">
          {message(error || state.error)}
        </div>
      )}
      {state.backupError && (
        <div role="alert" className="pm-error">
          {t('backupError')}
        </div>
      )}
      {recoveries.length > 0 && !dirty && (
        <div className="pm-recovery">
          <strong>{t('recovery')}</strong>
          {recoveries.map((backup) => (
            <div className="pm-row" key={backup.id}>
              <span>{new Date(backup.updatedAt).toLocaleString()}</span>
              <Button
                size="sm"
                onClick={() => {
                  editor.recover(backup)
                  recovered()
                }}
              >
                {t('recover')}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  ask({
                    title: t('removeBackup'),
                    description: t('deleteBackupHint'),
                    danger: true,
                    submit: async () => {
                      await runtime.backups.remove(backup.id)
                      recovered()
                    },
                  })
                }
              >
                {t('removeBackup')}
              </Button>
            </div>
          ))}
        </div>
      )}
      {state.conflict && (
        <div role="alert" className="pm-conflict">
          <strong>{t('conflict')}</strong>
          <p>{t('conflictHint')}</p>
          <div className="pm-row">
            <Button onClick={() => setServerComparison(!serverComparison)}>
              {t('compare')}
            </Button>
            <Button
              onClick={() =>
                ask({
                  title: t('reload'),
                  description: t('reloadHint'),
                  danger: true,
                  submit: async () => {
                    const result = await runtime.api.call('snapshot', {
                      ref: { kind: 'draft', scriptId: info.id },
                    })
                    if (result.kind === 'draft') {
                      editor.discard(result)
                      setServerComparison(false)
                    }
                  },
                })
              }
            >
              {t('reload')}
            </Button>
          </div>
          {serverComparison && (
            <LocalComparison
              local={state.content}
              remote={fromDTO(state.conflict.content)}
              t={t}
            />
          )}
        </div>
      )}
      {submission && <SubmissionDialog api={runtime.api} scriptId={info.id} sequence={base.draft.sequence} content={base.content ? fromDTO(base.content) : state.content} t={t} close={() => setSubmission(false)} committed={async result => { await editor.refresh(); setVersion(v => v + 1); go({ scriptId: info.id, tab: 'history', revisionId: result.revision.id }) }} />}
      {route.tab === 'draft' ? (
        <>
          <div className="pm-workbar">
            <span className="pm-muted" role="status">
              {state.saving ? t('saving') : dirty ? t('dirty') : t('saved')} ·{' '}
              {t('base')}:{' '}
              {base.draft.baseRevisionId?.slice(0, 8) ?? t('noBase')}
            </span>
            <div className="pm-spacer" />
            <Button
              disabled={state.saving}
              onClick={() => void editor.refresh().catch(setError)}
            >
              {t('refresh')}
            </Button>
            <Button
              disabled={dirty || state.saving || !!state.conflict}
              onClick={() => copy()}
            >
              {t('copy')}
            </Button>
            <Button
              variant="outline"
              disabled={!dirty || state.saving || !!state.conflict}
              onClick={() => {
                setError(null)
                void editor.save().catch(setError)
              }}
            >
              {t('save')}
            </Button>
            <Button
              variant="primary"
              disabled={dirty || state.saving || !!state.conflict}
              onClick={() => { requireSaved(); setSubmission(true) }}
            >
              {t('commit')}
            </Button>
          </div>
          <CompilationPanel
            api={runtime.api}
            source={{ scriptId: info.id, ref: { kind: 'draft', sequence: base.draft.sequence } }}
            content={state.content}
            t={t}
            ask={ask}
            dirty={dirty}
            blocked={state.saving || !!state.conflict}
            save={async () => {
              await editor.save()
              requireSaved()
              return { scriptId: info.id, ref: { kind: 'draft', sequence: editor.getSnapshot().base.draft.sequence } }
            }}
            locate={setTarget}
            verify={async () => {
              await editor.refresh()
              const latest = editor.getSnapshot()
              return !latest.operations.length && !latest.conflict && latest.base.draft.sequence === base.draft.sequence
            }}
          />
          <ContentEditor
            content={state.content}
            identity={info.id}
            edit={(ops) => editor.edit(ops)}
            t={t}
            ask={ask}
            target={target}
          />
        </>
      ) : (
        <RevisionBrowser
          key={version}
          route={route}
          runtime={runtime}
          t={t}
          ask={ask}
          go={go}
          copy={copy}
          restore={restore}
        />
      )}
    </>
  )
}
function LocalComparison({
  local,
  remote,
  t,
}: {
  local: ReturnType<typeof fromDTO>
  remote: ReturnType<typeof fromDTO>
  t: T
}) {
  const paths = [
    ...new Set([...local.program.files.keys(), ...remote.program.files.keys()]),
  ]
  return (
    <div>
      {paths
        .filter(
          (p) =>
            local.program.files.get(p)?.source !==
            remote.program.files.get(p)?.source,
        )
        .map((path) => (
          <details key={path}>
            <summary>{path}</summary>
            <CodeDiff
              path={path}
              before={local.program.files.get(path)?.source ?? ''}
              after={remote.program.files.get(path)?.source ?? ''}
            />
          </details>
        ))}
      <details>
        <summary>{t('texts')}</summary>
        <CodeDiff
          path="text.json"
          before={JSON.stringify(
            {
              defaultLanguage: local.texts.defaultLanguage,
              languages: [...local.texts.languages.keys()],
              entries: [...local.texts.entries].map(([key, e]) => ({
                key,
                description: e.description,
                translations: [...e.translations],
              })),
            },
            null,
            2,
          )}
          after={JSON.stringify(
            {
              defaultLanguage: remote.texts.defaultLanguage,
              languages: [...remote.texts.languages.keys()],
              entries: [...remote.texts.entries].map(([key, e]) => ({
                key,
                description: e.description,
                translations: [...e.translations],
              })),
            },
            null,
            2,
          )}
        />
      </details>
    </div>
  )
}
function RevisionBrowser({
  route,
  runtime,
  t,
  ask,
  go,
  copy,
  restore,
}: {
  route: Route
  runtime: Runtime
  t: T
  ask: Ask
  go: (route: Route) => void
  copy: (revisionId?: string) => void
  restore: (id: string, selection: RestoreSelection) => void
}) {
  const [rows, setRows] = useState<HistoryEntry[]>([]),
    [next, setNext] = useState<number>(),
    [snapshot, setSnapshot] = useState<SnapshotDTO>(),
    [error, setError] = useState<unknown>(null),
    [comparison, setComparison] = useState<{
      left: ContentRef
      right: ContentRef
    }>(),
    [busy, setBusy] = useState(false),
    [current, setCurrent] = useState<HistoryEntry>(),
    [target] = useState<DiagnosticTarget>()
  useEffect(() => {
    let alive = true
    runtime.api
      .call('history', { scriptId: route.scriptId! })
      .then((page) => {
        if (alive) {
          setRows(page.items)
          setNext(page.next)
        }
      })
      .catch(setError)
    return () => {
      alive = false
    }
  }, [route.scriptId, runtime])
  useEffect(() => {
    setSnapshot(undefined)
    setComparison(undefined)
    const selected = route.tab === 'latest' ? rows[0]?.revision.id : route.revisionId
    if (!selected) return
    let alive = true
    runtime.api
      .call('revision', {
        scriptId: route.scriptId!,
        revisionId: selected,
      })
      .then((result) => {
        if (alive) {
          setSnapshot(result.snapshot)
          setCurrent(result.entry)
        }
      })
      .catch(setError)
    return () => {
      alive = false
    }
  }, [route.revisionId, route.tab, route.scriptId, rows, runtime])
  return (
    <section className={route.tab === 'latest' ? 'pm-latest' : 'pm-history'}>
      {error != null && (
        <div role="alert" className="pm-error">
          {message(error)}
        </div>
      )}
      {route.tab !== 'latest' && <aside className="pm-history-list">
        {!rows.length && <p className="pm-muted">{t('noRevisions')}</p>}
        {rows.map((row) => (
          <button
            key={row.ordinal}
            className={
              'pm-history-row ' +
              (row.revision.id === route.revisionId ? 'selected' : '')
            }
            onClick={() => go({ ...route, revisionId: row.revision.id })}
          >
            <strong>
              {t('revision')} {row.ordinal}
            </strong>
            <span>{row.revision.description}</span>
            <small>{row.revision.attachments.items.length ? t('attachedResults') : t('noArtifactsShort')} · {new Date(row.revision.createdAt).toLocaleString()}</small>
          </button>
        ))}
        {next && (
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void runtime.api
                .call('history', { scriptId: route.scriptId!, after: next })
                .then((page) => {
                  setRows((before) => [...before, ...page.items])
                  setNext(page.next)
                })
                .catch(setError)
                .finally(() => setBusy(false))
            }}
          >
            {t('more')}
          </Button>
        )}
      </aside>}
      <div className="pm-revision-detail">
        {snapshot?.kind === 'revision' ? (
          <>
            <div className="pm-revision-meta">
              <h2>
                {t('revision')} {current?.ordinal ?? '·'}
              </h2>
              <p className="pm-preserve">{snapshot.revision.description}</p>
              <div className="pm-muted">
                {t('source')}: {snapshot.revision.source.projectName} /{' '}
                {snapshot.revision.source.scriptName}
                <br />
                {t('base')}:{' '}
                {snapshot.revision.source.baseRevisionId ?? t('noBase')}
              </div>
              <code className="pm-id">{snapshot.revision.id}</code>
              {snapshot.revision.references.length > 0 && (
                <details>
                  <summary>{t('references')}</summary>
                  {snapshot.revision.references.map((id) => (
                    <code key={id} className="pm-id">
                      {id}
                    </code>
                  ))}
                </details>
              )}
              <div className="pm-actions">
                <Button variant="primary" disabled={!snapshot.revision.attachments.items.length} onClick={() => window.dispatchEvent(new CustomEvent('papermoon:performance', { detail: { scriptId: route.scriptId, revisionId: snapshot.revision.id } }))}>{t('startPerformance')}</Button>
                <Button
                  onClick={() =>
                    setComparison({
                      left: {
                        kind: 'revision',
                        revisionId: snapshot.revision.id,
                      },
                      right: {
                        kind: 'draft',
                        scriptId: route.scriptId as ScriptId,
                      },
                    })
                  }
                >
                  {t('compareDraft')}
                </Button>
                <Button
                  onClick={() =>
                    ask({
                      api: runtime.api,
                      title: t('compareRevision'),
                      fields: [
                        {
                          id: 'revision',
                          label: t('selectRevision'),
                          references: true,
                        },
                      ],
                      submit: (v) => {
                        setComparison({
                          left: {
                            kind: 'revision',
                            revisionId: snapshot.revision.id,
                          },
                          right: {
                            kind: 'revision',
                            revisionId:
                              v.revision as HistoryEntry['revision']['id'],
                          },
                        })
                      },
                    })
                  }
                >
                  {t('compareRevision')}
                </Button>
                <Button onClick={() => copy(snapshot.revision.id)}>
                  {t('copy')}
                </Button>
                <Select
                  label={t('restore')}
                  value=""
                  options={[
                    { id: 'all', label: t('restoreAll') },
                    { id: 'program', label: t('restoreProgram') },
                    { id: 'catalog', label: t('restoreTexts') },
                  ]}
                  onChange={(kind) =>
                    restore(snapshot.revision.id, {
                      kind: kind as 'all' | 'program' | 'catalog',
                    })
                  }
                />
              </div>
            </div>
            <FrozenCompilation key={snapshot.revision.id} api={runtime.api} scriptId={route.scriptId!} revisionId={snapshot.revision.id} t={t} />
            {comparison ? (
              <Comparison
                key={JSON.stringify(comparison)}
                api={runtime.api}
                t={t}
                left={comparison.left}
                right={comparison.right}
              />
            ) : (
              <ContentEditor
                key={snapshot.revision.id}
                identity={snapshot.revision.id}
                content={fromDTO(snapshot.content)}
                t={t}
                ask={ask}
                target={target}
                restore={(selection) =>
                  restore(snapshot.revision.id, selection)
                }
              />
            )}
          </>
        ) : (
          <div className="pm-empty">{t('selectRevision')}</div>
        )}
      </div>
    </section>
  )
}
function Comparison({
  api,
  t,
  left,
  right,
}: {
  api: Api
  t: T
  left: ContentRef
  right: ContentRef
}) {
  const [page, setPage] = useState<Results['compare']>(),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    api
      .call('compare', { left, right })
      .then((result) => {
        if (alive) setPage(result)
      })
      .catch((e) => {
        if (alive) setError(e)
      })
    return () => {
      alive = false
    }
  }, [api, left, right])
  return (
    <section className="pm-comparison">
      <h3>{t('differences')}</h3>
      {error != null && (
        <div role="alert" className="pm-error">
          {message(error)}
        </div>
      )}
      {page?.items.map((change, index) => {
        const record = change.after ?? change.before
        const title =
          record?.kind === 'file'
            ? record.value.path
            : record?.kind === 'text'
              ? record.value.key
              : record?.kind === 'language'
                ? record.value.id
                : t('settings')
        const text = (value: typeof record) =>
          value?.kind === 'file'
            ? value.value.source
            : JSON.stringify(value?.value ?? null, null, 2)
        return (
          <details key={index}>
            <summary>
              <span className="pm-badge">
                {change.kind === 'added'
                  ? '+'
                  : change.kind === 'removed'
                    ? '−'
                    : '~'}
              </span>{' '}
              {title}
            </summary>
            <div className="pm-compare-labels">
              <span>{t('before')}</span>
              <span>{t('after')}</span>
            </div>
            <CodeDiff
              path={record?.kind === 'file' ? title : 'text.json'}
              before={text(change.before)}
              after={text(change.after)}
            />
          </details>
        )
      })}
      {page && !page.items.length && <p>{t('noDifferences')}</p>}
      {page?.next && (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void api
              .call('compare', {
                left: page.left,
                right: page.right,
                after: page.next,
              })
              .then((next) =>
                setPage({ ...next, items: [...page.items, ...next.items] }),
              )
              .catch(setError)
              .finally(() => setBusy(false))
          }}
        >
          {t('more')}
        </Button>
      )}
    </section>
  )
}
