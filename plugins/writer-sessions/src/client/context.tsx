/** One expandable authored group in chat; event seqs retain order and copy/search text. */
import { Button } from '@papermoon/ui'
import type { T } from './locales.ts'
interface Event { type: string; seq: number; time: number; data: unknown }
interface Entry { groupId: string; index: number; name?: string; message: { id: string; role: 'user' | 'assistant'; content: readonly { type: 'text'; text: string }[]; source: { kind: 'authored-context'; producer: string } } }
interface Match { event: Event; location: unknown }
interface Context { key: string; id: string; matches: readonly Match[]; start?: Match }
export const contextDefinition = {
  kind: 'papermoon-writer-context', target: 'chat',
  match(event: Event) {
    if (event.type !== 'context/message') return null
    const data = event.data as Entry
    if (data.message.source.producer !== 'papermoon-writer-context') return null
    return { id: data.groupId, role: data.index === 0 ? 'start' as const : 'update' as const }
  },
  start: () => true,
  update: () => true,
  buildViewNode(context: Context) {
    const matches = context.matches.filter(match => match.event.type === 'context/message').sort((a, b) => a.event.seq - b.event.seq)
    if (!matches.length) return null
    return { key: context.key, id: context.id, kind: 'papermoon-writer-context', target: 'chat',
      anchorSeq: matches[0]!.event.seq, location: context.start?.location ?? matches[0]!.location,
      visibility: 'visible', independent: true, data: matches.map(match => match.event.data as Entry) }
  },
}
export function ContextGroup({ node, t }: { node: { data: readonly Entry[] }; t: T }) {
  return <details className="pws-context"><summary>{t('context')} · {node.data.length}</summary>
    {node.data.map(entry => <article key={entry.message.id}><header>
      <span className="pws-context-role">#{entry.index + 1} · {entry.message.role}</span><strong>{entry.name}</strong>
      <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(entry.message.content.map(block => block.text).join(''))}>{t('copy')}</Button>
    </header><pre>{entry.message.content.map(block => block.text).join('')}</pre></article>)}
  </details>
}
