import { useState, type KeyboardEvent } from 'react'
import css from './PromptTrace.module.css'

export interface PromptMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  name?: string
  content: string
}

/** Static initial-context rows with trajectory-style selection and literal content inspection. */
export function PromptTrace({ messages, label, labels }: {
  messages: readonly PromptMessage[]
  label: string
  labels: { number: string; role: string; content: string }
}) {
  const [selectedId, setSelectedId] = useState(messages[0]?.id)
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0]
  const selectByKey = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedId(messages[index]!.id)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(0, Math.min(messages.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      setSelectedId(messages[next]!.id)
      const rows = event.currentTarget.parentElement?.children
      ;(rows?.[next] as HTMLElement | undefined)?.focus()
    }
  }
  return (
    <section className={css.root} aria-label={label}>
      <div className={css.split}>
        <div className={css.tablePane}>
          <table className={css.table} aria-label={label}>
            <colgroup><col className={css.numberColumn} /><col className={css.roleColumn} /><col /></colgroup>
            <thead><tr>
              <th scope="col" aria-label={labels.number}>#</th>
              <th scope="col">{labels.role}</th>
              <th scope="col">{labels.content}</th>
            </tr></thead>
            <tbody>
              {messages.map((message, index) => (
                <tr
                  key={message.id}
                  tabIndex={0}
                  data-prompt-message={message.role}
                  data-selected={selected?.id === message.id}
                  onClick={() => setSelectedId(message.id)}
                  onKeyDown={(event) => selectByKey(event, index)}
                >
                  <td className={css.number}>{index + 1}</td>
                  <td><span className={`${css.role} ${css[message.role]}`} data-prompt-role>{message.role}</span></td>
                  <td title={message.name}>
                    <span className={css.preview}>
                      {message.name && <span className={css.name} data-prompt-name>{message.name}</span>}
                      <span>{message.content}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && <section className={css.details} aria-label={labels.content}>
          <header className={css.detailsHeader}>
            <span className={`${css.role} ${css[selected.role]}`}>{selected.role}</span>
            <span className={css.detailsTitle}>{selected.name}</span>
          </header>
          <pre className={css.content} data-prompt-content>{selected.content}</pre>
        </section>}
      </div>
    </section>
  )
}
