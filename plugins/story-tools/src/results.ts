/** Public result declarations, shared by catalog presentation and DSH output validation. */
import type { ToolName } from './catalog.ts'
export interface ResultSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  additionalProperties?: boolean
  properties?: Record<string, ResultSchema>
  required?: string[]
  items?: ResultSchema
  oneOf?: ResultSchema[]
}
const string: ResultSchema = { type: 'string' },
  number: ResultSchema = { type: 'integer' }
const record: ResultSchema = { type: 'object', additionalProperties: true }
const array = (items: ResultSchema): ResultSchema => ({ type: 'array', items })
const object = (
  properties: Record<string, ResultSchema>,
  required = Object.keys(properties),
): ResultSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})
const page = (item: ResultSchema, located = true): ResultSchema =>
  object(
    {
      ...(located ? { ref: record } : {}),
      items: array(item),
      next: located ? string : number,
    },
    [...(located ? ['ref'] : []), 'items'],
  )
const edit = {
  schema: object({ sequence: number, affected: array(record) }),
  description:
    'Returns the saved draft sequence and affected objects.',
}
export const results: Record<
  ToolName,
  { schema: ResultSchema; description: string }
> = {
  story_compile: {
    schema: { oneOf: [
      object({ ok: { type: 'boolean' }, source: record, diagnostics: array(record) }),
      object({ ok: { type: 'boolean' }, source: record, diagnostics: array(record), artifactId: string, context: record, options: record }),
    ] },
    description: 'Returns source identity and diagnostics. Success includes the artifact ID, options and starting context.',
  },
  story_status: {
    schema: object({
      script: record,
      draft: record,
      languages: array(record),
      defaultLanguage: string,
      programFiles: number,
      textEntries: number,
      settings: record,
    }),
    description:
      'Returns script and draft records, registered languages, content counts and metadata.',
  },
  story_program_list: {
    schema: page(object({ path: string, metadata: record })),
    description:
      'Returns the content reference, file paths, metadata and an optional next cursor.',
  },
  story_program_read: {
    schema: object({
      ref: record,
      file: object({ path: string, source: string, metadata: record }),
    }),
    description:
      'Returns the content reference and the complete file with source and metadata.',
  },
  story_program_search: {
    schema: page(record),
    description:
      'Returns the content reference, matching paths, UTF-16 source offsets and an optional next cursor.',
  },
  story_program_edit: edit,
  story_text_list: {
    schema: page(
      object(
        {
          key: string,
          description: string,
          metadata: record,
          languages: array(string),
        },
        ['key', 'metadata', 'languages'],
      ),
    ),
    description:
      'Returns the content reference, keys, usage descriptions, metadata and available languages.',
  },
  story_text_read: {
    schema: {
      oneOf: [
        object({ ref: record, entry: record }),
        object({ ref: record, result: record }),
      ],
    },
    description:
      'Returns the content reference and requested entry or translation. A missing result identifies the language, entry or translation.',
  },
  story_text_search: {
    schema: page(record),
    description:
      'Returns the content reference, matching keys, fields, languages, UTF-16 offsets and an optional next cursor.',
  },
  story_text_edit: edit,
  story_history: {
    schema: {
      oneOf: [page(record, false), object({ entry: record, revision: record })],
    },
    description:
      'Returns revision metadata with an optional ordinal cursor, or a single revision and its directory entry.',
  },
  story_commit: {
    schema: object({ revision: record, entry: record, draft: record }),
    description:
      'Returns the created revision, its directory entry and the updated draft record.',
  },
  story_diff: {
    schema: object(
      { left: record, right: record, items: array(record), next: string },
      ['left', 'right', 'items'],
    ),
    description:
      'Returns both content references, added, removed and modified values, and an optional next cursor.',
  },
  story_restore: {
    schema: object({ draft: record, selection: record }),
    description:
      'Returns the updated draft record and restored selection.',
  },
  story_help: {
    schema: object({ topic: string, text: string }),
    description: 'Returns the selected topic and its usage text.',
  },
}
