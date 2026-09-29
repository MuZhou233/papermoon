import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BookIcon, Button, Field, Input, PromptTrace, Select, type PromptMessage } from '@papermoon/ui'
import type { StoryMode, StoryView } from '../service.ts'
import type { Runtime } from './runtime.ts'
import type { T } from '../locales.ts'
import { chapter } from '../content.ts'
import './style.css'

function unlocked(view: StoryView) {
  if (view.progress.completed) return null
  switch (view.progress.section) {
    case 2: return view.progress.openingSaved ? null : 'opening'
    case 3: return view.requirements.systemSaved ? null : 'system'
    case 4: return view.requirements.modelValid ? null : 'model'
    case 5: return view.progress.started ? null : 'performance'
    default: return null
  }
}
const featureLabels = { opening: 'openingEditor', system: 'systemEditor', model: 'modelSelection', performance: 'effortPerformance' } as const

export function App({ runtime, t }: { runtime: Runtime; t: T }) {
  const [saves, setSaves] = useState<ReturnType<StoryMode['list']>>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [project, setProject] = useState(''), [name, setName] = useState('')
  const [creating, setCreating] = useState(false), [error, setError] = useState('')
  const zh = t('title') === '故事模式'
  const storyline = zh ? '雾锁地照' : 'Fogbound Earthshine'
  useEffect(() => {
    void runtime.call<ReturnType<StoryMode['list']>>('list').then(setSaves).catch(error => setError(String(error)))
    void runtime.connection.rpc.call('/api', 'papermoon/projects', {}, runtime.abort.signal).then(result => {
      if (result.ok) {
        const items = (result.value as { items: { id: string; name: string }[] }).items
        setProjects(items); setProject(items[0]?.id ?? '')
      }
    }).catch(error => setError(String(error)))
  }, [runtime])
  const create = async () => {
    let projectId = project
    if (!projectId) {
      const result = await runtime.connection.rpc.call('/api', 'papermoon/createProject', { name: zh ? '故事存档' : 'Story saves' }, runtime.abort.signal)
      if (!result.ok) throw new Error(result.error.message)
      projectId = (result.value as { id: string }).id
    }
    const save = await runtime.call<{ id: string }>('create', { name, projectId, storyline: 'fogbound-earthshine', language: zh ? 'zh-CN' : 'en' })
    await runtime.enter(save.id, true)
  }
  return <main className="pm-app pm-theme pm-story-manager">
    <div className="pm-story-page">
      <header className="pm-story-page-heading"><BookIcon /><h1>{t('title')}</h1></header>
      <section className="pm-story-create">
        <div className="pm-story-storyline"><span className="pm-story-tag">{t('storyline')}</span><h2>{storyline}</h2>
          <p>{zh ? '逐步设计属于自己的角色并和他们一起进行一场狼人杀游戏' : 'Design your own characters step by step, then join them for a game of Werewolf.'}</p>
        </div>
        <form onSubmit={event => { event.preventDefault(); setCreating(true); setError(''); void create().catch(error => setError(String(error))).finally(() => setCreating(false)) }}>
          <h3>{t('newSave')}</h3>
          <div className="pm-story-form-fields">
            <Field label={t('storyline')}><Select label={t('storyline')} value="fogbound-earthshine" options={[{ id: 'fogbound-earthshine', label: storyline }]} onChange={() => {}} /></Field>
            {!!projects.length && <Field label={t('project')}><Select label={t('project')} value={project} options={projects.map(p => ({ id: p.id, label: p.name }))} onChange={setProject} /></Field>}
            <Field label={t('name')}><Input aria-label={t('name')} value={name} onChange={event => setName(event.target.value)} /></Field>
          </div>
          {error && <p className="pm-story-error" role="alert">{error}</p>}
          <Button variant="primary" type="submit" disabled={!name.trim() || creating}>{t('create')}</Button>
        </form>
      </section>
      <section className="pm-story-saves"><h2>{t('yourSaves')}</h2>
        {!saves.length && <p className="pm-story-empty">{t('noSaves')}</p>}
        {saves.map(save => <article className="pm-story-save" key={save.id}>
          <div><h3>{save.name}</h3><p>{save.projectName} · {storyline} · 1.{save.progress.section}</p></div>
          {save.progress.completed && <span className="pm-story-tag" data-tone="success">{t('completed')}</span>}
          <div className="pm-story-actions"><Button variant="outline" size="sm" onClick={() => void runtime.enter(save.id)}>{t('continue')}</Button>
            {save.progress.completed && <Button size="sm" onClick={() => void runtime.enter(save.id).then(() => runtime.action('review'))}>{t('review')}</Button>}
          </div>
        </article>)}
      </section>
    </div>
  </main>
}

