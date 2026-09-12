import { useState, type ReactNode } from 'react'
import { Button, Field, Input, Modal, Select } from '@papermoon/ui'
import { LanguageInput } from './language-input.tsx'
import { RevisionPicker } from './revision-picker.tsx'
import type { Api } from './api.ts'
import type { T } from './locales.ts'
export interface FormField {
  id: string
  label: string
  value?: string
  language?: boolean
  multiline?: boolean
  optional?: boolean
  references?: boolean
  multiple?: boolean
  when?: { id: string; value: string }
  options?: { id: string; label: string }[]
}
export interface DialogSpec {
  api?: Api
  title: string
  description?: string
  fields?: FormField[]
  submitLabel?: string
  danger?: boolean
  body?: ReactNode
  submit: (values: Record<string, string>) => void | Promise<void>
}
export type Ask = (spec: DialogSpec) => void
export function Dialog({
  spec,
  t,
  onClose,
}: {
  spec: DialogSpec
  t: T
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries((spec.fields ?? []).map((f) => [f.id, f.value ?? ''])),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const invalid = (spec.fields ?? []).some(
    (f) =>
      (!f.when || values[f.when.id] === f.when.value) &&
      !f.optional &&
      !values[f.id]?.trim(),
  )
  const submit = async () => {
    if (busy || invalid) return
    setBusy(true)
    setError('')
    try {
      await spec.submit(values)
      onClose()
    } catch (e) {
      setError(String(e))
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={spec.title}
      closeLabel={t('close')}
      description={spec.description}
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            className={spec.danger ? 'pm-danger' : undefined}
            disabled={busy || invalid}
            onClick={() => void submit()}
          >
            {busy ? t('saving') : (spec.submitLabel ?? t('confirm'))}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="pm-form"
      >
        {spec.fields
          ?.filter(
            (field) =>
              !field.when || values[field.when.id] === field.when.value,
          )
          .map((field) => (
            <Field key={field.id} label={field.label}>
              {field.references && spec.api ? (
                <RevisionPicker
                  api={spec.api}
                  t={t}
                  multiple={field.multiple}
                  value={values[field.id] ?? ''}
                  onChange={(value) =>
                    setValues({ ...values, [field.id]: value })
                  }
                />
              ) : field.language ? (
                <LanguageInput
                  label={field.label}
                  value={values[field.id] ?? ''}
                  onChange={(value) =>
                    setValues({ ...values, [field.id]: value })
                  }
                  t={t}
                />
              ) : field.options ? (
                <Select
                  label={field.label}
                  value={values[field.id] ?? ''}
                  options={field.options}
                  onChange={(value) =>
                    setValues({ ...values, [field.id]: value })
                  }
                />
              ) : field.multiline ? (
                <textarea
                  aria-label={field.label}
                  value={values[field.id]}
                  onChange={(e) =>
                    setValues({ ...values, [field.id]: e.target.value })
                  }
                />
              ) : (
                <Input
                  aria-label={field.label}
                  value={values[field.id]}
                  onChange={(e) =>
                    setValues({ ...values, [field.id]: e.target.value })
                  }
                />
              )}
            </Field>
          ))}
        {spec.body}
        {error && (
          <div role="alert" className="pm-error">
            {t('error')}: {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
