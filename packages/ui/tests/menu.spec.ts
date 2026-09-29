// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Menu } from '../src/Menu.tsx'

afterEach(cleanup)

test('portal focus waits for placement and survives repositioning', () => {
  let anchorRect: DOMRect | null = null
  const props = {
    open: false, autoFocus: true, portal: true,
    anchor: createElement('button', null, 'Syntax highlighting'),
    items: [{ id: 'markdown', label: 'Markdown' }, { id: 'xml', label: 'XML' }],
    onSelect: vi.fn(), onClose: vi.fn(), getAnchorRect: () => anchorRect,
  }
  const view = render(createElement(Menu, props))
  const trigger = view.getByRole('button', { name: 'Syntax highlighting' })
  trigger.focus()
  view.rerender(createElement(Menu, { ...props, open: true }))
  expect(document.activeElement).toBe(trigger)
  anchorRect = new DOMRect(100, 100, 120, 28)
  act(() => { window.dispatchEvent(new Event('scroll')) })
  expect(document.activeElement).toBe(view.getByRole('menuitem', { name: 'Markdown' }))
  fireEvent.keyDown(document, { key: 'ArrowDown' })
  const xml = view.getByRole('menuitem', { name: 'XML' })
  expect(document.activeElement).toBe(xml)
  anchorRect = new DOMRect(100, 50, 120, 28)
  act(() => { window.dispatchEvent(new Event('scroll')) })
  expect(document.activeElement).toBe(xml)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(document.activeElement).toBe(trigger)
  expect(props.onClose).toHaveBeenCalledOnce()
})
