import { en, type T } from './locales.ts'
export type StoryErrorKey = 'disabled' | 'staleAttempt' | 'notReady' | 'wrongStep' | 'practiceNotReady' | 'exampleNotReady' | 'cannotSend' | 'configurationMissing'
/** Preserve the chapter error identity across RPC while keeping its approved fallback text. */
export class StoryError extends Error {
  constructor(readonly key: StoryErrorKey) { super(en[key]) }
}
export interface StoryFailure { key?: StoryErrorKey; message: string }
export function failureText(failure: StoryFailure, t: T): string { return failure.key ? t(failure.key) : failure.message }
