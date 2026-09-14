/** JSON Schema validation runs in bounded Workers; it never coerces or supplies values. */
import { Ajv } from 'ajv'
import type { Schema } from './types.ts'
const ajv = new Ajv({ strict: true, strictTypes: false, strictTuples: false, strictRequired: false, allowUnionTypes: true, ownProperties: true })
export function validate(schema: Schema, value: unknown, field: string): void {
  const check = ajv.compile(schema)
  if ('$async' in check && check.$async) throw Object.assign(new Error(field + ": asynchronous schemas are not supported"), { code: "invalid-schema", field })
  if (!check(value)) throw Object.assign(new Error(field + ': ' + ajv.errorsText(check.errors)), { code: 'schema-validation', field })
}
export function checkSchema(schema: Schema, field: string): void {
  try { const check = ajv.compile(schema); if ('$async' in check && check.$async) throw new Error("asynchronous schemas are not supported") } catch (cause) { throw Object.assign(new Error(field + ': ' + (cause instanceof Error ? cause.message : String(cause))), { code: 'invalid-schema', field }) }
}
