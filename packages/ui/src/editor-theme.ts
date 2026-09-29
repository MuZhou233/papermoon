import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

// CSS variables follow the host's resolved theme without rebuilding editor state.
export const editorHighlightStyle = HighlightStyle.define([
  { tag: [tags.meta, tags.comment], color: 'var(--shiki-token-comment)' },
  { tag: [tags.keyword, tags.tagName], color: 'var(--shiki-token-keyword)' },
  { tag: [tags.atom, tags.bool, tags.number], color: 'var(--shiki-token-constant)' },
  { tag: [tags.string, tags.inserted], color: 'var(--shiki-token-string)' },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: 'var(--shiki-token-string-expression)' },
  { tag: [tags.attributeName, tags.propertyName, tags.typeName, tags.namespace, tags.className], color: 'var(--shiki-token-parameter)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--shiki-token-function)' },
  { tag: [tags.punctuation, tags.operator, tags.contentSeparator], color: 'var(--shiki-token-punctuation)' },
  { tag: [tags.link, tags.url], color: 'var(--shiki-token-link)', textDecoration: 'underline' },
  { tag: tags.heading, color: 'var(--pm-fg)', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.invalid, tags.deleted], color: 'var(--dsw-alias-state-error-primary)' },
])

export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--pm-bg)',
    color: 'var(--pm-fg)',
    fontSize: '13px',
  },
  '&.cm-focused': { outlineColor: 'var(--dsw-alias-state-business-primary)' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  // Native carets and selections need styles on the editable content itself.
  '.cm-content': { padding: '12px 0', caretColor: 'var(--pm-fg)' },
  '.cm-content::selection, .cm-content ::selection': {
    backgroundColor: 'var(--pm-selection)',
    color: 'var(--pm-fg)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--pm-bg)',
    color: 'var(--pm-muted)',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--pm-hover)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--pm-fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--pm-selection)',
  },
  '.cm-panels, .cm-tooltip': {
    backgroundColor: 'var(--pm-surface)',
    color: 'var(--pm-fg)',
    borderColor: 'var(--pm-border)',
  },
  '.cm-textfield': {
    backgroundColor: 'var(--pm-bg)',
    color: 'var(--pm-fg)',
    caretColor: 'var(--pm-fg)',
    border: '1px solid var(--pm-border)',
    borderRadius: '6px',
    fontSize: '12px',
  },
  '.cm-textfield:focus-visible': {
    outline: '2px solid var(--dsw-alias-state-business-primary)',
    outlineOffset: '1px',
  },
  '.cm-button': {
    color: 'var(--pm-fg)',
    border: '1px solid var(--pm-border)',
    borderRadius: '6px',
    fontSize: '12px',
  },
  '.cm-button, .cm-button:active': {
    backgroundImage: 'none',
    backgroundColor: 'var(--dsw-alias-bg-layer-2)',
  },
  '.cm-button:hover, .cm-button:active': {
    backgroundColor: 'var(--dsw-alias-interactive-bg-hover-solid)',
  },
  '.cm-searchMatch, .cm-selectionMatch, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--pm-selection)',
  },
  '.cm-searchMatch-selected': {
    outline: '1px solid var(--dsw-alias-state-business-primary)',
  },
  '&.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: 'var(--dsw-alias-code-diff-deleted)',
    outline: '1px solid var(--dsw-alias-state-error-primary)',
  },
  '&.cm-merge-a .cm-changedLine': { backgroundColor: 'var(--dsw-alias-code-diff-deleted)' },
  '&.cm-merge-b .cm-changedLine': { backgroundColor: 'var(--dsw-alias-code-diff-added)' },
  '&.cm-merge-a .cm-changedText': {
    background: 'linear-gradient(var(--dsw-alias-state-error-primary), var(--dsw-alias-state-error-primary)) bottom/100% 2px no-repeat',
  },
  '&.cm-merge-b .cm-changedText': {
    background: 'linear-gradient(var(--dsw-alias-state-success-secondary), var(--dsw-alias-state-success-secondary)) bottom/100% 2px no-repeat',
  },
  '&.cm-merge-a .cm-changedLineGutter': { backgroundColor: 'var(--dsw-alias-state-error-primary)' },
  '&.cm-merge-b .cm-changedLineGutter': { backgroundColor: 'var(--dsw-alias-state-success-secondary)' },
})