/** Stage cues sit beside the authoring area; the saved result acknowledges each new capability. */
export function AuthoringControls({ runtime, t }: { runtime: Runtime; t: T }) {
  const { view } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  if (!view || view.progress.completed) return null
  const feature = unlocked(view)
  if (!feature && view.progress.section < 4) return null
  return <section className="pm-story-central" data-story-unlock={feature ?? undefined}>
    {feature && <div className="pm-story-unlock" role="status">
      <span className="pm-story-tag" data-tone="info">{t('newlyUnlocked')}</span>
      <strong>{t(featureLabels[feature])}</strong>
      <Button size="sm" onClick={() => runtime.locate()}>{t('showWhere')}</Button>
    </div>}
    {view.progress.section >= 4 && <ModelPicker runtime={runtime} t={t} />}
  </section>
}

export function ModelPicker({ runtime, t }: { runtime: Runtime; t: T }) {
  const { view, models, busy } = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const [model, setModel] = useState(''), [effort, setEffort] = useState('')
  useEffect(() => { void runtime.models() }, [runtime])
  useEffect(() => { setModel(view?.choice ? JSON.stringify([view.choice.provider, view.choice.model]) : ''); setEffort(view?.choice?.reasoningEffort ?? '') }, [view?.choice?.provider, view?.choice?.model, view?.choice?.reasoningEffort])
  const choices = models?.groups.filter(group => models.routableProviders.includes(group.id)).flatMap(group => group.models.map(item => ({ id: JSON.stringify([group.id, item.id]), label: group.name + ' · ' + item.name, item }))) ?? []
  const selected = choices.find(choice => choice.id === model)?.item
  return <div className="pm-story-model" data-story-target="model">
    <Field label={t('model')}><Select label={t('model')} value={model} options={[{ id: '', label: t('choose') }, ...choices]} onChange={value => { setModel(value); setEffort('') }} /></Field>
    {view!.progress.section >= 5 && (selected?.reasoning?.efforts.length
      ? <Field label={t('effort')}><Select label={t('effort')} value={effort || selected.reasoning.defaultEffort || selected.reasoning.efforts[0]!.id} options={selected.reasoning.efforts.map(item => ({ id: item.id, label: item.name }))} onChange={setEffort} /></Field>
      : <p>{chapter[t('title') === '故事模式' ? 'zh' : 'en'].sections[4].states[4]}</p>)}
    <div className="pm-story-actions"><Button variant="outline" disabled={!model || busy} onClick={() => {
      const [provider, id] = JSON.parse(model) as [string, string]
      void runtime.choose({ provider, model: id, ...(view!.progress.section >= 5 && selected?.reasoning?.efforts.length ? { reasoningEffort: effort || selected.reasoning.defaultEffort || selected.reasoning.efforts[0]!.id } : {}) })
    }}>{t('saveModel')}</Button><Button onClick={runtime.openSettings}>{t('settings')}</Button></div>
  </div>
}

function Examples({ examples, t }: { examples: readonly { role: string; text: string }[]; t: T }) {
  const messages: PromptMessage[] = examples.map((example, index) => ({
    id: String(index), content: example.text,
    role: example.role === 'system' ? 'system' : example.role === 'assistant' || example.role === 'Response' || example.role === '回应' ? 'assistant' : 'user',
    roleLabel: example.role,
  }))
  return <PromptTrace compact label={t('example')} messages={messages} labels={{ number: t('number'), role: t('type'), content: t('content') }} />
}

