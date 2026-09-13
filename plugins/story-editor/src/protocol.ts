/** Runtime validation belongs to the public editor RPC, independently of typed core calls. */
import { z } from 'zod'
import type { ProjectId, ScriptId, RevisionId } from '@papermoon/story-storage'
const object = z.strictObject
const text = z.string(),
  name = z.string().trim().min(1),
  sequence = z.number().int().nonnegative()
const projectId = z
    .string()
    .min(1)
    .transform((v) => v as ProjectId),
  scriptId = z
    .string()
    .min(1)
    .transform((v) => v as ScriptId),
  revisionId = z
    .string()
    .min(1)
    .transform((v) => v as RevisionId)
const ref = z.discriminatedUnion('kind', [
  object({ kind: z.literal('draft'), scriptId, sequence: sequence.optional() }),
  object({ kind: z.literal('revision'), revisionId }),
])
const selection = z.discriminatedUnion('kind', [
  object({ kind: z.literal('all') }),
  object({ kind: z.literal('program') }),
  object({ kind: z.literal('catalog') }),
  object({ kind: z.literal('file'), path: text }),
  object({ kind: z.literal('text'), key: text }),
])
export const operation = z.discriminatedUnion('kind', [
  object({ kind: z.literal('create-file'), path: text, source: text }),
  object({ kind: z.literal('replace-file'), path: text, source: text }),
  object({ kind: z.literal('delete-file'), path: text }),
  object({ kind: z.literal('rename-file'), path: text, to: text }),
  object({ kind: z.literal('add-language'), language: text }),
  object({ kind: z.literal('delete-language'), language: text }),
  object({ kind: z.literal('set-default-language'), language: text }),
  object({
    kind: z.literal('create-text'),
    key: text,
    description: text.optional(),
  }),
  object({ kind: z.literal('delete-text'), key: text }),
  object({ kind: z.literal('rename-text'), key: text, to: text }),
  object({
    kind: z.literal('set-description'),
    key: text,
    description: text.nullable(),
  }),
  object({
    kind: z.literal('set-translation'),
    key: text,
    language: text,
    text,
  }),
  object({ kind: z.literal('delete-translation'), key: text, language: text }),
])
const page = {
  after: text.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
}
export const schemas = {
  compile: object({ scriptId, ref: z.discriminatedUnion('kind', [object({ kind: z.literal('draft'), sequence }), object({ kind: z.literal('revision'), revisionId })]), entry: text.optional(), language: text.optional() }),
  compiled: object({ scriptId, ref: z.discriminatedUnion('kind', [object({ kind: z.literal('draft'), sequence }), object({ kind: z.literal('revision'), revisionId })]), entry: text.optional(), language: text.optional() }),
  catalog: object({
    ...page,
    projectId: projectId.optional(),
    query: text.optional(),
  }),
  projects: object(page),
  createProject: object({ name }),
  renameProject: object({ projectId, name }),
  deleteProject: object({ projectId }),
  createScript: object({ name, projectId, defaultLanguage: name }),
  renameScript: object({ scriptId, name }),
  deleteScript: object({ scriptId }),
  script: object({ scriptId }),
  snapshot: object({ ref }),
  save: object({
    scriptId,
    expectedSequence: sequence,
    operations: z.array(operation),
  }),
  commit: object({
    scriptId,
    expectedSequence: sequence,
    description: text.refine((s) => s.trim().length > 0),
    references: z.array(revisionId).optional(),
  }),
  revision: object({ scriptId, revisionId }),
  history: object({
    scriptId,
    after: z.number().int().nonnegative().optional(),
    limit: page.limit,
  }),
  restore: object({
    scriptId,
    expectedSequence: sequence,
    revisionId,
    selection,
  }),
  copy: object({
    sourceScriptId: scriptId,
    source: z.discriminatedUnion('kind', [
      object({ kind: z.literal('draft'), expectedSequence: sequence }),
      object({ kind: z.literal('revision'), revisionId }),
    ]),
    targetProjectId: projectId,
    name,
    history: z.enum(['copy', 'none']),
  }),
  compare: object({
    left: ref,
    right: ref,
    after: text.optional(),
    limit: page.limit,
    scope: z
      .enum(['all', 'settings', 'program', 'languages', 'texts'])
      .optional(),
  }),
}
export type Method = keyof typeof schemas
export type Params<M extends Method> = z.input<(typeof schemas)[M]>
export type Input<M extends Method> = z.output<(typeof schemas)[M]>
export type EditableOperation = z.output<typeof operation>
