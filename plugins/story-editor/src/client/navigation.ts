/** Product routes remain outside DSH's session selection. */
export interface Route {
  scriptId?: string
  tab: 'draft' | 'history' | 'settings'
  revisionId?: string
}
export function readRoute(): Route {
  try {
    const url = new URL(location.href),
      match = url.hash.match(/^#papermoon(?:\/([^?]+))?(?:\?(.*))?$/),
      query = new URLSearchParams(match?.[2] ?? '')
    const tab = query.get('tab')
    return {
      scriptId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
      tab: tab === 'history' || tab === 'settings' ? tab : 'draft',
      revisionId: query.get('revision') ?? undefined,
    }
  } catch {
    return { tab: 'draft' }
  }
}
export function writeRoute(route: Route, replace = false) {
  const query = new URLSearchParams()
  if (route.tab !== 'draft') query.set('tab', route.tab)
  if (route.revisionId) query.set('revision', route.revisionId)
  const hash =
    '#papermoon' +
    (route.scriptId ? '/' + encodeURIComponent(route.scriptId) : '') +
    (query.size ? '?' + query : '')
  history[replace ? 'replaceState' : 'pushState'](null, '', hash)
  window.dispatchEvent(new Event('papermoon:navigate'))
}
