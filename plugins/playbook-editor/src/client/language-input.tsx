import { useState } from 'react'
import { Input, Select } from '@papermoon/ui'
import type { T } from './locales.ts'

/** Presets choose exact codes; the custom field retains the caller's spelling. */
export function LanguageInput({
  label,
  value,
  onChange,
  t,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  t: T
}) {
  const [custom, setCustom] = useState(
    !!value && value !== 'zh-CN' && value !== 'en',
  )
  return (
    <div className="pm-form">
      <Select
        label={label}
        value={custom ? 'custom' : value}
        options={[
          { id: 'zh-CN', label: t('simplifiedChinese') },
          { id: 'en', label: t('englishLanguage') },
          { id: 'custom', label: t('customLanguage') },
        ]}
        onChange={(next) => {
          setCustom(next === 'custom')
          onChange(next === 'custom' ? '' : next)
        }}
      />
      {custom && (
        <Input
          aria-label={t('languageCode')}
          placeholder={t('languageCode')}
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}
