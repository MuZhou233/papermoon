/** Authenticated management operations expose settings and catalog data, never tool execution. */
import { z } from 'zod'
import { definitionSchema } from './model.ts'
const id = z.string().min(1),
  sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const schemas = {
  list: z.strictObject({}),
  get: z.strictObject({ id }),
  create: definitionSchema,
  update: z.strictObject({
    id,
    expectedSequence: sequence,
    definition: definitionSchema,
  }),
  copy: z.strictObject({
    id,
    name: z.string().refine((value) => !!value.trim()),
    description: z.string().optional(),
  }),
  delete: z.strictObject({ id, expectedSequence: sequence }),
  context: z.strictObject({ id }),
  catalog: z.strictObject({}),
}
export type Method = keyof typeof schemas
export type Params<M extends Method> = z.input<(typeof schemas)[M]>
