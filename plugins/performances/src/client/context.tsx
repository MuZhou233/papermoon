/** Opening display and later request events share the same authored identity. */
import { Button } from '@papermoon/ui'
import { CONFIG_KEY, PRODUCER, ACTION_KEY } from '../constants.ts'
import type { FrozenPerformance } from '../model.ts'
import type { T } from './locales.ts'
interface Event { type: string; seq: number; time: number; data: unknown }
interface Entry { groupId: string; index: number; name?: string; message: { id: string; role: 'user' | 'assistant'; content: { type: 'text'; text: string }[]; source: { producer?: string } } }
interface Match { event: Event; location: unknown }
interface Context { key: string; id: string; matches: readonly Match[]; start?: Match }
function fixed(event: Event): FrozenPerformance | undefined {
  if (event.type !== 'session/configuration') return undefined
  const data = event.data as { key: string; value: FrozenPerformance }
  return data.key === CONFIG_KEY ? data.value : undefined
}
function match(event: Event) {
  const value = fixed(event)
  if (value) return { id: `papermoon.performance:${value.originSessionId}`, role: 'start' as const }
  if (event.type === 'context/message') { const entry = event.data as Entry; if (entry.message.source.producer === PRODUCER) return { id: entry.groupId, role: 'update' as const } }
  return null
}
export const openingDefinition = {
  kind: 'papermoon-opening', target: 'chat', match, start: () => true, update: () => true,
  buildViewNode(context: Context) {
    const matches = [...context.matches].sort((a,b) => a.event.seq - b.event.seq), value = matches.map(m => fixed(m.event)).find(Boolean)
    const data = value ? { system: value.artifact.context.systemPrompt, systemName: value.artifact.context.systemPromptName, messages: value.artifact.context.messages } : {
      messages: matches.filter(m => m.event.type === 'context/message').map(m => { const entry = m.event.data as Entry; return { name: entry.name, role: entry.message.role, content: entry.message.content.map(block => block.text).join('') } }),
    }
    if (!matches.length) return null
    return { key: context.key, id: context.id, kind: 'papermoon-opening', target: 'chat', anchorSeq: matches[0]!.event.seq, location: context.start?.location ?? matches[0]!.location, visibility: 'visible', independent: true, data }
  },
}
export const initializationDefinition = {
  kind: 'papermoon-initialization', target: 'trajectory',
  match: (event: Event) => fixed(event) ? { id: String(event.seq), role: 'start' as const } : null,
  start: () => true, update: () => true,
  buildViewNode(context: Context) {
    const first = context.matches[0]
    if (!first) return null
    return { key: context.key, id: context.id, kind: 'papermoon-initialization', target: 'trajectory', anchorSeq: first.event.seq, location: first.location, visibility: 'visible', independent: true, data: { kind: 'node', node: { kind: 'context', seq: first.event.seq, time: first.event.time, content: [{ type: 'text', text: JSON.stringify(fixed(first.event), null, 2) }], source: { kind: 'authored-context', producer: 'papermoon-performance-initialization' }, provenance: { role: 'inject', label: 'PaperMoon' }, form: 'snapshot' } } }
  },
}
export function Opening({ node, t }: { node: { data: { system?: string; systemName?: string; messages: { role: 'user' | 'assistant'; name?: string; content: string }[] } }; t: T }) {
  return <section className="ppm-opening">
    {node.data.system !== undefined && <details><summary>{node.data.systemName || t('system')}</summary><pre>{node.data.system}</pre></details>}
    {node.data.messages.map((message,index) => <article key={index} className={'ppm-authored ppm-' + message.role}><header><small>{message.role === 'assistant' ? t('opening') : t('background')}</small><strong>{message.name}</strong><Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(message.content)}>{t('copy')}</Button></header><div className="ppm-preserve">{message.content}</div></article>)}
  </section>
}

/** Complete action commits remain inspectable without becoming model messages. */
export const actionDefinition = {
  kind: 'papermoon-action', target: 'trajectory',
  match: (event: Event) => event.type === 'session/configuration' && (event.data as { key?: string }).key === ACTION_KEY ? { id: String(event.seq), role: 'start' as const } : null,
  start: () => true, update: () => true,
  buildViewNode(context: Context) {
    const first = context.matches[0]
    if (!first) return null
    const value = (first.event.data as { value: unknown }).value
    return { key: context.key, id: context.id, kind: 'papermoon-action', target: 'trajectory', anchorSeq: first.event.seq, location: first.location, visibility: 'visible', independent: true,
      data: { kind: 'node', node: { kind: 'context', seq: first.event.seq, time: first.event.time, content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], source: { kind: 'authored-context', producer: 'papermoon-performance-action' }, provenance: { role: 'inject', label: 'PaperMoon' }, form: 'snapshot' } } }
  },
}
