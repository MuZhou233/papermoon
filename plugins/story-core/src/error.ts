/** Business failures carry an entity/field location; storage failures retain their own identity. */
export type StoryErrorCode = 'invalid-input' | 'invalid-content' | 'not-found' | 'already-exists'
export class StoryError extends Error {
  constructor(readonly code: StoryErrorCode, message: string, readonly location: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StoryError'
  }
}
export function fail(code: StoryErrorCode, location: string, message: string): never {
  throw new StoryError(code, message, location)
}
