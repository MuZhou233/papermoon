import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { IconCloseOutline16 } from './icons/index.tsx'
import css from './Modal.module.css'

interface ModalBaseProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
}

type ModalProps = ModalBaseProps &
  (
    | { headless: true; closeLabel?: never }
    | { headless?: false; closeLabel: string }
  )

/**
 * Render a centered, body-portaled modal over a blurred page mask.
 * @param props.open - whether the dialog is showing.
 * @param props.onClose - Escape or mask click.
 * @param props.title - dialog heading (aria-label in every mode).
 * @param props.closeLabel - localized accessible close-button label.
 * @param props.description - optional supporting sentence under the title.
 * @param props.children - body (inputs, etc.).
 * @param props.footer - action row (Cancel / Create).
 * @param props.contentClassName - optional class for a scrollable content region.
 * @param props.headless - render children directly in the card (no default
 * header/close/body chrome); mask, card, Escape, and aria-label remain.
 * @returns null when closed; otherwise the overlay tree.
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  description,
  children,
  footer,
  className,
  contentClassName,
  headless = false,
}: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      )
    queueMicrotask(() =>
      (
        dialog.current?.querySelector<HTMLElement>('input,textarea') ??
        focusable()[0]
      )?.focus(),
    )
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
      if (e.key === 'Escape' && !document.querySelector('[role=menu]'))
        close.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={css.root} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialog}
        className={clsx(css.dialog, 'pm-theme', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {headless ? (
          children
        ) : (
          <>
            <div className={clsx(css.content, contentClassName)}>
              <div className={css.header}>
                <h2 className={css.title}>{title}</h2>
                <button
                  type="button"
                  className={css.close}
                  aria-label={closeLabel}
                  onClick={onClose}
                >
                  <IconCloseOutline16 size={14} />
                </button>
              </div>
              {description !== undefined && description !== '' && (
                <p className={css.description}>{description}</p>
              )}
              {children !== undefined && (
                <div className={css.body}>{children}</div>
              )}
            </div>
            {footer !== undefined && <div className={css.footer}>{footer}</div>}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
