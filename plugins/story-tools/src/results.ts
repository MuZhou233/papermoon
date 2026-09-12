/** Public result declarations, shared by catalog presentation and DSH output validation. */
import type { ToolName } from './catalog.ts'
export interface ResultSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer'
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
    'The committed draft sequence and affected file paths, text keys, languages or metadata targets.',
}
export const results: Record<
  ToolName,
  { schema: ResultSchema; description: string }
> = {
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
      'Script and draft records, registered languages, content counts and content-level metadata. No source bodies.',
  },
  story_program_list: {
    schema: page(object({ path: string, metadata: record })),
    description:
      'Observed ref, file paths and metadata, and an optional next cursor; source text is omitted.',
  },
  story_program_read: {
    schema: object({
      ref: record,
      file: object({ path: string, source: string, metadata: record }),
    }),
    description:
      'Observed ref and one complete file, with exact source and metadata.',
  },
  story_program_search: {
    schema: page(record),
    description:
      'Observed ref, matching paths and UTF-16 source offsets, plus an optional next cursor.',
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
      'Observed ref, keys, usage descriptions, metadata and available languages; translation bodies are omitted.',
  },
  story_text_read: {
    schema: {
      oneOf: [
        object({ ref: record, entry: record }),
        object({ ref: record, result: record }),
      ],
    },
    description:
      'Without language: the complete entry. With language: found translation or missing reason (language, entry or translation), alongside the observed ref.',
  },
  story_text_search: {
    schema: page(record),
    description:
      'Observed ref, matching keys, fields, exact-language identities and UTF-16 offsets, plus an optional next cursor.',
  },
  story_text_edit: edit,
  story_history: {
    schema: {
      oneOf: [page(record, false), object({ entry: record, revision: record })],
    },
    description:
      'Directory and revision metadata as a page with optional ordinal cursor, or a single retained entry and revision. Source bodies are omitted.',
  },
  story_commit: {
    schema: object({ revision: record, entry: record, draft: record }),
    description:
      'The created immutable revision, its directory entry and the updated draft record. Does not include the complete content.',
  },
  story_diff: {
    schema: object(
      { left: record, right: record, items: array(record), next: string },
      ['left', 'right', 'items'],
    ),
    description:
      'Pinned left/right refs, grouped additions, removals and modifications with original business values, and an optional continuation cursor.',
  },
  story_restore: {
    schema: object({ draft: record, selection: record }),
    description:
      'Updated draft record and the requested restoration selection.',
  },
  story_help: {
    schema: object({ topic: string, text: string }),
    description: 'Selected help topic and its complete usage text.',
  },
}
