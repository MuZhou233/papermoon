export function StoryIcon({ name, size = 18 }: { name: 'check' | 'arrow' | 'back' | 'settings' | 'trace' | 'restart' | 'info'; size?: number }) {
  const paths = {
    check: 'm5 12 4 4L19 6',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    back: 'M19 12H5m5-5-5 5 5 5',
    settings: 'M4 7h16M4 17h16M9 4v6m6 4v6',
    trace: 'M6 5v14m0-7h12M6 5h12M6 19h12',
    restart: 'M4 10a8 8 0 1 1 1 7M4 4v6h6',
    info: 'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}
