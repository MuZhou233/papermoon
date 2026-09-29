/** Product modules mount central controls alongside the Playbook editor. */
import { useSyncExternalStore, type ComponentType } from 'react'
export type EditorPanel = ComponentType<{ playbookId: string }>
export class EditorPanels {
  private value: readonly { id: string; Component: EditorPanel }[] = []
  private listeners = new Set<() => void>()
  getSnapshot = () => this.value
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  register(id: string, Component: EditorPanel) {
    if (this.value.some(panel => panel.id === id)) throw new Error('editor panel is already registered')
    this.value = [...this.value, { id, Component }]; this.publish()
    return () => { this.value = this.value.filter(panel => panel.id !== id); this.publish() }
  }
  private publish() { for (const listener of this.listeners) listener() }
}
export function AdditionalPanels({ panels, playbookId }: { panels: EditorPanels; playbookId: string }) {
  const entries = useSyncExternalStore(panels.subscribe, panels.getSnapshot)
  return <>{entries.map(({ id, Component }) => <Component key={id} playbookId={playbookId} />)}</>
}
