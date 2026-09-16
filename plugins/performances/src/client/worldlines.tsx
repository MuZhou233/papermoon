import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Modal, Select, PromptTrace } from '@papermoon/ui'
import type { Runtime } from './runtime.ts'
import type { Performances } from '../service.ts'
import type { WorldNode } from '../worldlines.ts'
import type { T } from './locales.ts'
function outcome(value: string, t: T) {
  switch (value) { case 'completed': return t('completed'); case 'interrupted': return t('interrupted'); case 'aborted': return t('aborted'); case 'error': return t('failed'); case 'blocked': return t('blocked'); case 'max-tokens': return t('truncated'); case 'initialized': return t('rootNode'); default: return value }
}
function text(node: WorldNode) { return node.input?.content.flatMap(part => part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part ? [String(part.text)] : []).join('\n') ?? '' }
function WorldActions({ runtime, t, node }: { runtime: Runtime; t: T; node: WorldNode }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const tree = view?.worldline, siblings = tree?.nodes.filter(item => item.parent === node.parent) ?? []
  const run = async (kind: 'select' | 'reroll' | 'candidate', id = node.id) => {
    setBusy(true); setError('')
    try {
      await runtime.operation(kind, id)
    } catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <div className="ppm-world-actions">
    <Button variant="outline" icon={<WorldIcon kind="switch" />} disabled={busy || !!tree?.pending} onClick={() => void run('select')}>{t('branchHere')}</Button>
    {node.parent && <Button variant="outline" icon={<WorldIcon kind="reroll" />} disabled={busy || !!tree?.pending} onClick={() => void run('reroll')}>{t('reroll')}</Button>}
    {siblings.length > 1 && <Select label={t('candidates')} value={node.id} disabled={busy || !!tree?.pending} options={siblings.map(item => ({ id: item.id, label: '#' + item.ordinal + ' · ' + outcome(item.outcome,t) }))} onChange={id => void run('candidate', id)} />}
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
function WorldIcon({ kind }: { kind: 'locate' | 'switch' | 'chevron' | 'tree' | 'reroll' }) {
  const paths = {
    reroll: 'M13 6A5 5 0 1 0 13 10M13 2v4H9',
    locate: 'M8 1v3m0 8v3M1 8h3m8 0h3M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    switch: 'M3 8h10M8 3l5 5-5 5',
    chevron: 'm6 4 4 4-4 4',
    tree: 'M4 4v8m0-6c0 3 8 0 8 4M4 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 11a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8-2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  }
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
function OutcomeBadge({ node, t }: { node: Pick<WorldNode, 'outcome'>; t: T }) {
  return <span className="ppm-world-outcome" data-outcome={node.outcome}>{outcome(node.outcome, t)}</span>
}
function SwitchHere({ runtime, t, node }: { runtime: Runtime; t: T; node: WorldNode }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const select = async () => {
    setBusy(true); setError('')
    try { await runtime.operation('select', node.id) }
    catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <div className="ppm-world-switch">
    <Button variant="primary" icon={<WorldIcon kind="switch" />} disabled={busy || !!view?.worldline?.pending || view?.worldline?.selected === node.id} onClick={() => void select()}>{t('switchHere')}</Button>
    {error && <p className="ppm-error" role="alert">{error}</p>}
  </div>
}
export function WorldlineView({ runtime, t }: { runtime: Runtime; t: T }) {
  const { sessionId, view, error } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const tree = view?.worldline
  const [inspected, setInspected] = useState<string>(), [detail, setDetail] = useState<Awaited<ReturnType<Performances['node']>>>(), [detailError, setDetailError] = useState('')
  const [offset, setOffset] = useState(0), [page, setPage] = useState<Awaited<ReturnType<Performances['tree']>>>(), initialized = useRef<string>(), locate = useRef(false), list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tree?.selected || initialized.current === sessionId) return
    initialized.current = sessionId; setInspected(tree.selected)
    const ordinal = tree.nodes.find(node => node.id === tree.selected)?.ordinal ?? 0
    setOffset(Math.floor(ordinal / 100) * 100)
    locate.current = true
  }, [sessionId, tree])
  useEffect(() => {
    if (!sessionId || !inspected) return
    let active = true; setDetail(undefined); setDetailError('')
    void runtime.call<Awaited<ReturnType<Performances['node']>>>('node', { sessionId, nodeId: inspected }).then(result => { if (active) setDetail(result) }, error => { if (active) setDetailError(String(error)) })
    return () => { active = false }
  }, [sessionId, inspected, tree?.count, runtime])
  useEffect(() => {
    if (!sessionId) return
    let active = true
    void runtime.call<Awaited<ReturnType<Performances['tree']>>>('tree', { sessionId, offset, limit: 100 }).then(value => { if (active) setPage(value) }, error => { if (active) setDetailError(String(error)) })
    return () => { active = false }
  }, [sessionId, offset, tree?.count, runtime])
  useEffect(() => {
    if (!page || !locate.current) return
    const frame = requestAnimationFrame(() => {
      const current = list.current?.querySelector('.ppm-inspected')
      if (current) { current.scrollIntoView({ block: 'center' }); locate.current = false }
    })
    return () => cancelAnimationFrame(frame)
  }, [page, inspected])
  if (!tree) return <div className="ppm-world-empty">{error ?? t('loading')}</div>
  if (tree.legacy) return <div className="ppm-world-empty">{t('legacy')}</div>
  const visible = page?.items ?? [], width = (Math.max(0, ...visible.map(node => node.lane)) + 1) * 24 + 18
  const x = (lane: number) => 12 + lane * 24
  const browse = (node: Pick<WorldNode, 'id' | 'ordinal'>) => {
    setOffset(Math.floor(node.ordinal / 100) * 100); setInspected(node.id); locate.current = true
    const current = inspected === node.id ? list.current?.querySelector('.ppm-inspected') : undefined
    if (current) { current.scrollIntoView({ block: 'center' }); locate.current = false }
  }
  const current = tree.nodes.find(node => node.id === tree.selected)
  return <section className="ppm-world pm-theme" aria-label={t('worldlines')}>
    <header className="ppm-world-header">
      <div className="ppm-world-heading"><WorldIcon kind="tree" /><h2>{t('worldlines')}</h2><span className="ppm-world-current">{t('currentNode')} #{current?.ordinal}</span></div>
      <Button size="sm" variant="outline" icon={<WorldIcon kind="locate" />} onClick={() => { if (current) browse(current) }}>{t('locateCurrent')}</Button>
    </header>
    {tree.pending && <p className="ppm-world-notice" role="status">{t('generating')}</p>}
    <div className="ppm-world-columns"><div className="ppm-world-list" ref={list}>
      <div className="ppm-world-graph" style={{ minHeight: visible.length * 96, minWidth: width + 180 }}>
        <svg width={width} height={visible.length * 96} aria-hidden="true">{visible.map(node => {
          const parent = node.parentOrdinal === null ? null : { ordinal: node.parentOrdinal, lane: node.parentLane! }
          return <g key={node.id} className={tree.path.includes(node.id) ? 'ppm-path' : ''}>{parent && <path data-world-edge={node.id} data-parent-node={node.parent} data-lane={node.lane} d={parent.ordinal < offset
            ? 'M ' + x(node.lane) + ' 0 V ' + ((node.ordinal - offset) * 96 + 26)
            : 'M ' + x(parent.lane) + ' ' + ((parent.ordinal - offset) * 96 + 26)
              + (parent.lane === node.lane ? '' : ' C ' + x(parent.lane) + ' ' + ((parent.ordinal - offset) * 96 + 50) + ' ' + x(node.lane) + ' ' + ((parent.ordinal - offset) * 96 + 26) + ' ' + x(node.lane) + ' ' + ((parent.ordinal - offset) * 96 + 50))
              + ' V ' + ((node.ordinal - offset) * 96 + 26)} fill="none" stroke="currentColor" strokeWidth="2" />}<circle cx={x(node.lane)} cy={(node.ordinal - offset) * 96 + 26} r={tree.selected === node.id ? 6 : 4} fill="currentColor" /></g>
        })}</svg>
        <ol style={{ marginLeft: width }}>{visible.map(node => <li key={node.id}><button type="button" className={inspected === node.id ? 'ppm-inspected' : ''} aria-pressed={inspected === node.id} aria-current={tree.selected === node.id ? 'true' : undefined} onClick={() => setInspected(node.id)} onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault(); const next = event.key === 'ArrowDown' ? node.ordinal + 1 : node.ordinal - 1
          list.current?.querySelectorAll<HTMLButtonElement>('li > button')[next - offset]?.focus()
        }}><span className="ppm-world-node-head"><b>#{node.ordinal}</b><OutcomeBadge node={node} t={t} />{tree.selected === node.id ? <span className="ppm-world-current">{t('currentNode')}</span> : tree.path.includes(node.id) ? <span className="ppm-world-path-label">{t('onPath')}</span> : null}<span className="ppm-world-open"><WorldIcon kind="chevron" /></span></span><span className="ppm-world-summary ppm-world-input">{node.parent ? text(node) : t('initialization')}</span><small className="ppm-world-summary">{node.response || (node.parent ? t('noReply') : t('opening'))}</small></button></li>)}</ol>
      </div>
      <div className="ppm-world-pagination">{offset > 0 && <Button size="sm" variant="outline" onClick={() => setOffset(Math.max(0, offset - 100))}>{t('previousNodes')}</Button>}{offset + visible.length < tree.count && <Button size="sm" variant="outline" onClick={() => setOffset(offset + 100)}>{t('loadMore')}</Button>}</div>
    </div><aside className="ppm-world-detail" aria-label={t('inspectNode')}>
      {detailError ? <p className="ppm-error" role="alert">{detailError}</p> : !detail ? <p>{t('loading')}</p> : <>
        <header className="ppm-world-detail-header"><div><span className="ppm-world-eyebrow">{t('inspectNode')}</span><h3>{t('node')} #{detail.node.ordinal}</h3></div><OutcomeBadge node={detail.node} t={t} /></header>
        <div className="ppm-world-toolbar">
          {detail.siblings.length > 1 && <div className="ppm-world-browse"><span>{t('candidates')}</span><Select label={t('candidates')} value={detail.node.id} options={detail.siblings.map(node => ({ id: node.id, label: '#' + node.ordinal + ' · ' + outcome(node.outcome, t) }))} onChange={id => { const node = detail.siblings.find(node => node.id === id); if (node) browse(node) }} /></div>}
          <SwitchHere key={detail.node.id} runtime={runtime} t={t} node={detail.node} />
        </div>
        <p className="ppm-world-hint">{t('browseHint')}</p>
        <section className="ppm-world-content"><h4>{t(detail.node.parent ? 'turnContent' : 'initialization')}</h4>
          {detail.node.parent ? <PromptTrace label={t('content')} labels={{ number: t('number'), role: t('role'), content: t('content') }} messages={[{ id: detail.node.id + ':input', role: 'user', content: text(detail.node) }, ...detail.events.filter(event => detail.node.ranges.some(range => (event.seq ?? -1) >= range.start && (event.seq ?? -1) <= range.end) && event.type === 'assistant/message').map(event => ({ id: String(event.seq), role: 'assistant' as const, content: (event.data as { message: { content: { type: string; text?: string }[] } }).message.content.filter(part => part.type === 'text').map(part => part.text ?? '').join('') }))]} /> : view?.fixed && <PromptTrace label={t('initialization')} labels={{ number: t('number'), role: t('role'), content: t('content') }} messages={[{ id: 'system', role: 'system', content: view.fixed.artifact.context.systemPrompt }, ...view.fixed.artifact.context.messages.map((message, i) => ({ ...message, id: String(i) }))]} />}
        </section>
        <details className="ppm-world-disclosure"><summary><WorldIcon kind="chevron" />{t('nodeState')}</summary><pre>{JSON.stringify(detail.runtime.state, null, 2)}</pre></details>
        <details className="ppm-world-disclosure"><summary><WorldIcon kind="chevron" />{t('records')}</summary><pre>{JSON.stringify(detail.events, null, 2)}</pre></details>
      </>}
    </aside></div>
  </section>
}

/** Accepted input can survive a crash before the Loop enters its first step. */
export function InterruptedInput({ node, runtime, t }: { node: { anchorSeq: number; data: { input: string } }; runtime: Runtime; t: T }) {
  return <section className="ppm-authored"><div className="ppm-preserve">{node.data.input}</div><p>{t('noReply')}</p><TurnActions runtime={runtime} t={t} seq={node.anchorSeq} /></section>
}
export const interruptedInputDefinition = {
  kind: 'papermoon-interrupted-input', target: 'chat',
  match: (event: { type: string; seq: number; data: unknown }) => event.type === 'context/message'
    && (event.data as { message: { source: { plugin?: string } } }).message.source.plugin === 'papermoon.worldline'
    ? { id: String(event.seq), role: 'start' as const } : null,
  start: () => true, update: () => true,
  buildViewNode(context: { key: string; id: string; matches: readonly { event: { seq: number; data: unknown }; location: unknown }[] }) {
    const first = context.matches[0]; if (!first) return null
    const input = (first.event.data as { message: { content: { type: string; text?: string }[] } }).message.content.filter(part => part.type === 'text').map(part => part.text ?? '').join('')
    return { key: context.key, id: context.id, kind: 'papermoon-interrupted-input', target: 'chat', anchorSeq: first.event.seq, location: first.location, visibility: 'visible', data: { input } }
  },
}
