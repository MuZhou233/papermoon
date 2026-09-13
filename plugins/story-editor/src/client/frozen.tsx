/** Historical previews only read attached artifacts; there is no compilation action here. */
import { useEffect, useState } from 'react'
import { PromptTrace, Select } from '@papermoon/ui'
import type { Results } from '../service.ts'
import type { Api } from './api.ts'
import type { T } from './locales.ts'
export function FrozenCompilation({ api, scriptId, revisionId, t }: { api: Api; scriptId: string; revisionId: string; t: T }) {
  const [report, setReport] = useState<Results['revisionCompilation']>(), [key, setKey] = useState('')
  const [result, setResult] = useState<Results['revisionArtifact']>(), [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    void api.call('revisionCompilation', { scriptId, revisionId }).then(report => { if (alive) { setReport(report); setKey(report?.targets[0]?.attachmentKey ?? '') } }).catch(error => { if (alive) setError(String(error)) })
    return () => { alive = false }
  }, [api, scriptId, revisionId])
  useEffect(() => {
    setResult(undefined)
    if (!key) return
    let alive = true
    void api.call('revisionArtifact', { scriptId, revisionId, key }).then(result => { if (alive) { setResult(result); setError('') } }).catch(error => { if (alive) setError(String(error)) })
    return () => { alive = false }
  }, [api, scriptId, revisionId, key])
  return <section className="pm-compilation">
    {error && <p className="pm-error" role="alert">{t('frozenDataError')}: {error}</p>}
    {report !== undefined && <p>{report?.status === 'success' ? t('attachedResults') : t('noArtifacts')}</p>}
    {report?.status === 'success' && <Select label={t('frozenResult')} value={key} options={report.targets.map(target => ({ id: target.attachmentKey!, label: target.language + ' · ' + target.entry }))} onChange={setKey} />}
    {report?.targets.map((target, i) => target.diagnostics.length > 0 && <details key={i}><summary>{target.entry} · {target.language}</summary><ul>{target.diagnostics.map((d,j) => <li key={j}>{d.code}: {d.message}</li>)}</ul></details>)}
    {result && <PromptTrace label={t('openingPreview')} labels={{ number: t('messageNumber'), role: t('messageRole'), content: t('messageContent') }} messages={[
      { id: 'system', role: 'system', name: result.context.systemPromptName, content: result.context.systemPrompt },
      ...result.context.messages.map((message,index) => ({ ...message, id: String(index) })),
    ]} />}
  </section>
}
