/** Readonly compiler declarations; caller-owned labels keep product text localized. */
import css from './FunctionPreview.module.css'
export function FunctionPreview({ state, functions, labels }: {
  state: unknown
  functions: readonly { name: string; description: string; parameters: unknown; output: unknown }[]
  labels: { state: string; functions: string; parameters: string; returns: string }
}) {
  return <section className={css.root}>
    <details><summary>{labels.state}</summary><pre>{JSON.stringify(state, null, 2)}</pre></details>
    {functions.length > 0 && <details><summary>{labels.functions} · {functions.length}</summary>
      {functions.map(fn => <details key={fn.name}><summary><code>{fn.name}</code></summary><p>{fn.description}</p>
        <h4>{labels.parameters}</h4><pre>{JSON.stringify(fn.parameters, null, 2)}</pre>
        <h4>{labels.returns}</h4><pre>{JSON.stringify(fn.output, null, 2)}</pre>
      </details>)}
    </details>}
  </section>
}
