import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { BookIcon, Button, Input, Menu, Modal } from '@papermoon/ui'
import { PRESET } from '../model.ts'
import type { Runtime } from './runtime.ts'
import type { T } from './locales.ts'
interface Props { runtime: Runtime; t: T }
export function PlaybookPicker({ runtime, t, folderPicker, pickerOpen: open, setPickerOpen: setOpen, selectWorkspace }: Props & { folderPicker: ReactNode; pickerOpen: boolean; setPickerOpen(open: boolean): void; selectWorkspace(id: string): Promise<void> }) {
  const mode = useSyncExternalStore(runtime.preset.store.subscribe, runtime.preset.store.getSnapshot)
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [query, setQuery] = useState(''), [busy, setBusy] = useState(false)
  const [playbooks, setPlaybooks] = useState<{ playbookId: string; playbookName: string; projectName: string }[]>([]), [error, setError] = useState('')
  useEffect(() => { if (open) void runtime.call<typeof playbooks>('playbooks').then(setPlaybooks).catch(error => setError(String(error))) }, [open, runtime])
  if (mode.current === 'papermoon-moderator') return null
  if (mode.current !== PRESET) return <>{folderPicker}</>
  const rows = playbooks.filter(row => `${row.projectName} ${row.playbookName}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <button type="button" className="pws-chip" disabled={!!state.view?.fixed || busy || mode.busy} onClick={() => setOpen(true)}>
      <BookIcon size={16} /><span>{state.view?.target?.name ?? t('playbook')}</span><span aria-hidden="true">⌄</span>
    </button>
    <Modal closeLabel={t('close')} open={open} onClose={() => { if (!busy) setOpen(false) }} title={t('playbook')}>
      <div className="pws-picker">
        <Input aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => setQuery(event.target.value)} />
        <div className="pws-playbook-list">{rows.map(row => <button key={row.playbookId} type="button" disabled={busy} className="pws-playbook" onClick={() => {
          setBusy(true); setError('')
          void runtime.workspace(row.playbookId).then(selectWorkspace).then(() => { setOpen(false); void runtime.refresh() }).catch(error => setError(String(error))).finally(() => setBusy(false))
        }}><BookIcon size={18} /><span><strong>{row.playbookName}</strong><small>{row.projectName}</small></span></button>)}{rows.length === 0 && <p>{t('empty')}</p>}</div>
        {error && <p role="alert">{error}</p>}
      </div>
    </Modal>
  </>
}
export function WriterPicker({ runtime, t, active = false }: Props & { active?: boolean }) {
  const mode = useSyncExternalStore(runtime.preset.store.subscribe, runtime.preset.store.getSnapshot)
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [open, setOpen] = useState(false), [writers, setWriters] = useState<{ id: string; sequence: number; name: string }[]>([])
  const [error, setError] = useState('')
  useEffect(() => { void runtime.call<typeof writers>('writers').then(setWriters).catch(error => setError(String(error))) }, [open, runtime])
  if (mode.current !== PRESET || (active && !state.view?.fixed)) return null
  if (!active && state.view?.fixed) return null
  const fixed = state.view?.fixed, selected = fixed?.writer.id ?? state.view?.preparation?.writer?.id
  const label = fixed?.writer.name ?? writers.find(writer => writer.id === selected)?.name ?? t('writer')
  return <div className="pws-writer-row" data-fixed={!!fixed}>
    <Menu open={open} onClose={() => setOpen(false)} portal autoFocus selectedId={selected}
      items={writers.map(writer => ({ id: writer.id, label: writer.name }))}
      footer={[{ id: '::manage', label: t('manage') }]}
      onSelect={id => { setOpen(false); if (id === '::manage') runtime.manage(); else { const writer = writers.find(item => item.id === id)!; void runtime.configure(writer.id, writer.sequence) } }}
      anchor={<button type="button" className="pws-chip" disabled={!!fixed || state.busy || !state.view?.preparation} title={fixed ? `${label} · ${t('frozen')}` : undefined} onClick={() => setOpen(!open)}><BookIcon size={16} /><span>{label}</span><span aria-hidden="true">⌄</span></button>} />
    {!fixed && writers.length === 0 && <Button size="sm" variant="ghost" onClick={() => runtime.manage()}>{t('manage')}</Button>}
    {(state.error || error) && <span role="alert" className="pws-error">{state.error || error}<Button size="sm" variant="ghost" onClick={() => void runtime.refresh()}>{t('refresh')}</Button></span>}
  </div>
}
