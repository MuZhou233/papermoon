/** One connection owns writer settings; playbook content stays in its separate repository. */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, closeSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { encodeJson } from '@papermoon/playbook-storage/value'
import {
  parseDefinition,
  writerSchema,
  WriterError,
  type Writer,
  type WriterDefinition,
} from './model.ts'
export const WRITERS_APPLICATION_ID = 0x504d5752
const table =
  'CREATE TABLE writers (id TEXT PRIMARY KEY, sequence INTEGER NOT NULL CHECK(sequence >= 0), body TEXT NOT NULL CHECK(json_valid(body))) STRICT'
function convert(error: unknown): Error {
  if (error instanceof WriterError) return error
  const raw = error as { errcode?: number }
  return new WriterError(
    raw?.errcode === 5 || raw?.errcode === 6 ? 'busy' : 'database-error',
    'writer database operation failed',
    { cause: error },
  )
}
export class WriterRepository {
  private db: DatabaseSync
  private closed = false
  constructor(config: { path: string }) {
    if (
      !config.path?.trim() ||
      config.path === ':memory:' ||
      config.path.includes('\0')
    )
      throw new WriterError(
        'invalid-input',
        'use a nonempty database file path',
      )
    const path = resolve(config.path)
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    try {
      closeSync(openSync(path, 'wx', 0o600))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    this.db = new DatabaseSync(path)
    try {
      this.db.exec('PRAGMA busy_timeout=0; PRAGMA foreign_keys=ON')
      const id = this.db.prepare('PRAGMA application_id').get()!.application_id
      const schema = this.db
        .prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'")
        .all()
      const fresh = id === 0 && !schema.length
      if (
        !fresh &&
        (id !== WRITERS_APPLICATION_ID ||
          schema.length !== 1 ||
          schema[0]!.sql !== table)
      )
        throw new WriterError(
          'format-mismatch',
          'unsupported writer database format',
        )
      if (
        !fresh &&
        this.db
          .prepare('PRAGMA quick_check')
          .all()
          .some((row) => row.quick_check !== 'ok')
      )
        throw new WriterError(
          'corrupt',
          'writer database integrity check failed',
        )
      if (fresh) this.db.exec('PRAGMA auto_vacuum=NONE')
      this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA')
      if (fresh)
        this.transaction(() =>
          this.db.exec(
            `${table}; PRAGMA application_id=${WRITERS_APPLICATION_ID}`,
          ),
        )
      this.list()
    } catch (error) {
      this.db.close()
      throw convert(error)
    }
  }
  private open() {
    if (this.closed)
      throw new WriterError('closed', 'writer repository is closed')
  }
  private transaction<T>(action: () => T): T {
    this.open()
    try {
      this.db.exec('BEGIN IMMEDIATE')
    } catch (error) {
      throw convert(error)
    }
    try {
      const result = action()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch (rollback) {
        this.close()
        throw new WriterError(
          'database-error',
          'rollback failed; connection closed',
          { cause: new AggregateError([error, rollback]) },
        )
      }
      throw convert(error)
    }
  }
  private decode(row: {
    id: unknown
    sequence: unknown
    body: unknown
  }): Writer {
    try {
      const writer = writerSchema.parse(JSON.parse(String(row.body)))
      if (writer.id !== row.id || writer.sequence !== row.sequence)
        throw new Error('writer identity mismatch')
      return writer
    } catch (error) {
      throw new WriterError('corrupt', 'invalid stored writer', {
        cause: error,
      })
    }
  }
  list(): Writer[] {
    this.open()
    try {
      return this.db
        .prepare('SELECT * FROM writers ORDER BY id')
        .all()
        .map((row) =>
          this.decode(row as { id: unknown; sequence: unknown; body: unknown }),
        )
    } catch (error) {
      throw convert(error)
    }
  }
  get(id: string): Writer {
    this.open()
    try {
      const row = this.db.prepare('SELECT * FROM writers WHERE id=?').get(id)
      if (!row) throw new WriterError('not-found', 'writer does not exist')
      return this.decode(row as { id: unknown; sequence: unknown; body: unknown })
    } catch (error) {
      throw convert(error)
    }
  }
  create(input: WriterDefinition): Writer {
    const definition = parseDefinition(input),
      time = new Date().toISOString()
    return this.transaction(() => {
      const writer: Writer = {
        ...definition,
        id: randomUUID(),
        sequence: 0,
        createdAt: time,
        updatedAt: time,
      }
      this.db
        .prepare('INSERT INTO writers VALUES (?, ?, ?)')
        .run(writer.id, writer.sequence, encodeJson(writer))
      return writer
    })
  }
  update(
    id: string,
    expectedSequence: number,
    input: WriterDefinition,
  ): Writer {
    const definition = parseDefinition(input)
    return this.transaction(() => {
      const previous = this.mutable(id, expectedSequence)
      if (previous.sequence === Number.MAX_SAFE_INTEGER)
        throw new WriterError('invalid-input', 'writer sequence exhausted')
      const writer: Writer = {
        ...definition,
        id: previous.id,
        createdAt: previous.createdAt,
        sequence: previous.sequence + 1,
        updatedAt: new Date().toISOString(),
      }
      this.db
        .prepare('UPDATE writers SET sequence=?, body=? WHERE id=?')
        .run(writer.sequence, encodeJson(writer), id)
      return writer
    })
  }
  copy(
    id: string,
    details: Pick<WriterDefinition, 'name' | 'description'>,
  ): Writer {
    const source = this.get(id)
    return this.create({
      name: details.name,
      ...((details.description ?? source.description) === undefined
        ? {}
        : { description: details.description ?? source.description }),
      systemPrompt: source.systemPrompt,
      ...(source.systemPromptName === undefined
        ? {}
        : { systemPromptName: source.systemPromptName }),
      messages: source.messages.map((message) => ({
        ...message,
        id: randomUUID(),
      })),
      metadata: source.metadata,
    })
  }
  delete(id: string, expectedSequence: number): void {
    this.transaction(() => {
      this.mutable(id, expectedSequence)
      this.db.prepare('DELETE FROM writers WHERE id=?').run(id)
    })
  }
  private mutable(id: string, sequence: number): Writer {
    const writer = this.get(id)
    if (writer.sequence !== sequence)
      throw new WriterError(
        'conflict',
        'the writer changed; reload before saving',
      )
    return writer
  }
  close(): void {
    if (!this.closed) {
      this.db.close()
      this.closed = true
    }
  }
}
