/** The current story state is owned by the Playbook draft and its revisions. */
import { z } from 'zod'
import type { Capability, PlaybookPolicy } from '@papermoon/playbook-core'
export const STORYLINE = 'fogbound-earthshine'
export const POLICY = 'papermoon.story'
export const CHAPTER_TAG = 'story/fogbound-earthshine/chapter/1'
export const progressSchema = z.strictObject({
  chapter: z.literal(1), section: z.number().int().min(1).max(5), step: z.number().int().min(1),
  openingSaved: z.boolean(), sessionId: z.string().optional(), started: z.boolean(), completed: z.boolean(),
})
export type Progress = z.infer<typeof progressSchema>
export const initialProgress = (): Progress => ({ chapter: 1, section: 1, step: 1, openingSaved: false, started: false, completed: false })
export function access(progress: Progress): Capability[] {
  return [
    ...(progress.section >= 2 ? ['opening.read', 'opening.write'] as const : []),
    ...(progress.section >= 3 ? ['system.read', 'system.write'] as const : []),
    ...(progress.section >= 4 ? ['model'] as const : []),
    ...(progress.section >= 5 ? ['effort', 'performance'] as const : []),
  ]
}
export const policy: PlaybookPolicy = {
  presentation: value => { const state = progressSchema.parse(value.state); return { label: { en: 'Fogbound Earthshine', zh: '雾锁地照' }, position: `1.${state.section}`, completed: state.completed } },
  capabilities: value => value.binding === STORYLINE ? access(progressSchema.parse(value.state)) : [],
  saved(value, operations) {
    const state = progressSchema.parse(value.state)
    return { ...state, ...(operations.some(op => op.kind === 'set-opening-messages') ? { openingSaved: true, ...(state.section === 2 ? { step: 3 } : {}) } : {}), ...(state.section === 3 && operations.some(op => op.kind === 'set-system-prompt') ? { step: 3 } : {}) }
  },
  authorize(value, operation, input) {
    const state = progressSchema.parse(value.state)
    if (operation === 'performance.start' && (!state.started || input.sessionId !== state.sessionId || input.revisionId !== input.$baseRevisionId)) throw new Error('Continue the performance belonging to this save.')
  },
}
