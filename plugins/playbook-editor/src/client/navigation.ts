/** Product routes remain outside DSH's session selection. */
export interface Route {
  playbookId?: string
  tab: 'latest' | 'draft' | 'history' | 'settings'
  revisionId?: string
}
export function readRoute(): Route {
  try {
    const url = new URL(location.href),
      match = url.hash.match(/^#papermoon(?:\/([^?]+))?(?:\?(.*))?$/),
      query = new URLSearchParams(match?.[2] ?? '')
    const tab = query.get('tab')
    return {
      playbookId: match?.[1] ? decodeURIComponent(match[1]) : undefined,
      tab: tab === 'draft' || tab === 'history' || tab === 'settings' ? tab : 'latest',
      revisionId: query.get('revision') ?? undefined,
    }
  } catch {
    return { tab: 'latest' }
  }
}
export function writeRoute(route: Route, replace = false) {
  const query = new URLSearchParams()
  if (route.tab !== 'latest') query.set('tab', route.tab)
  if (route.revisionId) query.set('revision', route.revisionId)
  const hash =
    '#papermoon' +
    (route.playbookId ? '/' + encodeURIComponent(route.playbookId) : '') +
    (query.size ? '?' + query : '')
  history[replace ? 'replaceState' : 'pushState'](null, '', hash)
  window.dispatchEvent(new Event('papermoon:navigate'))
}
