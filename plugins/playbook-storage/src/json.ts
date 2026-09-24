/** Exact JSON values with deterministic object ordering and no implicit conversion. */
import { invalid, StorageError } from './error.ts'
import type { JsonObject, JsonValue } from './types.ts'

export function encode(value: unknown): string {
  const active = new Set<object>()
  const visit = (item: unknown): string => {
    if (item === null) return 'null'
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item)
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) invalid('JSON numbers must be finite')
      return JSON.stringify(item)
    }
    if (typeof item !== 'object') invalid('expected a JSON value')
    if (active.has(item)) invalid('cyclic JSON value')
    active.add(item)
    try {
      const keys = Reflect.ownKeys(item)
      if (keys.some(key => typeof key !== 'string')) invalid('JSON values cannot have symbol properties')
      if (Array.isArray(item)) {
        if (keys.length !== item.length + 1) invalid('JSON arrays must be dense and have no extra properties')
        const parts: string[] = []
        for (let i = 0; i < item.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(i))
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) invalid('JSON arrays cannot have holes or accessors')
          parts.push(visit(descriptor.value))
        }
        return `[${parts.join(',')}]`
      }
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) invalid('expected a plain JSON object')
      return `{${(keys as string[]).sort().map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!
        if (!('value' in descriptor) || !descriptor.enumerable) invalid('JSON objects cannot have accessors or hidden properties')
        return `${JSON.stringify(key)}:${visit(descriptor.value)}`
      }).join(',')}}`
    } finally { active.delete(item) }
  }
  try { return visit(value) } catch (error) {
    if (error instanceof RangeError) invalid('JSON nesting exceeds the runtime limit')
    throw error
  }
}

export function decode(text: string): JsonValue {
  try {
    const value: unknown = JSON.parse(text)
    if (encode(value) !== text) throw new Error('noncanonical stored JSON')
    return value as JsonValue
  } catch (error) { throw new StorageError('corrupt', 'invalid stored JSON value', { cause: error }) }
}
export function metadata(value: JsonObject = {}): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('metadata must be a JSON object')
  return encode(value)
}
export function decodeObject(text: string): JsonObject {
  const value = decode(text)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new StorageError('corrupt', 'stored metadata is not an object')
  return value as JsonObject
}
export function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.isWellFormed() || value.includes('\0')) invalid(`${label} must be a well-formed Unicode string without NUL`)
}
export function name(value: unknown): asserts value is string {
  text(value, 'name')
  if (!value.trim()) invalid('name must not be blank')
}
export function sequence(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid('sequence must be a nonnegative safe integer')
}
