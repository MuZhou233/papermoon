/** Frozen text artifacts load without the compiler, Worker or authored-content repository. */
import { createHash } from 'node:crypto'
import type { Artifact, OpeningContext, ResolvedOptions } from './types.ts'

export class ArtifactError extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}'
  throw new ArtifactError('invalid-artifact', 'artifact contains a non-JSON value')
}
export function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex') }
function object(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key)))
    throw new ArtifactError('invalid-artifact', 'unexpected artifact fields')
}
export function validateContext(value: unknown): asserts value is OpeningContext {
  object(value, ['systemPrompt', 'systemPromptName', 'messages'])
  if (typeof value.systemPrompt !== 'string' || ('systemPromptName' in value && typeof value.systemPromptName !== 'string') || !Array.isArray(value.messages))
    throw new ArtifactError('invalid-artifact', 'invalid initial context')
  for (const message of value.messages) {
    object(message, ['role', 'name', 'content'])
    if (typeof message.role !== 'string' || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || ('name' in message && typeof message.name !== 'string'))
      throw new ArtifactError('invalid-artifact', 'invalid initial message')
  }
}
export function compilationKey(sourceHash: string, options: ResolvedOptions): string {
  return digest({ sourceHash, options, compiler: 'papermoon.commonjs/1', apiVersion: 1 })
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
/** Deserialize a complete record; unknown versions or modified data never trigger recompilation. */
export function loadArtifact(serialized: string): Artifact {
  let raw: unknown
  try { raw = JSON.parse(serialized) } catch { throw new ArtifactError('invalid-artifact', 'artifact is not JSON') }
  object(raw, ['format', 'version', 'apiVersion', 'compiler', 'id', 'sourceHash', 'options', 'context', 'checksum'])
  if (raw.format !== 'papermoon.opening' || raw.version !== 1 || raw.apiVersion !== 1 || raw.compiler !== 'papermoon.commonjs/1')
    throw new ArtifactError('unsupported-artifact', 'unsupported artifact format or compiler')
  if (![raw.id, raw.sourceHash, raw.checksum].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)))
    throw new ArtifactError('invalid-artifact', 'invalid artifact identity')
  object(raw.options, ['entry', 'language', 'limits'])
  if (typeof raw.options.entry !== 'string' || typeof raw.options.language !== 'string') throw new ArtifactError('invalid-artifact', 'invalid compiler options')
  const keys = ['inputBytes', 'modules', 'outputBytes', 'executionMs', 'totalMs', 'concurrency', 'memoryMb']
  object(raw.options.limits, keys)
  const limits = raw.options.limits
  if (keys.some(key => !Number.isSafeInteger(limits[key]) || Number(limits[key]) < 1))
    throw new ArtifactError('invalid-artifact', 'invalid resource limits')
  validateContext(raw.context)
  const { checksum, ...payload } = raw
  if (digest(payload) !== checksum || compilationKey(raw.sourceHash as string, raw.options as unknown as ResolvedOptions) !== raw.id)
    throw new ArtifactError('invalid-artifact', 'artifact checksum or identity does not match')
  return freeze(raw as unknown as Artifact)
}
export function createArtifact(sourceHash: string, options: ResolvedOptions, context: OpeningContext): Artifact {
  validateContext(context)
  const payload = { format: 'papermoon.opening', version: 1, apiVersion: 1, compiler: 'papermoon.commonjs/1', id: compilationKey(sourceHash, options), sourceHash, options, context }
  return loadArtifact(canonical({ ...payload, checksum: digest(payload) }))
}
/** Return an independent context; mutating it cannot affect another initialization. */
export function initialize(artifact: Artifact): OpeningContext {
  return structuredClone(loadArtifact(canonical(artifact)).context)
}
