/** Business failures carry an entity/field location; storage failures retain their own identity. */
export type PlaybookErrorCode = 'invalid-input' | 'invalid-content' | 'not-found' | 'already-exists'
export class PlaybookError extends Error {
  constructor(readonly code: PlaybookErrorCode, message: string, readonly location: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PlaybookError'
  }
}
export function fail(code: PlaybookErrorCode, location: string, message: string): never {
  throw new PlaybookError(code, message, location)
}
