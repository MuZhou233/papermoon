/** Chapter policy: persisted attempts advance only through their declared gates. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'

const attemptSchema = z.strictObject({
  id: z.string().uuid(), step: z.number().int().min(1).max(6),
  exampleSeen: z.boolean(), trajectorySeen: z.boolean(),
  sessionId: z.string().uuid().optional(), successfulTurn: z.number().int().positive().optional(),
})
export type Attempt = z.infer<typeof attemptSchema>
export function newAttempt(): Attempt { return { id: randomUUID(), step: 1, exampleSeen: false, trajectorySeen: false } }

/** Single-writer atomic file; unsupported records fail without altering the original. */
export class Progress {
  private value: Attempt | undefined
  constructor(private readonly path: string) {}
  async load(): Promise<Attempt> {
    if (this.value) return this.value
    try { this.value = attemptSchema.parse(JSON.parse(await readFile(this.path, 'utf8'))) }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      await this.save(newAttempt())
    }
    return this.value!
  }
  async save(value: Attempt) {
    const checked = attemptSchema.parse(value)
    await mkdir(dirname(this.path), { recursive: true })
    const temporary = this.path + '.' + randomUUID() + '.tmp'
    await writeFile(temporary, JSON.stringify(checked, null, 2) + '\n', { mode: 0o600 })
    await rename(temporary, this.path)
    this.value = checked
  }
}
