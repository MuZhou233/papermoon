/** Position a non-modal hint around a real control without changing its interaction. */
import { useEffect, useId, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import './style.css'
import { isElementVisible } from './visibility.ts'
export { observeVisibleTarget } from './visibility.ts'

export const inject = ['slots']
export interface GuidanceProps {
  /** A stable DOM selector published by the control's owner. Missing/hidden targets wait. */
  target: string
  text: string
  dismissLabel: string
  onDismiss(): void
}
interface Rect { left: number; top: number; width: number; height: number; viewportWidth: number; viewportHeight: number }
export function AnchoredGuidance({ target, text, dismissLabel, onDismiss }: GuidanceProps) {
  const id = useId()
  const [rect, setRect] = useState<Rect>()
  useEffect(() => {
    let frame: number
    let element: HTMLElement | null = null
    let shown = false
    const unbind = () => {
      if (!element) return
      const remaining = element.getAttribute('aria-describedby')?.split(' ').filter(value => value !== id).join(' ')
      if (remaining) element.setAttribute('aria-describedby', remaining)
      else element.removeAttribute('aria-describedby')
      element = null
    }
    const measure = () => {
      const next = document.querySelector<HTMLElement>(target)
      const box = next?.getBoundingClientRect()
      shown = isElementVisible(next)
      if (element !== next || !shown) unbind()
      if (shown && next && box) {
        if (!element) {
          element = next
          element.setAttribute('aria-describedby', [element.getAttribute('aria-describedby'), id].filter(Boolean).join(' '))
        }
        const value = { left: box.left, top: box.top, width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight }
        setRect(old => old && Object.keys(value).every(key => old[key as keyof Rect] === value[key as keyof Rect]) ? old : value)
      } else setRect(undefined)
      frame = requestAnimationFrame(measure)
    }
    const key = (event: KeyboardEvent) => {
      if (shown && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onDismiss() }
    }
    measure()
    window.addEventListener('keydown', key, true)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', key, true); unbind() }
  }, [target, id, onDismiss])
  if (!rect) return null
  const width = Math.min(280, rect.viewportWidth - 32)
  const left = Math.max(16, Math.min(rect.left, rect.viewportWidth - width - 16))
  const above = rect.top + rect.height + 100 > rect.viewportHeight
  return createPortal(<div className="pm-guidance" data-guidance-target={target}>
    <div className="pm-guidance-outline" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
    <div className="pm-guidance-hint" style={{ width, left, ...(above ? { bottom: rect.viewportHeight - rect.top + 14 } : { top: rect.top + rect.height + 14 }) }}>
      <span id={id} role="status">{text}</span><button type="button" aria-label={dismissLabel} onClick={onDismiss}>×</button>
    </div>
  </div>, document.body)
}
export function apply(ctx: { slots: { registerFactory<P>(options: { name: string; scope: 'root' }, component: ComponentType<P>): unknown } }): void {
  ctx.slots.registerFactory({ name: 'anchored-guidance', scope: 'root' }, AnchoredGuidance)
}
