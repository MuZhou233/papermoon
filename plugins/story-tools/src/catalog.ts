/** The same validated definitions drive discovery, execution and the management UI. */
import { z } from 'zod'
import { results, type ResultSchema } from './results.ts'
const object = z.strictObject,
  text = z.string(),
  sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const metadata = z.record(z.string(), z.unknown())
const ref = z.discriminatedUnion('kind', [
  object({ kind: z.literal('draft'), sequence: sequence.optional() }),
  object({ kind: z.literal('revision'), revisionId: text }),
])
const page = {
  after: text.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
}
const selection = z.discriminatedUnion('kind', [
  object({ kind: z.literal('all') }),
  object({ kind: z.literal('program') }),
  object({ kind: z.literal('catalog') }),
  object({ kind: z.literal('file'), path: text }),
  object({ kind: z.literal('text'), key: text }),
])
const programOperation = z.discriminatedUnion('kind', [
  object({
    kind: z.literal('create-file'),
    path: text,
    source: text,
    metadata: metadata.optional(),
  }),
  object({ kind: z.literal('replace-file'), path: text, source: text }),
  object({
    kind: z.literal('replace-text'),
    path: text,
    oldText: text.min(1),
    newText: text,
  }),
  object({ kind: z.literal('rename-file'), path: text, to: text }),
  object({ kind: z.literal('delete-file'), path: text }),
  object({
    kind: z.literal('set-metadata'),
    target: z.discriminatedUnion('kind', [
      object({ kind: z.literal('program') }),
      object({ kind: z.literal('file'), path: text }),
    ]),
    metadata,
  }),
])
const textOperation = z.discriminatedUnion('kind', [
  object({
    kind: z.literal('add-language'),
    language: text,
    metadata: metadata.optional(),
  }),
  object({ kind: z.literal('delete-language'), language: text }),
  object({ kind: z.literal('set-default-language'), language: text }),
  object({
    kind: z.literal('create-text'),
    key: text,
    description: text.optional(),
    metadata: metadata.optional(),
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
    metadata: metadata.optional(),
  }),
  object({ kind: z.literal('delete-translation'), key: text, language: text }),
  object({
    kind: z.literal('set-metadata'),
    target: z.discriminatedUnion('kind', [
      object({ kind: z.literal('catalog') }),
      object({ kind: z.literal('language'), language: text }),
      object({ kind: z.literal('text'), key: text }),
      object({ kind: z.literal('translation'), key: text, language: text }),
    ]),
    metadata,
  }),
])
export const schemas = {
  story_status: object({}),
  story_program_list: object({ ref: ref.optional(), ...page }),
  story_program_read: object({ ref: ref.optional(), path: text }),
  story_program_search: object({ ref: ref.optional(), query: text, ...page }),
  story_program_edit: object({
    expectedSequence: sequence,
    operations: z.array(programOperation),
  }),
  story_text_list: object({
    ref: ref.optional(),
    ...page,
    missingLanguage: text.optional(),
  }),
  story_text_read: object({
    ref: ref.optional(),
    key: text,
    language: text.optional(),
  }),
  story_text_search: object({
    ref: ref.optional(),
    query: text,
    language: text.optional(),
    fields: z.array(z.enum(['key', 'description', 'translation'])).optional(),
    ...page,
  }),
  story_text_edit: object({
    expectedSequence: sequence,
    operations: z.array(textOperation),
  }),
  story_history: object({
    after: sequence.optional(),
    limit: page.limit,
    revisionId: text.optional(),
  }),
  story_commit: object({
    expectedSequence: sequence,
    description: text.refine((value) => !!value.trim()),
    metadata: metadata.optional(),
    entryMetadata: metadata.optional(),
    references: z.array(text).optional(),
  }),
  story_diff: object({
    left: ref,
    right: ref,
    scope: z
      .enum(['all', 'settings', 'program', 'languages', 'texts'])
      .optional(),
    ...page,
  }),
  story_restore: object({
    expectedSequence: sequence,
    revisionId: text,
    selection,
  }),
  story_help: object({
    topic: z.enum(['overview', 'program', 'texts', 'history']).optional(),
  }),
}
export type ToolName = keyof typeof schemas
export const help = {
  overview:
    'Each tool set targets one script. Reads return the observed draft sequence. Supply that expectedSequence for edits, commits and restores. A conflict does not save or retry. Lists, searches and comparisons are paginated; continue draft pages with the returned sequence. Program paths are virtual, not host paths.',
  program:
    'story_program_read({path:"src/main.js"}) reads a draft file. story_program_edit({expectedSequence:0,operations:[{kind:"create-file",path:"src/main.js",source:""}]}) creates a file. replace-text requires a nonempty oldText with exactly one literal match. Edits in a call are ordered and saved together; rename does not update references.',
  texts:
    'story_text_edit accepts language, entry, translation and metadata operations. Example: {expectedSequence:0,operations:[{kind:"create-text",key:"greeting",description:"Opening greeting"},{kind:"set-translation",key:"greeting",language:"en",text:"Hello"}]}. Register en first if absent. story_text_read({key:"greeting",language:"en"}) reports missing language, entry or translation distinctly. Empty translations are valid. No language fallback occurs.',
  history:
    'story_commit({expectedSequence:0,description:"Initial draft"}) creates a revision without compiling or publishing. Read a retained revision with ref:{kind:"revision",revisionId:"..."}. story_history lists metadata only. story_diff returns business changes, not line diffs. story_restore replaces the selected content without deleting history or committing. Partial restoration preserves the draft origin; restoring all updates it.',
}
const descriptions: Record<ToolName, string> = {
  story_status:
    'Read script identity, current draft sequence, origin, languages and content counts without source bodies.',
  story_program_list:
    'List virtual program files and their metadata. Draft continuation requires the returned sequence.',
  story_program_read:
    'Read one complete program file, including its exact source and metadata.',
  story_program_search:
    'Search program source by literal text. Returns locations, not rewritten source.',
  story_program_edit:
    'Atomically apply ordered program edits at expectedSequence. replace-text must match exactly once. Does not modify text entries.',
  story_text_list:
    'List text entries, or missing translations for missingLanguage. Does not fall back to another language.',
  story_text_read:
    'Read a text entry or an exact-language translation. Missing language, entry and translation are distinct outcomes.',
  story_text_search:
    'Search keys, usage descriptions and translations by literal text; language selects exact translations.',
  story_text_edit:
    'Atomically edit languages, text entries, descriptions, translations and metadata at expectedSequence. Does not modify program files.',
  story_history:
    'List retained revision metadata in directory order, or inspect one retained revision. Does not load source bodies.',
  story_commit:
    'Commit the draft at expectedSequence as an immutable revision. Description must not be blank; no compilation or publication occurs.',
  story_diff:
    'Compare draft/revision contents in this script. Returns grouped business values and stable pagination, without line diffs.',
  story_restore:
    'Restore all or selected revision content at expectedSequence. Retains history and does not create a revision.',
  story_help:
    'Read tool usage and examples for overview, program, texts or history.',
}
const writes = new Set<ToolName>([
  'story_program_edit',
  'story_text_edit',
  'story_commit',
  'story_restore',
])
export interface ToolDescriptor {
  name: ToolName
  description: string
  parameters: Record<string, unknown>
  group: 'program' | 'texts' | 'history'
  readonly: boolean
  output: {
    schema: ResultSchema
    description: string
  }
}
export function toolCatalog(): ToolDescriptor[] {
  return (Object.keys(schemas) as ToolName[]).map((name) => {
    const { $schema: _schema, ...parameters } = z.toJSONSchema(schemas[name], {
      target: 'draft-7',
    })
    return {
      name,
      description: descriptions[name],
      parameters,
      group: name.includes('program')
        ? 'program'
        : name.includes('text')
          ? 'texts'
          : 'history',
      readonly: !writes.has(name),
      output: structuredClone(results[name]),
    }
  })
}
