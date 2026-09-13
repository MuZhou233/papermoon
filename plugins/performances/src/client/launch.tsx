import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select } from '@papermoon/ui'
import type { Performances, ModelCatalog, ModelSelection } from '../service.ts'
import type { Runtime } from './runtime.ts'
import type { T } from './locales.ts'
export function Launch({ runtime, t }: { runtime: Runtime; t: T }) {
  const [request, setRequest] = useState<{ scriptId?: string; revisionId?: string; id: string }>()
  useEffect(() => {
    const open = (event: Event) => { const detail = (event as CustomEvent<{ scriptId?: string; revisionId?: string }>).detail; setRequest({ ...detail, id: 'performance-' + crypto.randomUUID() }) }
    window.addEventListener('papermoon:performance', open)
    return () => window.removeEventListener('papermoon:performance', open)
  }, [])
  return request ? <LaunchDialog key={request.id} runtime={runtime} t={t} request={request} close={() => setRequest(undefined)} /> : null
}
function LaunchDialog({ runtime, t, request, close }: { runtime: Runtime; t: T; request: { scriptId?: string; revisionId?: string; id: string }; close: () => void }) {
  const [scripts, setScripts] = useState<{ scriptId: string; scriptName: string; projectName: string }[]>([])
  const [scriptId, setScript] = useState(request.scriptId ?? ''), [query, setQuery] = useState(''), [key, setKey] = useState('')
  const [choice, setChoice] = useState<ReturnType<Performances['choices']>>(), [catalog, setCatalog] = useState<ModelCatalog>(), [model, setModel] = useState<ModelSelection>()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    void Promise.all([runtime.call<typeof scripts>('scripts'), runtime.call<ModelCatalog>('models')]).then(([scripts, catalog]) => { if (alive) { setScripts(scripts); setCatalog(catalog); setModel(catalog.default) } }).catch(error => { if (alive) setError(String(error)) })
    return () => { alive = false }
  }, [runtime])
  useEffect(() => {
    setChoice(undefined); setKey('')
    if (!scriptId) return
    let alive = true
    void runtime.call<ReturnType<Performances['choices']>>('choices', { scriptId, ...(request.revisionId ? { revisionId: request.revisionId } : {}) }).then(choice => { if (alive) { setChoice(choice); setKey(choice.compilation?.targets[0]?.attachmentKey ?? ''); setError('') } }).catch(error => { if (alive) setError(String(error)) })
    return () => { alive = false }
  }, [runtime, scriptId, request.revisionId])
  const rows = catalog?.groups.flatMap(group => group.models.map(item => ({ id: JSON.stringify([group.id, item.id]), label: group.name + ' · ' + item.name, group, item }))) ?? []
  const selected = rows.find(row => row.group.id === model?.provider && row.item.id === model?.model)
  const start = async () => {
    if (!choice?.entry || !key) return
    setBusy(true); setError('')
    try {
      const result = await runtime.call<{ sessionId: string }>('start', { sessionId: request.id, scriptId, revisionId: choice.entry.revision.id, key, model })
      await runtime.open(result.sessionId); close()
    } catch (error) { setError(String(error)); setBusy(false) }
  }
  return <Modal open title={t('start')} closeLabel={t('close')} onClose={() => { if (!busy) close() }} footer={<><Button disabled={busy} onClick={close}>{t('cancel')}</Button><Button variant="primary" disabled={busy || !key || !model || !catalog?.routableProviders.includes(model.provider)} onClick={() => void start()}>{busy ? t('loading') : t('start')}</Button></>}>
    <div className="ppm-form">
      {!request.scriptId && <><Input aria-label={t('search')} placeholder={t('search')} value={query} onChange={e => setQuery(e.target.value)} /><Select disabled={busy} label={t('choose')} value={scriptId} options={scripts.filter(s => (s.scriptName + s.projectName).toLowerCase().includes(query.toLowerCase())).map(s => ({ id: s.scriptId, label: s.projectName + ' / ' + s.scriptName }))} onChange={setScript} /></>}
      {choice && <><h3>{choice.script.name}</h3><p>{choice.entry ? t('revision') + ' ' + choice.entry.ordinal : t('noRevision')}</p><p className="ppm-preserve">{choice.entry?.revision.description}</p>
        {choice.compilation?.status === 'success' ? <Select disabled={busy} label={t('result')} value={key} options={choice.compilation.targets.map(target => ({ id: target.attachmentKey!, label: target.language + ' · ' + target.entry }))} onChange={setKey} /> : choice.entry && <p>{t('noArtifact')}</p>}
      </>}
      {catalog && <><Field label={t('model')}><Select disabled={busy} label={t('model')} value={model ? JSON.stringify([model.provider, model.model]) : ''} options={rows} onChange={id => { const row = rows.find(row => row.id === id)!; setModel({ provider: row.group.id, model: row.item.id, ...(row.item.reasoning ? { reasoningEffort: row.item.reasoning.defaultEffort } : {}) }) }} /></Field>
        {selected?.item.reasoning && model && <Field label={t('reasoning')}><Select disabled={busy} label={t('reasoning')} value={model.reasoningEffort ?? selected.item.reasoning.defaultEffort ?? ''} options={selected.item.reasoning.efforts.map(effort => ({ id: effort.id, label: effort.name }))} onChange={reasoningEffort => setModel({ ...model, reasoningEffort })} /></Field>}
        {catalog.failures.map(failure => <p role="alert" key={failure.id}>{failure.name}: {failure.message}</p>)}
      </>}
      {error && <p role="alert" className="ppm-error">{error}</p>}
    </div>
  </Modal>
}
