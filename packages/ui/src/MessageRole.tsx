import type { ReactNode } from 'react'
import css from './MessageRole.module.css'

/** Shared trajectory palette for prompt previews, authoring controls and role menus. */
export function MessageRole({ role, children }: {
  role: 'system' | 'user' | 'assistant'
  children?: ReactNode
}) {
  return <span className={`${css.role} ${css[role]}`} data-message-role={role}>{children ?? role}</span>
}
