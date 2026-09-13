/** Immutable, content-addressed JSON records. Linking a complete temporary file never overwrites a winner. */
import { mkdir, open, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ArtifactError, canonical, loadArtifact } from './runtime.ts'
import type { Artifact } from './types.ts'
export class ArtifactStore {
  constructor(readonly directory: string, private readonly maxBytes = 16 * 1024 * 1024) {}
  private path(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ArtifactError('invalid-artifact', 'invalid artifact ID')
    return join(this.directory, id + '.json')
  }
  async read(id: string): Promise<Artifact | null> {
    const path = this.path(id)
    let bytes: Buffer
    try {
      const file = await open(path, 'r')
      try {
        if ((await file.stat()).size > this.maxBytes) throw new ArtifactError('invalid-artifact', 'stored artifact exceeds size limit')
        bytes = await file.readFile()
      } finally { await file.close() }
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
    const artifact = loadArtifact(bytes.toString('utf8'))
    if (artifact.id !== id) throw new ArtifactError('invalid-artifact', 'stored artifact ID does not match its filename')
    return artifact
  }
  async save(artifact: Artifact, signal?: AbortSignal): Promise<Artifact> {
    const serialized = canonical(loadArtifact(canonical(artifact))) + '\n'
    if (Buffer.byteLength(serialized) > this.maxBytes) throw new ArtifactError('artifact-store-limit', 'artifact exceeds storage size limit')
    signal?.throwIfAborted()
    await mkdir(this.directory, { recursive: true })
    const target = this.path(artifact.id), temporary = join(this.directory, '.' + randomUUID() + '.tmp')
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(serialized); await file.sync(); await file.close()
      signal?.throwIfAborted()
      try { await link(temporary, target) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
      const saved = await this.read(artifact.id)
      if (!saved || saved.checksum !== artifact.checksum) throw new ArtifactError('artifact-conflict', 'the compilation key already contains a different result')
      return saved
    } finally { await file.close(); await unlink(temporary) }
  }
}
