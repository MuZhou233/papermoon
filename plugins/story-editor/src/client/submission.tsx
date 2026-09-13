/** Submit settings stay local until the fixed draft has compiled and committed. */
import { useEffect, useRef, useState } from 'react'
import { Button, Field, Input, Modal, Select } from '@papermoon/ui'
import type { StoryContent } from '@papermoon/story-core'
import type { SubmissionResult } from '@papermoon/story-compiler/service'
import type { Api } from './api.ts'
import type { T } from './locales.ts'
import { RevisionPicker } from './revision-picker.tsx'
export function SubmissionDialog({ api, scriptId, sequence, content, t, close, committed }: {
  api: Api; scriptId: string; sequence: number; content: StoryContent; t: T; close: () => void; committed: (result: Extract<SubmissionResult, { committed: true }>) => Promise<void>
}) {
  const [description, setDescription] = useState(''), [references, setReferences] = useState('')
  const [targets, setTargets] = useState([{ entry: 'story.js', language: content.texts.defaultLanguage }])
  const [allow, setAllow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [report, setReport] = useState<SubmissionResult['compilation']>()
  const controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => controller.current?.abort(), [])
  const run = async () => {
    const pending = new AbortController(); controller.current = pending
    setBusy(true); setError(''); setReport(undefined)
    try {
      const result = await api.call('commit', { scriptId, expectedSequence: sequence, description, references: references.split('\n').filter(Boolean), targets, allowCompilationFailure: allow }, pending.signal)
      setReport(result.compilation)
      if (result.committed) { await committed(result); close() }
    } catch (error) { setError(pending.signal.aborted ? t('compileCancelled') : String(error)) }
    finally { controller.current = undefined; setBusy(false) }
  }
  const move = (index: number, delta: number) => setTargets(before => {
    const result = [...before]; [result[index], result[index + delta]] = [result[index + delta]!, result[index]!]; return result
  })
  return <Modal open title={t('commit')} description={t('commitHint')} closeLabel={t('close')} onClose={() => { if (!busy) close() }} footer={<>
    <Button onClick={() => busy ? controller.current?.abort() : close()}>{t('cancel')}</Button>
    <Button variant="primary" disabled={busy || !description.trim() || targets.some(target => !target.entry.trim())} onClick={() => void run()}>{busy ? t('submitting') : t('commit')}</Button>
  </>}>
    <div className="pm-form">
      <Field label={t('revisionDescription')}><textarea disabled={busy} aria-label={t('revisionDescription')} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <Field label={t('references')}><RevisionPicker api={api} t={t} multiple value={references} onChange={setReferences} /></Field>
      <fieldset disabled={busy} className="pm-targets"><legend>{t('compileTargets')}</legend>
        {targets.map((target, index) => <div className="pm-target" key={index}>
          <span className="pm-muted">{index + 1}{index === 0 ? ' · ' + t('defaultResult') : ''}</span>
          <Field label={t('compileEntry')}><Input aria-label={t('compileEntry')} value={target.entry} onChange={e => setTargets(targets.map((item, i) => i === index ? { ...item, entry: e.target.value } : item))} /></Field>
          <Field label={t('compileLanguage')}><Select label={t('compileLanguage')} value={target.language} options={[...content.texts.languages.keys()].map(id => ({ id, label: id }))} onChange={language => setTargets(targets.map((item, i) => i === index ? { ...item, language } : item))} /></Field>
          <div className="pm-actions"><Button disabled={busy || index === 0} aria-label={t('moveUp')} onClick={() => move(index, -1)}>↑</Button><Button disabled={busy || index === targets.length - 1} aria-label={t('moveDown')} onClick={() => move(index, 1)}>↓</Button><Button disabled={busy || targets.length === 1} onClick={() => setTargets(targets.filter((_, i) => i !== index))}>{t('removeTarget')}</Button></div>
        </div>)}
        <Button disabled={busy} onClick={() => setTargets([...targets, { entry: 'story.js', language: content.texts.defaultLanguage }])}>{t('addTarget')}</Button>
      </fieldset>
      <label className="pm-row"><input type="checkbox" disabled={busy} checked={allow} onChange={e => setAllow(e.target.checked)} />{t('allowCompilationFailure')}</label>
      {report && <div role="alert"><p className="pm-error">{t('compileFailure')}</p>{report.targets.map((target, i) => <section key={i}><strong>{target.entry} · {target.language}</strong><ul>{target.diagnostics.map((d, j) => <li key={j}><code>{d.code}</code> {d.message}</li>)}</ul></section>)}</div>}
      {error && <p role="alert" className="pm-error">{error}</p>}
    </div>
  </Modal>
}
