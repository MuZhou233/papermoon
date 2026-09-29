import { useRef, useState } from 'react'
import { Button, Menu, MessageRole } from '@papermoon/ui'

type Icon = 'code' | 'markdown' | 'chevron' | 'message' | 'plus' | 'up' | 'down' | 'delete'
const paths: Record<Icon, string> = {
  code: 'm5 4-4 4 4 4m6-8 4 4-4 4M9 2 7 14',
  markdown: 'M1.5 12V4L5 8l3.5-4v8m4-8v8m-2.5-2.5 2.5 2.5 2.5-2.5',
  chevron: 'm4 6 4 4 4-4',
  message: 'M4 2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7l-4 2v-2a2 2 0 0 1-1-2V4a2 2 0 0 1 2-2Zm1 4h6M5 9h4',
  plus: 'M8 3v10M3 8h10',
  up: 'M8 13V3m-4 4 4-4 4 4',
  down: 'M8 3v10m-4-4 4 4 4-4',
  delete: 'M2.5 4h11M6 4V2h4v2M4 4l.5 10h7L12 4M6.5 6.5v5m3-5v5',
}
export function AuthoringIcon({ name }: { name: Icon }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

/** Compact editor controls share DSH menu selection and keyboard navigation. */
export function AuthoringSelect({ label, value, options, onChange, disabled = false, showLabel = true, tone }: {
  label: string
  value: string
  options: readonly { id: string; label: string; icon?: Icon }[]
  onChange: (value: string) => void
  disabled?: boolean
  showLabel?: boolean
  tone?: 'user' | 'assistant'
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.id === value)
  return <div className="pm-authoring-control" ref={root}>
    {showLabel && <span className="pm-authoring-control-label">{label}</span>}
    <Menu open={open} onClose={() => setOpen(false)} autoFocus portal compact align="end" selectedId={value}
      items={options.map(option => ({ ...option, label: tone ? <MessageRole role={option.id as 'user' | 'assistant'}>{option.label}</MessageRole> : option.label, icon: option.icon ? <AuthoringIcon name={option.icon} /> : undefined }))}
      onSelect={id => { onChange(id); setOpen(false); root.current?.querySelector('button')?.focus() }}
      anchor={<Button variant="ghost" size="sm" className="pm-authoring-select" data-tone={tone} disabled={disabled}
        aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {selected?.icon && <AuthoringIcon name={selected.icon} />}{tone ? <MessageRole role={tone}>{selected?.label ?? label}</MessageRole> : <span>{selected?.label ?? label}</span>}<AuthoringIcon name="chevron" />
      </Button>}
    />
  </div>
}
