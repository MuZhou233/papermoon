import { useState, useSyncExternalStore } from 'react'
import { Button, Modal, Menu } from '@papermoon/ui'
import type { Runtime } from './runtime.ts'
import type { WorldNode } from '../worldlines.ts'
import type { T } from './locales.ts'
function outcome(value: string, t: T) {
  switch (value) { case 'completed': return t('completed'); case 'interrupted': return t('interrupted'); case 'aborted': return t('aborted'); case 'error': return t('failed'); case 'blocked': return t('blocked'); case 'max-tokens': return t('truncated'); case 'initialized': return t('rootNode'); default: return value }
}
function text(node: WorldNode) { return node.input?.content.flatMap(part => part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part ? [String(part.text)] : []).join('\n') ?? '' }
function WorldActions({ runtime, t, node }: { runtime: Runtime; t: T; node: WorldNode }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const tree = view?.worldline, siblings = tree?.nodes.filter(item => item.parent === node.parent).sort((a, b) => a.ordinal - b.ordinal) ?? []
  const index = siblings.findIndex(item => item.id === node.id), disabled = busy || !!tree?.pending
  const run = async (kind: 'select' | 'reroll' | 'candidate', id = node.id) => {
    setBusy(true); setError(''); setMenuOpen(false)
    try {
      await runtime.operation(kind, id)
    } catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <div className="ppm-world-actions" role="group" aria-label={t('turnActions')}>
    {node.parent && <Button variant="ghost" size="sm" className="ppm-action-icon" title={t('reroll')} aria-label={t('reroll')} icon={<WorldIcon kind="reroll" />} disabled={disabled} onClick={() => void run('reroll')} />}
    <Button variant="ghost" size="sm" className="ppm-action-icon" title={t('branchHere')} aria-label={t('branchHere')} icon={<WorldIcon kind="branch" />} disabled={disabled} onClick={() => void run('select')} />
    {siblings.length > 1 && <div className="ppm-result-navigation">
      <Button variant="ghost" size="sm" className="ppm-action-icon" title={t('previousResult')} aria-label={t('previousResult')} icon={<WorldIcon kind="previous" />} disabled={disabled || index <= 0} onClick={() => void run('candidate', siblings[index - 1]!.id)} />
      <Menu open={menuOpen && !disabled} onClose={() => setMenuOpen(false)} portal side="top" dense compact autoFocus selectedId={node.id}
        anchor={<Button variant="ghost" size="sm" className="ppm-result-count" title={t('candidates')} aria-label={t('candidates')} aria-haspopup="menu" aria-expanded={menuOpen && !disabled} disabled={disabled} onClick={() => setMenuOpen(!menuOpen)}>{index + 1}<span aria-hidden="true">/</span>{siblings.length}</Button>}
        items={siblings.map((item, position) => ({ id: item.id, label: t('resultNumber').replace('{number}', String(position + 1)) + ' · ' + outcome(item.outcome, t) }))}
        onSelect={id => void run('candidate', id)} />
      <Button variant="ghost" size="sm" className="ppm-action-icon" title={t('nextResult')} aria-label={t('nextResult')} icon={<WorldIcon kind="next" />} disabled={disabled || index >= siblings.length - 1} onClick={() => void run('candidate', siblings[index + 1]!.id)} />
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>
}
export function EditInput({ runtime, t, seq }: { runtime: Runtime; t: T; seq: number }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const tree = view?.worldline, node = tree?.nodes.find(node => node.parent && node.ranges.some(range => seq >= range.start && seq <= range.end))
  const [editing, setEditing] = useState<{ text: string; expectedVersion: number }>(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (!node || !tree) return null
  const submit = async () => {
    if (!editing) return
    setBusy(true); setError('')
    try { await runtime.operation('edit', node.id, editing); setEditing(undefined) }
    catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  const hasAttachments = node.input?.content.some(part => part && typeof part === 'object' && 'type' in part && part.type !== 'text')
  return <>
    {node.outcome === 'interrupted' && node.requests.length === 0 && <span>{t('noReply')}</span>}
    <button type="button" className="ppm-message-edit" aria-label={t('editInput')} title={t('editInput')} disabled={busy || !!tree.pending} onClick={() => { setError(''); setEditing({ text: text(node), expectedVersion: tree.version }) }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m10.5 2.5 3 3m-10 5 7.5-7.5a1.4 1.4 0 0 1 2 2l-7.5 7.5-3.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <Modal open={!!editing} title={t('editInput')} description={t('editInputHint')} closeLabel={t('close')} onClose={() => { if (!busy) setEditing(undefined) }} footer={<><Button disabled={busy} onClick={() => setEditing(undefined)}>{t('cancel')}</Button><Button variant="primary" disabled={busy || !!tree.pending || (!editing?.text.trim() && !hasAttachments)} onClick={() => void submit()}>{t('submitEdit')}</Button></>}>
      <label className="ppm-input-edit-label">{t('inputText')}<textarea autoFocus className="ppm-input-edit-text" value={editing?.text ?? ''} disabled={busy} onChange={event => setEditing(current => current && { ...current, text: event.target.value })} /></label>
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>
}
export function TurnActions({ runtime, t, seq }: { runtime: Runtime; t: T; seq: number }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const node = view?.worldline?.nodes.find(node => node.parent && node.ranges.some(range => seq >= range.start && seq <= range.end))
  return node ? <WorldActions runtime={runtime} t={t} node={node} /> : null
}
function WorldIcon({ kind }: { kind: 'branch' | 'previous' | 'next' | 'reroll' }) {
  const paths = {
    reroll: 'M13 6A5 5 0 1 0 13 10M13 2v4H9',
    branch: 'M4 13V3m0 6c0-4 8-1 8-6m-3 1 3-3 3 3',
    previous: 'm10 4-4 4 4 4',
    next: 'm6 4 4 4-4 4',
  }
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