export function Guide({ runtime, t, visible = true }: { runtime: Runtime; t: T; visible?: boolean }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot), { view, review } = state
  const zh = t('title') === '故事模式', language = zh ? 'zh' : 'en'
  const text = (review?.teaching as unknown as typeof chapter | undefined)?.[language] ?? chapter[language]
  const section = text.sections[(view?.progress.section ?? 1) - 1]!
  const reading = useRef<HTMLDivElement>(null)
  const identity = `${state.id}/${language}/${review ? 'review' : view?.progress.section}`
  useEffect(() => { if (visible && view) runtime.seen() }, [runtime, visible, view?.progress.section, view?.progress.step, view?.progress.completed, state.hint])
  useEffect(() => { if (reading.current) reading.current.scrollTop = Number(sessionStorage.getItem('papermoon.story.scroll/' + identity) ?? 0) }, [identity])
  if (!view) return <p className="pm-story-empty">{state.error ?? t('loading')}</p>
  const disabled = state.busy || (view.progress.section === 2 && !view.progress.openingSaved) || (view.progress.section === 3 && !view.requirements.systemSaved) || (view.progress.section === 4 && !view.requirements.modelValid)
  return <section className="pm-theme pm-story-guide" data-story-section={view.progress.section} data-story-completed={view.progress.completed}>
    <header className="pm-story-guide-heading">
      <div className="pm-story-meta"><span title={view.playbook.name}>{view.playbook.name}</span><span className="pm-story-tag">{review ? t('readOnly') : `${t('step')} ${view.progress.step} / ${section.steps.length}`}</span></div>
      <p>{text.title}</p><h2>{review ? t('readOnly') : section.title}</h2>
    </header>
    <div className="pm-story-reading" ref={reading} onScroll={event => sessionStorage.setItem('papermoon.story.scroll/' + identity, String(event.currentTarget.scrollTop))}>
      {!review && <details className="pm-story-outline"><summary>{t('chapterProgress')}</summary><ol>{text.sections.map((item, index) => <li key={item.title} aria-current={index + 1 === view.progress.section ? 'step' : undefined}><span>{item.title}</span>{(index + 1 < view.progress.section || view.progress.completed) && <span aria-label={t('saved')}>✓</span>}</li>)}</ol></details>}
      {(review ? text.sections : [section]).map(item => <article className="pm-story-lesson" key={item.title}>
        {review && <h3>{item.title}</h3>}
        <div className="pm-story-prose">{item.teaching.map((p, i) => <p key={i}>{p}</p>)}</div>
        <h3 className="pm-story-label">{t('example')}</h3><Examples examples={item.examples} t={t} />
        <h3 className="pm-story-label">{t('analysis')}</h3><div className="pm-story-prose">{item.analysis.map((p, i) => <p key={i}>{p}</p>)}</div>
        <section className="pm-story-task"><h3 className="pm-story-label">{t('currentTask')}</h3>
          <div className="pm-story-prose">{item.guidance.map((text, index) => <p key={index}>{text}</p>)}</div>
          <ol className="pm-story-steps">{item.steps.map((step, index) => <li key={index} aria-current={!review && index + 1 === view.progress.step ? 'step' : undefined}>{step.operation}{review ? <p>{step.result}</p> : index + 1 < view.progress.step || view.progress.completed ? ' ✓' : ''}</li>)}</ol>
        </section>
      </article>)}
      {view.progress.completed && !review && <div className="pm-story-result"><span className="pm-story-tag" data-tone="success">{t('completed')}</span><p>{section.states[9]}</p><p>{t('unavailable')}</p></div>}
      {review && <>
        <h3 className="pm-story-label">{t('chapterContent')}</h3>
        <PromptTrace compact label={t('chapterContent')} labels={{ number: t('number'), role: t('type'), content: t('content') }} messages={[
          { id: 'system', role: 'system', content: review.content.systemPrompt.text }, ...review.content.opening.messages,
        ]} />
        <h3 className="pm-story-label">{t('records')}</h3>
        {review.recordsError && <p className="pm-story-error" role="alert">{review.recordsError}</p>}
        <pre className="pm-story-records">{JSON.stringify(review.records, null, 2)}</pre>
      </>}
    </div>
    <footer className="pm-story-footer">
      {state.error && <p className="pm-story-error" role="alert">{state.error}</p>}
      {review ? <Button variant="outline" onClick={() => runtime.update({ review: undefined })}>{t('back')}</Button> : <>
        {view.progress.section === 3 && !view.requirements.systemSaved && <p role="status">{section.states[0]}</p>}
        {view.progress.section === 4 && !view.requirements.modelValid && <p role="status">{section.states[0]}</p>}
        {view.progress.section === 5 && !view.progress.completed && <p role="status">{view.submissionError ? section.states[7] : view.responseFailed ? section.states[6] : view.progress.started ? section.states[5] : section.states[2]}</p>}
        {view.submissionError && <p className="pm-story-error" role="alert">{view.submissionError}</p>}
        <div className="pm-story-actions">
          {view.submissionError ? <Button variant="primary" disabled={state.busy} onClick={() => void runtime.action('retry')}>{t('retry')}</Button>
            : view.progress.completed ? <><Button variant="primary" onClick={() => runtime.openSession(view.progress.sessionId!)}>{t('continueChat')}</Button><Button variant="outline" disabled>{t('nextChapter')}</Button><Button onClick={() => void runtime.action('review')}>{t('review')}</Button></>
            : view.progress.section === 5 ? <Button variant="primary" disabled={state.busy || !view.choice} onClick={() => void runtime.action('start')}>{view.progress.started ? t('continueChat') : t('start')}</Button>
            : <Button variant="primary" data-story-target="continue" disabled={disabled} onClick={() => void runtime.action('advance')}>{t('next')}</Button>}
        </div>
        <div className="pm-story-actions pm-story-secondary"><Button size="sm" onClick={() => runtime.locate()}>{t('showWhere')}</Button><Button size="sm" onClick={() => runtime.navigate(view.playbook.id)}>{t('edit')}</Button></div>
      </>}
    </footer>
  </section>
}
