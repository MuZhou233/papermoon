import { useEffect, useState } from 'react'
import { Button, CodeEditor, Field, Input, Select, Tabs } from '@papermoon/ui'
import { capabilities, type Capability, type PlaybookContent, type RestoreSelection } from '@papermoon/playbook-core'
import type { EditableOperation } from '../protocol.ts'
import type { Ask } from './dialog.tsx'
import type { T } from './locales.ts'
import type { DiagnosticTarget } from './compilation.tsx'
import { AuthoringIcon, AuthoringSelect } from './authoring-controls.tsx'
interface Props {
  allowed?: readonly Capability[]
  content: PlaybookContent
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
function ScriptContentEditor({
  content,
  t,
  ask,
  identity,
  edit,
  restore,
  target,
}: Props) {
  const storageKey = 'papermoon.selection/' + identity,
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

/** Authoring modes and highlighting have independent lifetimes. */
export function ContentEditor(props: Props) {
  const { content, edit, t, identity, allowed = capabilities } = props
  const zh = t('save').startsWith('保存')
  const label = (en: string, cn: string) => zh ? cn : en
  const parts = [
    ...(allowed.includes('system.read') ? [{ id: 'systemPrompt', label: label('System prompt', '系统提示词') }] : []),
    ...(allowed.includes('opening.read') ? [{ id: 'opening', label: label('Opening messages', '开场白') }] : []),
    ...(allowed.includes('program.read') && allowed.includes('texts.read') ? [{ id: 'program', label: label('Program and text catalog', '程序与文案目录') }] : []),
  ]
  const [selected, select] = useState(content.systemPrompt.mode === 'script' && content.opening.mode === 'script' ? 'program' : 'systemPrompt')
  useEffect(() => { if (props.target) select('program') }, [props.target])
  const part = parts.some(p => p.id === selected) ? selected : parts[0]?.id
  const [highlight, setHighlight] = useState<'markdown' | 'xml'>(() => localStorage.getItem('papermoon.highlight/' + identity) === 'xml' ? 'xml' : 'markdown')
  const readonly = !edit || !allowed.includes(part === 'systemPrompt' ? 'system.write' : 'opening.write')
  if (!part) return <p className="pm-empty">{label('Story Guide introduces the next activity.', '故事引导将介绍接下来的活动。')}</p>
  const mode = part === 'systemPrompt' ? content.systemPrompt.mode : content.opening.mode
  const messages = content.opening.messages
  const saveMessages = (next: typeof messages) => edit?.([{ kind: 'set-opening-messages', messages: [...next] }])
  const move = (at: number, delta: number) => { const next = [...messages]; const [item] = next.splice(at, 1); next.splice(at + delta, 0, item!); saveMessages(next) }
  return <section className="pm-authoring" data-playbook-authoring={part}>
    <Tabs label={label('Authoring', '创作')} value={part} items={parts} onChange={select} />
    {part === 'program' ? <ScriptContentEditor {...props} /> : <div className="pm-authoring-surface">
      <div className="pm-authoring-toolbar">
        {allowed.includes('modes') && edit
          ? <AuthoringSelect label={label('Authoring mode', '创作模式')} value={mode} options={[{ id: 'plain', label: label('Plain text', '纯文本') }, { id: 'script', label: label('Script', '脚本') }]} onChange={value => edit([{ kind: 'set-authoring-mode', target: part as 'systemPrompt' | 'opening', mode: value as 'plain' | 'script' }])} />
          : <span className="pm-authoring-format"><AuthoringIcon name="code" />{mode === 'plain' ? label('Plain text', '纯文本') : label('Script', '脚本')}</span>}
        <div className="pm-authoring-toolbar-end">
          {readonly && <span className="pm-badge">{t('readOnly')}</span>}
          {mode === 'plain' && <AuthoringSelect label={label('Syntax highlighting', '语法高亮')} value={highlight} options={[{ id: 'markdown', label: 'Markdown', icon: 'markdown' }, { id: 'xml', label: 'XML', icon: 'code' }]} onChange={value => { setHighlight(value as 'markdown' | 'xml'); localStorage.setItem('papermoon.highlight/' + identity, value) }} />}
        </div>
      </div>
      {mode === 'script' ? <p className="pm-authoring-script-hint">{label('The selected program supplies this component.', '所选程序提供这一部分的内容。')}</p>
        : part === 'systemPrompt' ? <div className="pm-literal-editor pm-system-editor" data-story-target="system-prompt"><CodeEditor value={content.systemPrompt.text} path="system-prompt" highlight={highlight} readOnly={readonly} zh={zh} onChange={text => edit?.([{ kind: 'set-system-prompt', text }])} /></div>
        : <div className="pm-opening-list" data-story-target="opening">
          {!messages.length && <div className="pm-opening-empty"><AuthoringIcon name="message" /><p>{label('No opening messages. You can add one or keep the opening empty.', '暂无开场消息。你可以添加消息，也可以保持空开场。')}</p></div>}
          {messages.map((item, index) => <section key={item.id} className="pm-opening-message">
            <header className="pm-opening-toolbar">
              <span className="pm-message-number">{String(index + 1).padStart(2, '0')}</span>
              <AuthoringSelect label={label('Message role', '消息角色')} value={item.role} tone={item.role} showLabel={false} disabled={readonly} options={[{ id: 'user', label: 'user' }, { id: 'assistant', label: 'assistant' }]} onChange={role => saveMessages(messages.map(m => m.id === item.id ? { ...m, role: role as 'user' | 'assistant' } : m))} />
              <div className="pm-message-actions">
                <Button size="sm" className="pm-editor-icon-button" disabled={readonly || index === 0} aria-label={label('Move up', '上移')} title={label('Move up', '上移')} onClick={() => move(index, -1)}><AuthoringIcon name="up" /></Button>
                <Button size="sm" className="pm-editor-icon-button" disabled={readonly || index === messages.length - 1} aria-label={label('Move down', '下移')} title={label('Move down', '下移')} onClick={() => move(index, 1)}><AuthoringIcon name="down" /></Button>
                <span className="pm-message-action-divider" />
                <Button size="sm" className="pm-editor-icon-button pm-message-delete" disabled={readonly} aria-label={t('delete')} title={t('delete')} onClick={() => saveMessages(messages.filter(m => m.id !== item.id))}><AuthoringIcon name="delete" /></Button>
              </div>
            </header>
            <div className="pm-literal-editor"><CodeEditor path={'opening-' + item.id} value={item.content} highlight={highlight} readOnly={readonly} zh={zh} onChange={text => saveMessages(messages.map(m => m.id === item.id ? { ...m, content: text } : m))} /></div>
          </section>)}
          <Button className="pm-add-opening" disabled={readonly} icon={<AuthoringIcon name="plus" />} onClick={() => saveMessages([...messages, { id: crypto.randomUUID(), role: 'assistant', content: '' }])}>{label('Add message', '新增消息')}</Button>
        </div>}
    </div>}
  </section>
}
