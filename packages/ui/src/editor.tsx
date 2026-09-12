/** CodeMirror owns editing state, not persisted drafts or revision identities. */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Compartment, EditorState, Annotation } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { MergeView } from '@codemirror/merge'
const external = Annotation.define<boolean>()
const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--pm-bg)',
    color: 'var(--pm-fg)',
    fontSize: '13px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': {
    backgroundColor: 'var(--pm-bg)',
    color: 'var(--pm-muted)',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--pm-hover)' },
  '.cm-cursor': { borderLeftColor: 'var(--pm-fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--pm-selection)',
  },
  '.cm-panels, .cm-tooltip': {
    backgroundColor: 'var(--pm-surface)',
    color: 'var(--pm-fg)',
  },
  '.cm-searchMatch': { backgroundColor: 'var(--pm-selection)' },
})
function language(path: string) {
  return /\.[cm]?[jt]sx?$/.test(path)
    ? javascript({ typescript: /\.tsx?$/.test(path), jsx: path.endsWith('x') })
    : path.endsWith('.json')
      ? json()
      : path.endsWith('.md')
        ? markdown()
        : []
}
function extensions(path: string, readonly: boolean) {
  return [
    theme,
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    syntaxHighlighting(defaultHighlightStyle),
    bracketMatching(),
    indentOnInput(),
    highlightSelectionMatches(),
    language(path),
    EditorState.readOnly.of(readonly),
    EditorView.editable.of(!readonly),
    EditorView.contentAttributes.of({ 'aria-label': path, tabindex: '0' }),
  ]
}
/** Each mounted file retains undo state. Parent keeps its view mounted while switching files. */
export function CodeEditor({
  value,
  path,
  readOnly = false,
  onChange,
  zh = false,
}: {
  value: string
  path: string
  readOnly?: boolean
  onChange?: (text: string) => void
  zh?: boolean
}) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | undefined>(undefined),
    change = useRef(onChange),
    composing = useRef(false)
  change.current = onChange
  const phrases = useRef(new Compartment())
  useLayoutEffect(() => {
    // A fixed separator preserves CRLF and mixed raw source on a no-edit round trip.
    const separator =
      value.includes('\r\n') && !value.replaceAll('\r\n', '').includes('\n')
        ? '\r\n'
        : '\n'
    const instance = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...extensions(path, readOnly),
          EditorState.lineSeparator.of(separator),
          phrases.current.of(EditorState.phrases.of({})),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((t) => t.annotation(external))
            )
              change.current?.(
                update.state.doc.toString().split('\n').join(separator),
              )
          }),
          EditorView.domEventHandlers({
            compositionstart: () => {
              composing.current = true
            },
            compositionend: () => {
              composing.current = false
            },
          }),
        ],
      }),
    })
    view.current = instance
    return () => {
      instance.destroy()
      view.current = undefined
    }
  }, [path, readOnly])
  useEffect(() => {
    const current = view.current
    if (!current || composing.current) return
    const text = current.state.sliceDoc()
    if (text !== value)
      current.dispatch({
        changes: { from: 0, to: current.state.doc.length, insert: value },
        annotations: [external.of(true)],
      })
  }, [value])
  useEffect(() => {
    view.current?.dispatch({
      effects: phrases.current.reconfigure(
        EditorState.phrases.of(
          zh
            ? {
                Find: '查找',
                Replace: '替换',
                next: '下一个',
                previous: '上一个',
                all: '全部',
                'match case': '区分大小写',
                regexp: '正则表达式',
                'by word': '整词',
                replace: '替换',
                'replace all': '全部替换',
                close: '关闭',
              }
            : {},
        ),
      ),
    })
  }, [zh])
  return <div className="pm-code" ref={host} />
}
export function CodeDiff({
  before,
  after,
  path,
}: {
  before: string
  after: string
  path: string
}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const view = new MergeView({
      parent: host.current!,
      a: { doc: before, extensions: extensions(path, true) },
      b: { doc: after, extensions: extensions(path, true) },
      highlightChanges: true,
      gutter: true,
    })
    return () => view.destroy()
  }, [before, after, path])
  return <div className="pm-diff" ref={host} />
}
