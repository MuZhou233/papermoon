import { useState, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { Menu } from './Menu.tsx'
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      autoFocus
      portal
      selectedId={value}
      anchor={
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {options.find((o) => o.id === value)?.label ?? label}
          <span aria-hidden="true">⌄</span>
        </Button>
      }
      items={options}
      onSelect={(id) => {
        onChange(id)
        setOpen(false)
      }}
    />
  )
}
export function Tabs({
  value,
  items,
  onChange,
  label,
}: {
  value: string
  items: readonly { id: string; label: string }[]
  onChange: (id: string) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="pm-tabs">
      {items.map((item, i) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => {
            const next =
              e.key === 'ArrowRight'
                ? (i + 1) % items.length
                : e.key === 'ArrowLeft'
                  ? (i + items.length - 1) % items.length
                  : undefined
            if (next !== undefined) {
              e.preventDefault()
              onChange(items[next]!.id)
              ;(
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus()
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="pm-field" role="group" aria-label={label}>
      <span>{label}</span>
      {children}
    </div>
  )
}
