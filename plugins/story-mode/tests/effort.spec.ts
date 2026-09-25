import { describe, expect, it } from 'vitest'
import { effortAdvice } from '../src/client/effort.ts'
import type { ModelInfo } from '../../text-conversations/src/types.ts'
const choice = { provider: 'fixture', model: 'model' }
const model: ModelInfo = { provider: 'fixture', id: 'model', name: 'Model', ready: true, reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }] } }
describe('chapter effort advice', () => {
  it('requires confirmed off and does not mistake omission for off', () => {
    expect(effortAdvice(model, choice)).toBe('off')
    expect(effortAdvice(model, { ...choice, reasoningEffort: 'off' })).toBeUndefined()
    const defaultOff = { ...model, reasoning: { ...model.reasoning!, defaultEffort: 'off' } }
    expect(effortAdvice(defaultOff, choice)).toBeUndefined()
    expect(effortAdvice(defaultOff, { ...choice, reasoningEffort: 'high' })).toBe('off')
    expect(choice).toEqual({ provider: 'fixture', model: 'model' })
  })
  it('always advises lowest when off is unavailable, including an already low choice', () => {
    const low = { ...model, reasoning: { efforts: [{ id: 'low', name: 'Low' }] } }
    expect(effortAdvice(low, { ...choice, reasoningEffort: 'low' })).toBe('lowest')
    expect(effortAdvice({ ...model, reasoning: undefined }, choice)).toBe('unavailable')
  })
})
