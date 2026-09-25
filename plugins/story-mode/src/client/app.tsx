import { useEffect, useSyncExternalStore } from 'react'
import { BookIcon, Button } from '@papermoon/ui'
import { StoryIcon } from './icons.tsx'
import type { Runtime } from './runtime.ts'
import type { T } from '../locales.ts'
import { failureText } from '../errors.ts'
import { effortAdvice } from './effort.ts'
import './style.css'
export interface Props { runtime: Runtime; t: T }
function Meter({ value, t }: { value: number; t: T }) {
  return <div className="pm-story-meter" role="progressbar" aria-label={t('progress')} aria-valuemin={0} aria-valuemax={5} aria-valuenow={value}><span style={{ width: `${value * 20}%` }} /></div>
}
function progressText(t: T, completed: number) { return t('progressTemplate').replace('{completed}', String(completed)).replace('{total}', '5') }
export function Progress({ runtime, t, wide, expandSidebar }: { runtime: Runtime; t: T; wide: boolean; expandSidebar(): void }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const { attempt, models, choice, busy, conversation } = state
  const current = attempt?.step ?? 1
  const selected = models.find(model => model.provider === choice?.provider && model.id === choice.model)
  const advice = effortAdvice(selected, choice)
  const canContinue = current === 1 ? state.modelsStatus === 'ready' && models.some(model => model.ready) : current === 2 || (current === 3 && attempt?.exampleSeen) || (current === 5 && attempt?.trajectorySeen)
  const end = conversation?.events.findLast(event => event.type === 'turn/end')
  const description = ['configuration', 'example', 'exampleTrace', 'practice', 'realTrace'] as const
  if (!wide) return <Button className="pm-story-progress-collapsed" aria-label={t('chapter')} onClick={expandSidebar}><BookIcon size={18} /></Button>
  return <nav className="pm-story-progress" aria-label={t('chapter')} data-step={current}>
    <div className="pm-story-progress-heading"><span>{t('chapterZero')}</span><span>{progressText(t, current - 1)}</span></div>
    <strong>{t('chapterName')}</strong><Meter value={current - 1} t={t} />
    <ol>{[1, 2, 3, 4, 5].map(step => <li key={step} data-complete={current > step || undefined} aria-current={current === step ? 'step' : undefined}>
      <div className="pm-story-progress-title"><span className="pm-story-step-marker" aria-hidden="true">{current > step ? <StoryIcon name="check" size={16} /> : step}</span><span>{t(('step' + step) as 'step1')}</span></div>
      {current === step && <div className="pm-story-guidance">
        <p>{t(description[step - 1]!)}</p>
        {step === 1 && <p role="status">{t(state.modelsStatus === 'loading' ? 'configurationChecking' : state.modelsStatus === 'error' ? 'configurationError' : models.some(model => model.ready) ? 'configurationReady' : 'configurationMissing')}{state.modelsStatus === 'error' && <Button size="sm" onClick={runtime.retry}>{t('retry')}</Button>}</p>}
        {step === 4 && advice && <p role="status">{t(advice)}</p>}
        {step === 4 && end && (end.data.reason as { kind?: string } | undefined)?.kind !== 'completed' && <p role="status">{t('failed')}</p>}
        {(step === 3 || step === 5) && state.guideDismissed && !(step === 3 ? attempt?.exampleSeen : attempt?.trajectorySeen) && <Button size="sm" onClick={runtime.showGuide}>{t('showGuide')}</Button>}
        {step !== 4 && <Button size="sm" variant="primary" disabled={busy || !canContinue} onClick={() => void runtime.act('continue')}>{t(step === 5 ? 'finish' : 'continue')}<StoryIcon name="arrow" size={14} /></Button>}
      </div>}
    </li>)}</ol>
    {current === 6 && <p role="status" className="pm-story-guidance">{t('done')}</p>}
    {state.error && <p role="alert" className="pm-story-guidance">{failureText(state.error, t)}<Button size="sm" onClick={() => void runtime.refresh()}>{t('retry')}</Button></p>}
    <div className="pm-story-progress-actions"><Button size="sm" icon={<StoryIcon name="back" size={16} />} onClick={() => runtime.leave()}>{t('back')}</Button><Button size="sm" disabled={busy} onClick={() => void runtime.act('restart')}>{t('restart')}</Button></div>
  </nav>
}
export function App({ runtime, t }: Props) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const { attempt } = state
  useEffect(() => { void runtime.refresh() }, [runtime])
  const step = attempt?.step ?? 1
  return <main className="pm-story">
    <header className="pm-story-topbar">
      <BookIcon size={18} /><span>{t('title')}</span>
    </header>
    <div className="pm-story-content">
      {state.error && <div className="pm-story-notice pm-story-error" role="alert">{failureText(state.error, t)} <Button size="sm" onClick={() => void runtime.refresh()}>{t('retry')}</Button></div>}
      {!attempt ? <p className="pm-story-description">{t('loading')}</p> : <>
        <div className="pm-story-page-heading"><h1>{t('title')}</h1><p className="pm-story-description">{t('intro')}</p></div>
        <section className="pm-story-card" aria-label={t('chapter')}>
          <div className="pm-story-card-body"><div className="pm-story-chapter-number" aria-hidden="true">00</div><div><div className="pm-story-eyebrow">{t('chapterZero')}</div><h2>{t('chapterName')}</h2><p className="pm-story-description">{t('chapterIntro')}</p></div></div>
          <ol className="pm-story-outline">{[1, 2, 3, 4, 5].map(item => <li key={item}><span aria-hidden="true">{step > item ? <StoryIcon name="check" size={16} /> : String(item).padStart(2, '0')}</span>{t(('step' + item) as 'step1')}</li>)}</ol>
          <div className="pm-story-card-footer"><div className="pm-story-card-progress"><span>{step === 6 ? t('completed') : progressText(t, step - 1)}</span><Meter value={step - 1} t={t} /></div><Button variant="primary" onClick={() => runtime.enter()}>{t(step === 1 ? 'enter' : 'resume')}<StoryIcon name="arrow" size={16} /></Button></div>
        </section>
      </>}
    </div>
  </main>
}

/** Chapter introductions use the main area; operation guidance stays in the sidebar. */
export function Introduction({ runtime, t }: Props) {
  return <main className="pm-story pm-story-introduction">
    <header className="pm-story-topbar"><BookIcon size={18} /><span>{t('chapter')}</span></header>
    <article className="pm-story-content">
      <h1>{t('step1')}</h1>
      <div className="pm-story-introduction-copy">{(['welcome', 'introductionBody', 'introductionChapter'] as const).map(key => <p key={key}>{t(key)}</p>)}</div>
      <Button variant="outline" onClick={() => runtime.openSettings()}>{t('openSettings')}</Button>
    </article>
  </main>
}
