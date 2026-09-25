/** Check a real element against layout, clipping and foreground occlusion. */
export function isElementVisible(element: HTMLElement | null): element is HTMLElement {
  if (!element || document.visibilityState === 'hidden') return false
  const box = element.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0 || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
  const left = Math.max(0, box.left), right = Math.min(innerWidth, box.right)
  const top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom)
  if (left >= right || top >= bottom) return false
  return element.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))
}
/** Wait for actual visibility; layout, virtual rows and scroll can change without a DOM mutation. */
export function observeVisibleTarget(target: () => HTMLElement | null, visible: () => void): () => void {
  let frame: number
  let active = true
  const observe = () => {
    if (isElementVisible(target())) visible()
    if (active) frame = requestAnimationFrame(observe)
  }
  frame = requestAnimationFrame(observe)
  return () => { active = false; cancelAnimationFrame(frame) }
}
