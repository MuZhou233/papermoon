/** SQLite identity, schema and short synchronous transactions owned by this repository. */
import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue, SQLOutputValue } from 'node:sqlite'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { databaseError, invalid, StorageError } from './error.ts'

export const STORAGE_FORMAT_VERSION = 2
export const STORAGE_APPLICATION_ID = 0x504d5354
const definitions = [
  `CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, metadata TEXT NOT NULL CHECK(json_valid(metadata)), created_at TEXT NOT NULL) STRICT`,
  `CREATE TABLE scripts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, metadata TEXT NOT NULL CHECK(json_valid(metadata)), origin TEXT CHECK(origin IS NULL OR json_valid(origin)), created_at TEXT NOT NULL) STRICT`,
  `CREATE INDEX scripts_project ON scripts(project_id, id)`,
  `CREATE TABLE drafts (script_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE, sequence INTEGER NOT NULL CHECK(sequence >= 0 AND sequence <= 9007199254740991), base_revision_id TEXT, metadata TEXT NOT NULL CHECK(json_valid(metadata))) STRICT`,
  `CREATE TABLE draft_entries (script_id TEXT NOT NULL REFERENCES drafts(script_id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL CHECK(json_valid(value)), PRIMARY KEY(script_id, key)) STRICT`,
  `CREATE TABLE revisions (id TEXT PRIMARY KEY, description TEXT NOT NULL, metadata TEXT NOT NULL CHECK(json_valid(metadata)), source TEXT NOT NULL CHECK(json_valid(source)), references_json TEXT NOT NULL CHECK(json_valid(references_json)), created_at TEXT NOT NULL) STRICT`,
  `CREATE TABLE revision_entries (revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL CHECK(json_valid(value)), PRIMARY KEY(revision_id, key)) STRICT`,
  `CREATE TABLE script_revisions (script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL CHECK(ordinal > 0 AND ordinal <= 9007199254740991), revision_id TEXT NOT NULL REFERENCES revisions(id), metadata TEXT NOT NULL CHECK(json_valid(metadata)), PRIMARY KEY(script_id, ordinal), UNIQUE(script_id, revision_id)) STRICT`,
  `CREATE INDEX history_revision ON script_revisions(revision_id)`,
  `CREATE TABLE publications (id TEXT PRIMARY KEY, script_id TEXT NOT NULL, revision_id TEXT NOT NULL, metadata TEXT NOT NULL CHECK(json_valid(metadata)), created_at TEXT NOT NULL, FOREIGN KEY(script_id, revision_id) REFERENCES script_revisions(script_id, revision_id) ON DELETE CASCADE) STRICT`,
  `CREATE INDEX publications_script ON publications(script_id, id)`,
  `CREATE INDEX publications_revision ON publications(revision_id, id)`,
]
type Row = Record<string, SQLOutputValue>

export class Connection {
  private readonly db: DatabaseSync
  private closed = false

  constructor(path: string) {
    if (typeof path !== 'string' || !path.trim() || path.includes('\0')) invalid('database path must be a nonempty filesystem path')
    // A real file gives the configured rollback journal identical behavior in tests and production.
    if (path === ':memory:') invalid('use a temporary database file instead of :memory:')
    const absolute = resolve(path)
    mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 })
    try { closeSync(openSync(absolute, 'wx', 0o600)) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    this.db = new DatabaseSync(absolute)
    try { this.initialize() } catch (error) {
      this.db.close()
      throw databaseError(error)
    }
  }

  private initialize(): void {
    this.db.exec('PRAGMA busy_timeout=0; PRAGMA foreign_keys=ON')
    const identity = this.get<{application_id: number}>('PRAGMA application_id')!.application_id
    const version = this.get<{user_version: number}>('PRAGMA user_version')!.user_version
    const objects = this.all<{sql: string}>("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name")
    const fresh = identity === 0 && version === 0 && objects.length === 0
    if (!fresh) {
      if (identity !== STORAGE_APPLICATION_ID || version !== STORAGE_FORMAT_VERSION) throw new StorageError('format-mismatch', 'unsupported database identity or format version')
      const actual = objects.map(row => row.sql).sort()
      const expected = [...definitions].sort()
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new StorageError('format-mismatch', 'database schema differs from the declared format')
      if (this.all('PRAGMA quick_check').some(row => row.quick_check !== 'ok') || this.all('PRAGMA foreign_key_check').length) throw new StorageError('corrupt', 'database integrity check failed')
      const brokenOwnership = this.get(`
        SELECT id FROM scripts WHERE NOT EXISTS (SELECT 1 FROM drafts WHERE script_id=scripts.id)
        UNION ALL
        SELECT id FROM revisions WHERE NOT EXISTS (SELECT 1 FROM script_revisions WHERE revision_id=revisions.id)
        UNION ALL
        SELECT script_id FROM script_revisions GROUP BY script_id HAVING COUNT(*)<>MAX(ordinal)
        LIMIT 1`)
      if (brokenOwnership) throw new StorageError('corrupt', 'draft ownership or revision history is incomplete')
    }
    if (fresh) this.db.exec('PRAGMA auto_vacuum=NONE')
    if (this.get<{auto_vacuum: number}>('PRAGMA auto_vacuum')!.auto_vacuum !== 0) throw new StorageError('format-mismatch', 'database must use auto_vacuum=NONE')
    const journal = this.get<{journal_mode: string}>('PRAGMA journal_mode=DELETE')!.journal_mode
    if (journal !== 'delete') throw new StorageError('database-error', 'unable to enable DELETE journal mode')
    this.db.exec('PRAGMA synchronous=EXTRA')
    if (fresh) this.transaction(true, () => {
      for (const sql of definitions) this.db.exec(sql)
      this.db.exec(`PRAGMA application_id=${STORAGE_APPLICATION_ID}; PRAGMA user_version=${STORAGE_FORMAT_VERSION}`)
    })
  }

  get<T = Row>(sql: string, ...params: SQLInputValue[]): T | undefined {
    this.assertOpen()
    try { return this.db.prepare(sql).get(...params) as T | undefined } catch (error) { throw databaseError(error) }
  }
  all<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    this.assertOpen()
    try { return this.db.prepare(sql).all(...params) as T[] } catch (error) { throw databaseError(error) }
  }
  run(sql: string, ...params: SQLInputValue[]): void {
    this.assertOpen()
    try { this.db.prepare(sql).run(...params) } catch (error) { throw databaseError(error) }
  }
  transaction<T>(write: boolean, body: () => T): T {
    this.assertOpen()
    try { this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN') } catch (error) { throw databaseError(error) }
    try {
      const result = body()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch (rollback) {
        this.close()
        throw new StorageError('database-error', 'rollback failed; connection closed', { cause: new AggregateError([error, rollback]) })
      }
      throw databaseError(error)
    }
  }
  close(): void {
    if (this.closed) return
    this.db.close()
    this.closed = true
  }
  private assertOpen(): void { if (this.closed) throw new StorageError('closed', 'storage is closed') }
}
