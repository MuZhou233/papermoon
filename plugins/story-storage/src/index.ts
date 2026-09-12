/** Node-only storage API; importing this entry does not open a database. */
export { StoryStorage } from './storage.ts'
export { StorageError } from './error.ts'
export type { StorageErrorCode } from './error.ts'
export { STORAGE_FORMAT_VERSION, STORAGE_APPLICATION_ID } from './database.ts'
export type * from './types.ts'
