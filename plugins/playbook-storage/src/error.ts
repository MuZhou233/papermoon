/** Stable failure categories; callers need not parse SQLite diagnostics. */
export type StorageErrorCode = 'invalid-input' | 'not-found' | 'conflict' | 'busy' | 'closed' | 'format-mismatch' | 'corrupt' | 'database-error'
export class StorageError extends Error {
  constructor(readonly code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StorageError'
  }
}
export function databaseError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const code = typeof error === 'object' && error !== null && 'errcode' in error ? Number(error.errcode) & 255 : undefined
  return new StorageError(code === 5 || code === 6 ? 'busy' : code === 11 || code === 26 ? 'corrupt' : 'database-error',
    error instanceof Error ? error.message : String(error), { cause: error })
}
export function invalid(message: string): never { throw new StorageError('invalid-input', message) }
