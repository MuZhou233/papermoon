/** Explicit compilation and restored previews always retain the source identity that produced them. */
import { useEffect, useRef, useState } from 'react'
import { Button, Field, Input, PromptTrace, Select, FunctionPreview } from '@papermoon/ui'
import type { StoryContent } from '@papermoon/story-core'
import type { CompilationReceipt } from '@papermoon/story-compiler/service'
import type { Diagnostic } from '@papermoon/story-compiler/types'
import type { Params } from '../protocol.ts'
import type { Api } from './api.ts'
import type { Ask } from './dialog.tsx'
import type { T } from './locales.ts'
export type DiagnosticTarget = NonNullable<Diagnostic['location']> & { nonce: number }
interface Props {
  api: Api
  source: Params<'compile'>
  content: StoryContent
  t: T
  ask: Ask
  dirty?: boolean
  blocked?: boolean
  save?: () => Promise<Params<'compile'>>
  locate: (target: DiagnosticTarget) => void
  verify?: () => Promise<boolean>
}
export function CompilationPanel({ api, source, content, t, ask, dirty = false, blocked = false, save, locate, verify }: Props) {
  const identity = source.scriptId + '/draft'
  const key = 'papermoon.compile.v1/' + identity
  const [settings] = useState(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (!value || typeof value !== 'object') return {}
      return { entry: 'entry' in value && typeof value.entry === 'string' ? value.entry : undefined, language: 'language' in value && typeof value.language === 'string' ? value.language : undefined }
    } catch { return {} }
  })
  const [entry, setEntry] = useState(settings.entry ?? 'story.js')
  const [language, setLanguage] = useState(settings.language && content.texts.languages.has(settings.language) ? settings.language : content.texts.defaultLanguage)
  const [result, setResult] = useState<{ receipt: CompilationReceipt; request: string }>()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const generation = useRef(0), controller = useRef<AbortController | undefined>(undefined), nonce = useRef(0)
  const effectiveLanguage = content.texts.languages.has(language) ? language : content.texts.defaultLanguage
  const params = { ...source, entry, language: effectiveLanguage }, requestKey = JSON.stringify(params)
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ entry, language })) } catch { /* Compilation preferences are optional; artifacts remain on the server. */ }
  }, [key, entry, language])
  useEffect(() => {
    const current = ++generation.current, pending = new AbortController()
    const timer = setTimeout(() => {
      void api.call('compiled', JSON.parse(requestKey) as Params<'compiled'>, pending.signal).then(receipt => {
        if (generation.current === current && receipt) setResult({ receipt, request: requestKey })
      }).catch(error => { if (!pending.signal.aborted && generation.current === current) setError(String(error)) })
    }, 200)
    return () => { clearTimeout(timer); pending.abort(); generation.current++ }
  }, [api, requestKey])
  useEffect(() => () => { controller.current?.abort() }, [])
  const run = async (p: Params<'compile'>) => {
    generation.current++
    const pending = new AbortController(); controller.current = pending
    setBusy(true); setError('')
    try {
      const receipt = await api.call('compile', p, pending.signal)
      setResult({ receipt, request: JSON.stringify(p) })
    } catch (error) { setError(pending.signal.aborted ? t('compileCancelled') : String(error)) }
    finally { setBusy(false); if (controller.current === pending) controller.current = undefined }
  }
  const start = () => {
    if (dirty && save) {
      ask({ title: t('saveAndCompile'), description: t('saveCompileHint'), submitLabel: t('saveAndCompile'), submit: async () => {
        const saved = await save()
        await run({ ...saved, entry, language: effectiveLanguage })
      } })
    } else void run(params)
  }
  const stale = !!result && (dirty || blocked || result.request !== requestKey)
  const receipt = result?.receipt
  const navigate = async (location: NonNullable<Diagnostic['location']>) => {
    try { if (!verify || await verify()) locate({ ...location, nonce: ++nonce.current }) }
    catch (error) { setError(String(error)) }
  }
  return <section className="pm-compilation" aria-label={t('compilation')}>
    <div className="pm-compile-controls">
      <Field label={t('compileEntry')}><Input aria-label={t('compileEntry')} value={entry} onChange={e => { setEntry(e.target.value); setError('') }} /></Field>
      <Field label={t('compileLanguage')}><Select label={t('compileLanguage')} value={effectiveLanguage} options={[...content.texts.languages.keys()].map(id => ({ id, label: id }))} onChange={value => { setLanguage(value); setError('') }} /></Field>
      <Button variant="outline" disabled={busy || blocked} onClick={start}>{busy ? t('compiling') : t('compile')}</Button>
      {busy && <Button onClick={() => controller.current?.abort()}>{t('cancel')}</Button>}
      <span className="pm-muted" role="status">{stale ? t('compileStale') : receipt ? receipt.ok ? t('compileSuccess') : t('compileFailure') : t('notCompiled')}</span>
    </div>
    {error && <p role="alert" className="pm-error">{error}</p>}
    {receipt && <>
      <div className="pm-compile-origin">
        <span>{t('source')}: {receipt.source.kind === 'draft' ? t('draft') + ' · ' + receipt.source.sequence : t('revision') + ' · ' + receipt.source.revisionId}</span>
        {receipt.ok && <code title={receipt.artifactId}>{receipt.artifactId.slice(0, 12)}</code>}
      </div>
      {receipt.diagnostics.length > 0 && <ul className="pm-diagnostics" aria-label={t('compileDiagnostics')}>
        {receipt.diagnostics.map((diagnostic, index) => <li key={index}>
          <code>{diagnostic.code}</code><span>{diagnostic.message}</span>
          {diagnostic.location && <Button size="sm" disabled={stale || (!diagnostic.location.path && !diagnostic.location.key)} onClick={() => void navigate(diagnostic.location!)}>
            {diagnostic.location.key !== undefined ? diagnostic.location.key + ' · ' + diagnostic.location.language : diagnostic.location.path ? diagnostic.location.path + (diagnostic.location.line ? ':' + diagnostic.location.line : '') : diagnostic.location.field}
          </Button>}
          {diagnostic.chain && <small>{diagnostic.chain.join(' → ')}</small>}
        </li>)}
      </ul>}
      {receipt.ok && <FunctionPreview state={receipt.state.initial} functions={receipt.functions} labels={{ state: t('initialState'), functions: t('functions'), parameters: t('functionParameters'), returns: t('functionReturns') }} />}
      {receipt.ok && <details className="pm-opening-preview" open>
        <summary>{t('openingPreview')}</summary>
        <PromptTrace label={t('openingPreview')} labels={{ number: t('messageNumber'), role: t('messageRole'), content: t('messageContent') }} messages={[
          { id: 'system', role: 'system', name: receipt.context.systemPromptName, content: receipt.context.systemPrompt },
          ...receipt.context.messages.map((message, index) => ({ ...message, id: String(index) })),
        ]} />
      </details>}
    </>}
  </section>
}
