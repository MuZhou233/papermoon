import { useEffect, useState, useRef } from 'react'
import { Button, Input, Select } from '@papermoon/ui'
import type { HistoryEntry } from '@papermoon/story-core'
import type { Results } from '../service.ts'
import type { Api } from './api.ts'
import type { T } from './locales.ts'
/** Select immutable references by script and revision; raw identities stay secondary. */
export function RevisionPicker({
  api,
  t,
  value,
  onChange,
  multiple = false,
}: {
  api: Api
  t: T
  value: string
  onChange: (value: string) => void
  multiple?: boolean
}) {
  const [query, setQuery] = useState(''),
    [catalog, setCatalog] = useState<Results['catalog']>(),
    [script, setScript] = useState(''),
    [rows, setRows] = useState<HistoryEntry[]>([]),
    [next, setNext] = useState<number>(),
    [error, setError] = useState(''),
    [labels, setLabels] = useState<Record<string, string>>({}),
    [paging, setPaging] = useState(false),
    identity = useRef({ query, script })
  identity.current = { query, script }
  const selected = value.split('\n').filter(Boolean)
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      api
        .call('catalog', { query })
        .then((page) => {
          if (alive) setCatalog(page)
        })
        .catch((e) => {
          if (alive) setError(String(e))
        })
    }, 150)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [api, query])
  useEffect(() => {
    setRows([])
    setNext(undefined)
    if (!script) return
    let alive = true
    api
      .call('history', { scriptId: script })
      .then((page) => {
        if (alive) {
          setRows(page.items)
          setNext(page.next)
        }
      })
      .catch((e) => {
        if (alive) setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [api, script])
  return (
    <div className="pm-reference-picker">
      <Input
        aria-label={t('search')}
        placeholder={t('search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Select
        label={t('choose')}
        value={script}
        options={
          catalog?.items.map((s) => ({
            id: s.id,
            label: s.projectName + ' / ' + s.name,
          })) ?? []
        }
        onChange={setScript}
      />
      {catalog?.next && (
        <Button
          size="sm"
          disabled={paging}
          onClick={async () => {
            setPaging(true)
            try {
              const page = await api.call('catalog', {
                query,
                after: catalog.next,
              })
              if (identity.current.query === query)
                setCatalog({
                  ...page,
                  items: [...catalog.items, ...page.items],
                })
            } catch (error) {
              if (identity.current.query === query) setError(String(error))
            } finally {
              setPaging(false)
            }
          }}
        >
          {t('more')}
        </Button>
      )}
      <div className="pm-reference-list">
        {rows.map((row) => (
          <button
            type="button"
            key={row.ordinal}
            aria-pressed={selected.includes(row.revision.id)}
            onClick={() => {
              const id = row.revision.id
              setLabels({
                ...labels,
                [id]:
                  t('revision') +
                  ' ' +
                  row.ordinal +
                  ' · ' +
                  row.revision.description,
              })
              onChange(
                multiple
                  ? (selected.includes(id)
                      ? selected.filter((v) => v !== id)
                      : [...selected, id]
                    ).join('\n')
                  : id,
              )
            }}
          >
            <strong>
              {t('revision')} {row.ordinal}
            </strong>
            <span>{row.revision.description}</span>
          </button>
        ))}
        {script && !rows.length && (
          <span className="pm-muted">{t('noRevisions')}</span>
        )}
      </div>
      {next !== undefined && (
        <Button
          size="sm"
          disabled={paging}
          onClick={async () => {
            setPaging(true)
            try {
              const page = await api.call('history', {
                scriptId: script,
                after: next,
              })
              if (identity.current.script === script) {
                setRows((old) => [...old, ...page.items])
                setNext(page.next)
              }
            } catch (error) {
              if (identity.current.script === script) setError(String(error))
            } finally {
              setPaging(false)
            }
          }}
        >
          {t('more')}
        </Button>
      )}
      {selected.map((id) => (
        <div className="pm-row" key={id}>
          <span className="pm-reference-label">{labels[id] ?? id}</span>
          <Button
            size="sm"
            aria-label={t('delete')}
            onClick={() =>
              onChange(selected.filter((v) => v !== id).join('\n'))
            }
          >
            ×
          </Button>
        </div>
      ))}
      {error && (
        <div role="alert" className="pm-error">
          {error}
        </div>
      )}
    </div>
  )
}
