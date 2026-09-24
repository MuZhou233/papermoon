/** Convert SQL-filtered changes to grouped authored entities; text alignment remains a consumer concern. */
import { encodeJson } from '@papermoon/playbook-storage/value'
import type { Content, Change, Difference } from '@papermoon/playbook-storage'
import type { ContentDifference } from './model.ts'
import { decodeRecord } from './codec.ts'
import { binaryCompare } from './queries.ts'

function equal(a: unknown, b: unknown): boolean {
  return a === undefined || b === undefined ? a === b : encodeJson(a) === encodeJson(b)
}
export function changedEntries(before: Content, after: Content): Change[] {
  const changes: Change[] = []
  for (const key of before.keys()) if (!after.has(key)) changes.push({ kind: 'delete', key })
  for (const [key, value] of after) if (!before.has(key) || !equal(before.get(key), value)) changes.push({ kind: 'set', key, value })
  return changes
}
export function businessDifference(change: Difference): ContentDifference {
  const before = change.before.exists ? decodeRecord(change.key, change.before.value) : null
  const after = change.after.exists ? decodeRecord(change.key, change.after.value) : null
  const fields: string[][] = []
  const field = (name: string, a: unknown, b: unknown, prefix: string[] = []) => { if (!equal(a, b)) fields.push([...prefix, name]) }
  if (before?.kind === 'settings' && after?.kind === 'settings') {
    for (const key of ['metadata', 'programMetadata', 'catalogMetadata', 'defaultLanguage'] as const) field(key, before.value[key], after.value[key])
  } else if (before?.kind === 'file' && after?.kind === 'file') {
    field('source', before.value.source, after.value.source); field('metadata', before.value.metadata, after.value.metadata)
  } else if (before?.kind === 'language' && after?.kind === 'language') field('metadata', before.value.metadata, after.value.metadata)
  else if (before?.kind === 'text' && after?.kind === 'text') {
    field('description', before.value.description, after.value.description); field('metadata', before.value.metadata, after.value.metadata)
    const languages = [...new Set([...before.value.translations.keys(), ...after.value.translations.keys()])].sort(binaryCompare)
    for (const language of languages) {
      const a = before.value.translations.get(language), b = after.value.translations.get(language)
      if (!a || !b) fields.push(['translations', language])
      else { field('text', a.text, b.text, ['translations', language]); field('metadata', a.metadata, b.metadata, ['translations', language]) }
    }
  }
  return { kind: change.kind, before, after, fields }
}
