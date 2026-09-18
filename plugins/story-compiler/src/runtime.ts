/** Frozen artifacts load without executing programs or importing the JSDoc compiler. */
import { createHash } from 'node:crypto'
import type { Artifact, OpeningContext, ResolvedOptions, CompiledDeclaration } from './types.ts'

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
  return digest({ sourceHash, options, compiler: 'papermoon.commonjs/3', apiVersion: 3 })
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}
/** Deserialize a complete record; unknown versions or modified data never trigger recompilation. */
export function loadArtifact(serialized: string): Artifact {
  let raw: unknown
  try { raw = JSON.parse(serialized) } catch { throw new ArtifactError('invalid-artifact', 'artifact is not JSON') }
  object(raw, ['format', 'version', 'apiVersion', 'compiler', 'id', 'sourceHash', 'options', 'context', 'state', 'functions', 'program', 'composition', 'checksum'])
  if (raw.format !== 'papermoon.story' || raw.version !== 3 || raw.apiVersion !== 3 || raw.compiler !== 'papermoon.commonjs/3')
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
  object(raw.state, ['initial', 'schema'])
  for (const value of [raw.state.initial, raw.state.schema]) if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ArtifactError('invalid-artifact', 'invalid state declaration')
  if (raw.composition !== null) { object(raw.composition, ['hash']); if (typeof raw.composition.hash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.composition.hash)) throw new ArtifactError('invalid-artifact', 'invalid composition identity') }
  object(raw.program, ['files', 'texts'])
  for (const [key, nullable] of [['files', false], ['texts', true]] as const) {
    const value = raw.program[key]
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(v => typeof v !== 'string' && !(nullable && v === null))) throw new ArtifactError('invalid-artifact', 'invalid program bundle')
  }
  if (!Object.hasOwn(raw.program.files as object, raw.options.entry)) throw new ArtifactError('invalid-artifact', 'artifact entry is missing')
  if (!Array.isArray(raw.functions)) throw new ArtifactError('invalid-artifact', 'invalid function declarations')
  const names = new Set<string>()
  for (const fn of raw.functions) {
    object(fn, ['name', 'description', 'parameters', 'output', 'arguments', 'factoryHash', 'functionHash', 'location'])
    if (typeof fn.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(fn.name) || names.has(fn.name) || typeof fn.description !== 'string' || !fn.description.trim()) throw new ArtifactError('invalid-artifact', 'invalid tool identity')
    names.add(fn.name)
    for (const hash of [fn.factoryHash, fn.functionHash]) if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new ArtifactError('invalid-artifact', 'invalid function source identity')
    for (const schema of [fn.parameters, fn.output]) if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new ArtifactError('invalid-artifact', 'invalid function schema')
    if (!Array.isArray(fn.arguments) || fn.arguments.some(v => typeof v !== 'string') || new Set(fn.arguments).size !== fn.arguments.length) throw new ArtifactError('invalid-artifact', 'invalid function arguments')
    const schema = fn.parameters as Record<string, unknown>
    if (schema.type !== 'object' || !schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties) || Object.keys(schema.properties).length !== fn.arguments.length || fn.arguments.some(name => !Object.hasOwn(schema.properties as object, name))) throw new ArtifactError('invalid-artifact', 'function parameters do not match arguments')
    object(fn.location, ['path', 'line', 'column'])
    if (typeof fn.location.path !== 'string' || !Object.hasOwn(raw.program.files as object, fn.location.path) || !Number.isSafeInteger(fn.location.line) || Number(fn.location.line) < 1 || !Number.isSafeInteger(fn.location.column) || Number(fn.location.column) < 1) throw new ArtifactError('invalid-artifact', 'invalid function location')
  }
  const { checksum, ...payload } = raw
  if (digest(payload) !== checksum || compilationKey(raw.sourceHash as string, raw.options as unknown as ResolvedOptions) !== raw.id)
    throw new ArtifactError('invalid-artifact', 'artifact checksum or identity does not match')
  return freeze(raw as unknown as Artifact)
}
export function createArtifact(sourceHash: string, options: ResolvedOptions, compiled: CompiledDeclaration): Artifact {
  validateContext(compiled.context)
  const payload = { format: 'papermoon.story', version: 3, apiVersion: 3, compiler: 'papermoon.commonjs/3', id: compilationKey(sourceHash, options), sourceHash, options, context: compiled.context, state: compiled.state, functions: compiled.functions, program: compiled.program, composition: compiled.composition }
  return loadArtifact(canonical({ ...payload, checksum: digest(payload) }))
}
/** Return an independent context; mutating it cannot affect another initialization. */
export function initialize(artifact: Artifact): OpeningContext {
  return structuredClone(loadArtifact(canonical(artifact)).context)
}
