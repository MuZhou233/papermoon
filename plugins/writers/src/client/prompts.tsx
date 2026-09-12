import { useState, useSyncExternalStore } from 'react'
import { Button, Field, Input, Menu, PromptTrace } from '@papermoon/ui'
import { resolveWriterContext, type WriterDefinition } from '../model.ts'
import type { Props } from './app.tsx'

type Message = WriterDefinition['messages'][number]
function RoleChoice({ role, disabled, onChange, t }: {
  role: Message['role']
  disabled: boolean
  onChange(role: Message['role']): void
  t: Props['t']
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      autoFocus
      portal
      selectedId={role}
      anchor={
        <Button
          variant="outline"
          className="pw-role-trigger"
          disabled={disabled}
          aria-label={t('role')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {role}<span aria-hidden="true">⌄</span>
        </Button>
      }
      items={(['user', 'assistant'] as const).map((id) => ({
        id,
        label: (
          <span className="pw-role-option">
            <span>{id}</span>
            <small>{t(id === 'user' ? 'userRole' : 'assistantRole')}</small>
          </span>
        ),
      }))}
      onSelect={(id) => {
        onChange(id as Message['role'])
        setOpen(false)
      }}
    />
  )
}

/** Prompt names label editor content; only roles and bodies enter the resolved context. */
export function PromptPanel({ store, t }: Props) {
  const { saved, draft, busy, editing } = useSyncExternalStore(
    store.subscribe, store.getSnapshot,
  )
  if (!saved || !draft) return null
  const messages = draft.messages
  if (!editing) {
    const context = resolveWriterContext(draft)
    return <PromptTrace
      label={t('preview')}
      labels={{ number: t('number'), role: t('role'), content: t('body') }}
      messages={[
        { id: 'system', role: 'system', name: draft.systemPromptName, content: context.systemPrompt },
        ...context.messages.map((message, index) => ({
          ...message,
          id: 'message:' + messages[index]!.id,
          name: messages[index]!.name,
        })),
      ]}
    />
  }
  const replaceMessage = (id: string, patch: Partial<Message>) =>
    store.edit({
      messages: messages.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  const move = (index: number, offset: number) => {
    const next = [...messages]
    ;[next[index], next[index + offset]] = [next[index + offset]!, next[index]!]
    store.edit({ messages: next })
  }
  return (
    <>
      <section className="pw-message pw-system">
        <Field label={t('systemName')}>
          <Input
            aria-label={t('systemName')}
            placeholder={t('namePlaceholder')}
            disabled={busy}
            value={draft.systemPromptName ?? ''}
            onChange={(e) => store.edit({ systemPromptName: e.target.value })}
          />
        </Field>
        <textarea
          aria-label={t('system')}
          disabled={busy}
          value={draft.systemPrompt}
          onChange={(e) => store.edit({ systemPrompt: e.target.value })}
        />
      </section>
      <div className="pw-section-head">
        <h3>{t('initial')}</h3>
        <Button
            disabled={busy}
            onClick={() => store.edit({
              messages: [...messages, {
                id: crypto.randomUUID(), role: 'user', content: '',
              }],
            })}
          >
            {t('addMessage')}
        </Button>
      </div>
      {!messages.length && <p className="pw-muted">{t('emptyMessages')}</p>}
      {messages.map((message, index) => (
        <section
          className="pw-message"
          key={message.id}
          aria-label={`${t('initial')} ${index + 1}`}
        >
          <div className="pw-message-head">
            <span className="pw-message-number" aria-label={`${t('number')} ${index + 1}`}>#{index + 1}</span>
            <div className="pw-actions">
              <Button size="sm" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={t('up')} title={t('up')}>↑</Button>
              <Button size="sm" disabled={busy || index === messages.length - 1} onClick={() => move(index, 1)} aria-label={t('down')} title={t('down')}>↓</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => store.edit({
                messages: [
                  ...messages.slice(0, index + 1),
                  { ...message, id: crypto.randomUUID() },
                  ...messages.slice(index + 1),
                ],
              })}>{t('duplicateMessage')}</Button>
              <Button size="sm" className="pw-delete" disabled={busy} onClick={() => store.edit({
                messages: messages.filter((item) => item.id !== message.id),
              })}>{t('deleteMessage')}</Button>
            </div>
          </div>
          <div className="pw-message-fields">
            <Field label={t('messageName')}>
              <Input
                aria-label={`${t('messageName')} ${index + 1}`}
                placeholder={t('namePlaceholder')}
                disabled={busy}
                value={message.name ?? ''}
                onChange={(e) => replaceMessage(message.id, { name: e.target.value })}
              />
            </Field>
            <Field label={t('role')}>
              <RoleChoice role={message.role} disabled={busy} t={t}
                onChange={(role) => replaceMessage(message.id, { role })} />
            </Field>
          </div>
          <textarea
            aria-label={`${t('body')} ${index + 1}`}
            disabled={busy}
            value={message.content}
            onChange={(e) => replaceMessage(message.id, { content: e.target.value })}
          />
        </section>
      ))}
    </>
  )
}
