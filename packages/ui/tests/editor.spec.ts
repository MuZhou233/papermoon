// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { undo, undoDepth } from '@codemirror/commands'
import { CodeEditor } from '../src/editor.tsx'
afterEach(cleanup)
test('language reconfiguration retains the document, selection and undo history', () => {
  const props = { path: 'system-prompt', value: '# Keeper\n<unfinished', onChange: () => {} }
  const rendered = render(createElement(CodeEditor, { ...props, highlight: 'markdown' }))
  const view = EditorView.findFromDOM(rendered.container.querySelector('.cm-editor')!)!
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: '>words' }, selection: { anchor: 4 } }))
  const text = view.state.doc.toString(), depth = undoDepth(view.state)
  rendered.rerender(createElement(CodeEditor, { ...props, value: text, highlight: 'xml' }))
  expect(EditorView.findFromDOM(rendered.container.querySelector('.cm-editor')!)).toBe(view)
  expect(view.state.doc.toString()).toBe(text)
  expect(view.state.selection.main.anchor).toBe(4)
  expect(undoDepth(view.state)).toBe(depth)
  act(() => { undo(view) })
  expect(view.state.doc.toString()).toBe(props.value)
})
