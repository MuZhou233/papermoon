import { useEffect, useState } from 'react'
import { Button, CodeEditor, Field, Input, Select, Tabs } from '@papermoon/ui'
import type { StoryContent, RestoreSelection } from '@papermoon/story-core'
import type { EditableOperation } from '../protocol.ts'
import type { Ask } from './dialog.tsx'
import type { T } from './locales.ts'
import type { DiagnosticTarget } from './compilation.tsx'
interface Props {
  content: StoryContent
  t: T
  ask: Ask
  identity: string
  edit?: (operations: EditableOperation[]) => void
  restore?: (selection: RestoreSelection) => void
  target?: DiagnosticTarget
}
function stored(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
      string,
      string
    >
  } catch {
    return {}
  }
}
export function ContentEditor({
  content,
  t,
  ask,
  identity,
  edit,
  restore,
  target,
}: Props) {
  const storageKey = 'papermoon.selection.v1/' + identity,
    [initial] = useState(() => stored(storageKey)),
    [part, setPart] = useState(initial.part ?? 'program'),
    [file, setFile] = useState(initial.file ?? ''),
    [key, setKey] = useState(initial.key ?? ''),
    [lang, setLang] = useState(initial.lang ?? content.texts.defaultLanguage),
    [search, setSearch] = useState(''),
    [missing, setMissing] = useState(false),
    [visited, setVisited] = useState<Set<string>>(
      new Set(initial.file ? [initial.file] : []),
    )
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ part, file, key, lang }),
      )
    } catch {
      /* Navigation preferences are optional; the durable draft backup reports its own failures. */
    }
  }, [storageKey, part, file, key, lang])
  const language = content.texts.languages.has(lang)
    ? lang
    : content.texts.defaultLanguage
  const selected = content.texts.entries.get(key),
    translation = selected?.translations.get(language)
  const chooseFile = (path: string) => {
    setFile(path)
    setVisited((before) => new Set([...before, path]))
  }
  useEffect(() => {
    if (!target) return
    setSearch(''); setMissing(false)
    if (target.key !== undefined) { setPart('texts'); setKey(target.key); if (target.language) setLang(target.language) }
    else if (target.path) { setPart('program'); chooseFile(target.path) }
  }, [target])
  const run = (ops: EditableOperation[]) => {
    try {
      edit?.(ops)
    } catch (error) {
      ask({ title: t('error'), description: String(error), submit: () => {} })
    }
  }
  const rename = (type: 'file' | 'text', value: string) =>
    ask({
      title: t('rename'),
      fields: [
        { id: 'to', label: type === 'file' ? t('path') : t('key'), value },
      ],
      submit: (v) => {
        edit?.(
          type === 'file'
            ? [{ kind: 'rename-file', path: value, to: v.to! }]
            : [{ kind: 'rename-text', key: value, to: v.to! }],
        )
        if (type === 'file') chooseFile(v.to!)
        else setKey(v.to!)
      },
    })
  const remove = (ops: EditableOperation[]) =>
    ask({
      title: t('delete'),
      description: t('deleteItemHint'),
      danger: true,
      submit: () => {
        edit?.(ops)
      },
    })
  const files = [...content.program.files.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  )
  const matches = files
    .filter((f) => f.path.includes(search) || f.source.includes(search))
    .map((f) => f.path)
  function tree(paths: string[], prefix = ''): React.ReactNode {
    const names = [
      ...new Set(paths.map((path) => path.slice(prefix.length).split('/')[0]!)),
    ]
    return names.map((name) => {
      const path = prefix + name,
        children = paths.filter((f) => f.startsWith(path + '/'))
      return children.length ? (
        <details open key={path}>
          <summary>{name}</summary>
          <div className="pm-tree-indent">{tree(children, path + '/')}</div>
        </details>
      ) : (
        <button
          className={'pm-tree-file ' + (file === path ? 'selected' : '')}
          key={path}
          onClick={() => chooseFile(path)}
          title={path}
        >
          {name}
        </button>
      )
    })
  }
  return (
    <section className="pm-content">
      <div className="pm-content-tabs">
        <Tabs
          label={t('draft')}
          value={part}
          items={[
            { id: 'program', label: t('program') },
            { id: 'texts', label: t('texts') },
          ]}
          onChange={(value) => {
            setPart(value)
            setSearch('')
          }}
        />
        {!edit && <span className="pm-badge">{t('readOnly')}</span>}
      </div>
      <div className="pm-editor-layout">
        <aside className="pm-item-list">
          <Input
            aria-label={part === 'program' ? t('searchFiles') : t('textSearch')}
            placeholder={
              part === 'program' ? t('searchFiles') : t('textSearch')
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {part === 'program' ? (
            <>
              <div className="pm-list-heading">
                {t('files')}
                {edit && (
                  <Button
                    size="sm"
                    aria-label={t('newFile')}
                    onClick={() =>
                      ask({
                        title: t('newFile'),
                        fields: [{ id: 'path', label: t('path') }],
                        submit: (v) => {
                          edit([
                            { kind: 'create-file', path: v.path!, source: '' },
                          ])
                          chooseFile(v.path!)
                        },
                      })
                    }
                  >
                    ＋
                  </Button>
                )}
              </div>
              <nav className="pm-tree">{tree(matches)}</nav>
              {!files.length && <p className="pm-muted">{t('emptyFiles')}</p>}
            </>
          ) : (
            <>
              <div className="pm-list-heading">
                {t('texts')}
                {edit && (
                  <Button
                    size="sm"
                    aria-label={t('newText')}
                    onClick={() =>
                      ask({
                        title: t('newText'),
                        fields: [{ id: 'key', label: t('key') }],
                        submit: (v) => {
                          edit([{ kind: 'create-text', key: v.key! }])
                          setKey(v.key!)
                        },
                      })
                    }
                  >
                    ＋
                  </Button>
                )}
              </div>
              <Select
                label={t('selectLanguage')}
                value={language}
                options={[...content.texts.languages.keys()].map((id) => ({
                  id,
                  label: id,
                }))}
                onChange={setLang}
              />
              <label className="pm-checkbox">
                <input
                  type="checkbox"
                  checked={missing}
                  onChange={(e) => setMissing(e.target.checked)}
                />
                {t('missingOnly')}
              </label>
              <nav className="pm-tree">
                {[...content.texts.entries.values()]
                  .filter(
                    (e) =>
                      (!missing || !e.translations.has(language)) &&
                      [
                        e.key,
                        e.description ?? '',
                        e.translations.get(language)?.text ?? '',
                      ].some((s) => s.includes(search)),
                  )
                  .map((e) => (
                    <button
                      key={e.key}
                      className={
                        'pm-tree-file ' + (e.key === key ? 'selected' : '')
                      }
                      onClick={() => setKey(e.key)}
                      title={e.key}
                    >
                      {e.key}
                      {!e.translations.has(language) && (
                        <span className="pm-missing">●</span>
                      )}
                    </button>
                  ))}
              </nav>
              {edit && (
                <Button
                  onClick={() =>
                    ask({
                      title: t('languages'),
                      description: t('languageHint'),
                      body: (
                        <div className="pm-language-summary">
                          {[...content.texts.languages.keys()].join(' · ')}
                        </div>
                      ),
                      fields: [
                        {
                          id: 'language',
                          label: t('language'),
                          language: true,
                        },
                      ],
                      submit: (v) => {
                        edit([{ kind: 'add-language', language: v.language! }])
                        setLang(v.language!)
                      },
                    })
                  }
                >
                  {t('addLanguage')}
                </Button>
              )}
            </>
          )}
        </aside>
        <div className="pm-editor-main">
          <div hidden={part !== 'program'}>
            {content.program.files.has(file) ? (
              <>
                <div className="pm-file-toolbar">
                  <span title={file}>{file}</span>
                  <div className="pm-row">
                    {edit ? (
                      <>
                        <Button size="sm" onClick={() => rename('file', file)}>
                          {t('rename')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            remove([{ kind: 'delete-file', path: file }])
                          }
                        >
                          {t('delete')}
                        </Button>
                      </>
                    ) : (
                      restore && (
                        <Button
                          size="sm"
                          onClick={() => restore({ kind: 'file', path: file })}
                        >
                          {t('restoreFile')}
                        </Button>
                      )
                    )}
                  </div>
                </div>
                {[...visited]
                  .filter((path) => content.program.files.has(path))
                  .map((path) => (
                    <div
                      key={path}
                      className="pm-file-view"
                      hidden={path !== file}
                    >
                      <CodeEditor
                        path={path}
                        value={content.program.files.get(path)!.source}
                        readOnly={!edit}
                        target={target?.path === path ? target : undefined}
                        zh={t('program') === '程序'}
                        onChange={(source) =>
                          run([{ kind: 'replace-file', path, source }])
                        }
                      />
                    </div>
                  ))}
              </>
            ) : (
              <div className="pm-empty">{t('noSelection')}</div>
            )}
          </div>
          <div className="pm-text-editor" hidden={part !== 'texts'}>
            {edit && (
              <div className="pm-language-bar">
                <Field label={t('defaultLanguage')}>
                  <Select
                    label={t('defaultLanguage')}
                    value={content.texts.defaultLanguage}
                    options={[...content.texts.languages.keys()].map((id) => ({
                      id,
                      label: id,
                    }))}
                    onChange={(language) =>
                      run([{ kind: 'set-default-language', language }])
                    }
                  />
                </Field>
                <Button
                  disabled={language === content.texts.defaultLanguage}
                  onClick={() =>
                    ask({
                      title: t('deleteLanguage') + ' · ' + language,
                      description: t('removeLanguageHint'),
                      danger: true,
                      submit: () => {
                        edit([{ kind: 'delete-language', language }])
                        setLang(content.texts.defaultLanguage)
                      },
                    })
                  }
                >
                  {t('deleteLanguage')}
                </Button>
              </div>
            )}
            {selected ? (
              <>
                <div className="pm-file-toolbar">
                  <strong>{key}</strong>
                  <div className="pm-row">
                    {edit ? (
                      <>
                        <Button size="sm" onClick={() => rename('text', key)}>
                          {t('rename')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => remove([{ kind: 'delete-text', key }])}
                        >
                          {t('delete')}
                        </Button>
                      </>
                    ) : (
                      restore && (
                        <Button
                          size="sm"
                          onClick={() => restore({ kind: 'text', key })}
                        >
                          {t('restoreText')}
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <Field label={t('description')}>
                  <textarea
                    aria-label={t('description')}
                    className="pm-description"
                    readOnly={!edit}
                    value={selected.description ?? ''}
                    onChange={(e) =>
                      run([
                        {
                          kind: 'set-description',
                          key,
                          description: e.target.value || null,
                        },
                      ])
                    }
                  />
                </Field>
                <Field label={t('translation') + ' · ' + language}>
                  {translation ? (
                    <textarea
                      aria-label={t('translation')}
                      readOnly={!edit}
                      value={translation.text}
                      onChange={(e) =>
                        run([
                          {
                            kind: 'set-translation',
                            key,
                            language,
                            text: e.target.value,
                          },
                        ])
                      }
                    />
                  ) : (
                    <div className="pm-empty-translation">
                      <span>{t('missing')}</span>
                      {edit && (
                        <Button
                          onClick={() =>
                            run([
                              {
                                kind: 'set-translation',
                                key,
                                language,
                                text: '',
                              },
                            ])
                          }
                        >
                          {t('addTranslation')}
                        </Button>
                      )}
                    </div>
                  )}
                </Field>
                {translation?.text === '' && (
                  <span className="pm-muted">{t('emptyTranslation')}</span>
                )}
                {edit && translation && (
                  <Button
                    onClick={() =>
                      remove([{ kind: 'delete-translation', key, language }])
                    }
                  >
                    {t('deleteTranslation')}
                  </Button>
                )}
              </>
            ) : (
              <div className="pm-empty">{t('noSelection')}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
