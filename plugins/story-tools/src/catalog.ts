/** The same validated definitions drive discovery, execution and the management UI. */
import { z } from 'zod'
import { results, type ResultSchema } from './results.ts'
const object = z.strictObject,
  text = z.string(),
  sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const metadata = z.record(z.string(), z.unknown())
const expectedSequence = sequence.describe('Use the draft sequence returned by a read or edit. The operation fails if the draft has changed.')
const revisionId = text.describe('Use a revision ID from this script\'s story_history.')
const ref = z.discriminatedUnion('kind', [
  object({ kind: z.literal('draft'), sequence: sequence.optional().describe('Pin the read to this draft sequence. Required when continuing a draft query.') }),
  object({ kind: z.literal('revision'), revisionId }),
])
const page = {
  after: text.optional().describe('Continue from the previous result\'s next cursor.'),
  limit: z.number().int().min(1).max(1000).optional().describe('Set the maximum number of results. Defaults to 100.'),
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
    oldText: text.min(1).describe('Use nonempty literal text that occurs exactly once.'),
    newText: text.describe('Replace the match with this text. An empty string deletes the match.'),
  }),
  object({ kind: z.literal('rename-file'), path: text, to: text }),
  object({ kind: z.literal('delete-file'), path: text }),
  object({
    kind: z.literal('set-metadata'),
    target: z.discriminatedUnion('kind', [
      object({ kind: z.literal('program') }),
      object({ kind: z.literal('file'), path: text }),
    ]),
    metadata: metadata.describe('Replace the selected metadata with this JSON object.'),
  }),
])
const textOperation = z.discriminatedUnion('kind', [
  object({
    kind: z.literal('add-language'),
    language: text,
    metadata: metadata.optional(),
  }),
  object({ kind: z.literal('delete-language'), language: text, expectedSequence }).describe('Delete the language and all its translations. Choose another default in the same batch when deleting the default language.'),
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
    description: text.nullable().describe('Set the entry\'s usage description. Use null to remove it.'),
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
    metadata: metadata.describe('Replace the selected metadata with this JSON object.'),
  }),
])
export const schemas = {
  story_compile: object({
    ref: object({ kind: z.literal('draft'), sequence: sequence.describe('Use the sequence of the draft snapshot to compile.') }),
    entry: text.optional().describe('Select the CommonJS entry file. Defaults to story.js.'),
    language: text.optional().describe('Select a registered language. Defaults to the script\'s default language.'),
  }),
  story_status: object({}),
  story_program_list: object({ ref: ref.optional(), ...page }),
  story_program_read: object({ ref: ref.optional(), path: text }),
  story_program_search: object({ ref: ref.optional(), query: text, ...page }),
  story_program_edit: object({
    operations: z.array(programOperation),
  }),
  story_text_list: object({
    ref: ref.optional(),
    ...page,
    missingLanguage: text.optional().describe('List entries missing a translation in this registered language.'),
  }),
  story_text_read: object({
    ref: ref.optional(),
    key: text,
    language: text.optional().describe('Read this language\'s translation. Omit to read the complete entry.'),
  }),
  story_text_search: object({
    ref: ref.optional(),
    query: text,
    language: text.optional().describe('Select an exact registered language.'),
    fields: z.array(z.enum(['key', 'description', 'translation'])).optional(),
    ...page,
  }),
  story_text_edit: object({
    operations: z.array(textOperation),
  }),
  story_history: object({
    after: sequence.optional().describe('Continue after this revision ordinal, using the previous result\'s next cursor.'),
    limit: page.limit,
    revisionId: revisionId.optional(),
  }),
  story_commit: object({
    expectedSequence,
    description: text.refine((value) => !!value.trim()).describe('Describe the revision. The description must contain non-whitespace text.'),
    metadata: metadata.optional(),
    entryMetadata: metadata.optional(),
    targets: z.array(object({ entry: text.optional(), language: text.optional() })).min(1).optional().describe('Compile these targets in order. Defaults to story.js in the draft default language. The first target is the default for performance.'),
    allowCompilationFailure: z.boolean().optional().describe('Allow a revision without artifacts when script compilation fails. Defaults to false. Successful compilation always attaches all results.'),
    references: z.array(revisionId).optional().describe('Record additional revision IDs as references for this revision.'),
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
    expectedSequence,
    revisionId,
    selection,
  }),
  story_help: object({
    topic: z.enum(['overview', 'program', 'texts', 'history', 'compilation']).optional().describe('Select a help topic. Defaults to overview.'),
  }),
}
export type ToolName = keyof typeof schemas
export const help = {
  overview: [
    "The bound script contains a mutable draft and immutable revisions. Its draft stores program files and a multilingual text catalog.",
    "Program tools list, read, search and edit virtual files. Text tools manage languages, entries and translations. story_status reports draft status. story_commit compiles and saves a complete revision, story_history lists revisions, story_diff compares content, and story_restore restores selected content. story_compile creates a saved starting context.",
    "Programs use CommonJS. The default entry story.js exports a declaration through module.exports, with systemPrompt and an ordered messages array. require(\"@papermoon/story\") provides defineStory and t(key), which reads text in the selected language.",
    "Select a story_help topic for details: program covers files and a compilable entry; texts covers languages and translations; history covers revisions, comparisons and restoration; compilation covers the declaration and module API.",
  ].join('\n\n'),
  program: [
    "story_program_read({path:\"story.js\"}) reads the complete file. Paths are relative virtual paths with / separators. create-file requires an unused path; replace-file replaces the complete source. replace-text requires a nonempty oldText with exactly one literal match. Edits in a batch execute in order and save together.",
    "This call creates a minimal CommonJS entry when story.js is absent:",
    "```json\n{\n  \"operations\": [\n    {\n      \"kind\": \"create-file\",\n      \"path\": \"story.js\",\n      \"source\": \"const { defineStory } = require(\\\"@papermoon/story\\\");\\nmodule.exports = defineStory({ systemPrompt: \\\"\\\", messages: [] });\"\n    }\n  ]\n}\n```",
    "rename-file moves the file to the supplied path. Update references to the old path separately. set-metadata replaces the selected metadata object. The compilation topic describes defineStory, t(key) and relative require calls.",
  ].join('\n\n'),
  texts: [
    "story_text_edit manages languages, text entries, translations and metadata. This call adds a text entry to a catalog with en registered: {operations:[{kind:\"create-text\",key:\"greeting\",description:\"Opening greeting\"},{kind:\"set-translation\",key:\"greeting\",language:\"en\",text:\"Hello\"}]}.",
    "story_text_read({key:\"greeting\",language:\"en\"}) reads that language exactly. Omit language to read the complete entry. A missing result identifies an unregistered language, absent entry or absent translation. Empty text is a valid translation.",
    "add-language registers a language. set-default-language selects a registered language; read the current default with story_status before changing it in a session. delete-language removes a language and all its translations, using {kind:\"delete-language\",language:\"en\",expectedSequence:3}. Use the draft sequence returned by a read or edit. Deleting the default language requires choosing another in the same batch.",
    "set-description sets the usage description; null removes it. rename-text changes the key; update program references separately. set-metadata replaces the selected metadata object. Edits in a batch execute in order and save together.",
  ].join('\n\n'),
  history: [
    "story_history lists revision metadata. Use its revision IDs to read content with ref:{kind:\"revision\",revisionId:\"...\"} or compare it with story_diff. For paginated draft queries, use the returned ref and next cursor.",
    "story_commit({expectedSequence:2,description:\"Opening scene\"}) compiles the complete draft and saves an immutable revision with its results. Use the draft sequence returned by a read or edit. The description must contain non-whitespace text. Optional references records additional revision IDs from story_history as provenance. targets selects entry/language pairs; the default is story.js in the draft default language. Compilation failure prevents submission unless allowCompilationFailure:true is supplied. In that case a failed compilation saves the revision with no artifacts; successful compilation still saves all results. Frozen revisions cannot be compiled again; restore content to the draft before submitting a new revision.",
    "story_restore({expectedSequence:3,revisionId:\"...\",selection:{kind:\"file\",path:\"story.js\"}}) replaces the selected draft content. Selection supports all, program, catalog, file and text. Full restoration updates the draft origin; partial restoration preserves it.",
  ].join('\n\n'),
  compilation: [
    "story_compile({ref:{kind:\"draft\",sequence:2},entry:\"story.js\",language:\"en\"}) compiles that draft snapshot and saves the result. Use the draft sequence returned by a read or edit. The entry defaults to story.js, and language defaults to the script default.",
    "Use synchronous CommonJS. require accepts @papermoon/story or explicit relative .js paths, such as require(\"./parts/context.js\"). Each referenced module is evaluated once. Circular references are rejected.",
    "Export the declaration through module.exports. It accepts systemPrompt, systemPromptName and messages. systemPrompt is a required string; messages is a required array. Each message contains role (user or assistant), content (string) and optional name (string). systemPromptName is an optional string. Empty strings and repeated roles are valid. Names label preview entries; model context consists of systemPrompt and message role/content.",
    "Example: const {defineStory,t}=require(\"@papermoon/story\"); module.exports=defineStory({systemPrompt:t(\"opening.system\"),messages:[{name:\"Opening\",role:\"assistant\",content:t(\"opening.narration\")}]}); Store both text keys in the selected language with story_text_edit. t(key) reads that language only and returns the complete text. Missing entries or translations produce diagnostics.",
    "The result includes source identity and diagnostics. Success also returns the saved artifact ID and starting context. Program diagnostics locate files and declaration fields; text diagnostics identify the key and language.",
  ].join('\n\n'),
}
const descriptions: Record<ToolName, string> = {
  story_compile: "Compile a draft into a saved starting context.",
  story_status: "Read draft status, languages and content counts.",
  story_program_list: "List program file paths and metadata.",
  story_program_read: "Read a program file with its complete source and metadata.",
  story_program_search: "Search program files for literal text.",
  story_program_edit: "Apply program file and metadata edits as one batch.",
  story_text_list: "List text entries or entries missing a specified translation.",
  story_text_read: "Read a complete text entry or one language's translation.",
  story_text_search: "Search text keys, usage descriptions and translations.",
  story_text_edit: "Apply language, text entry, translation and metadata edits as one batch.",
  story_history: "List revisions or read one revision's metadata.",
  story_commit: "Compile the draft and save an immutable revision with its results.",
  story_diff: "Compare program, text and metadata changes between two content snapshots.",
  story_restore: "Replace selected draft content with content from a revision.",
  story_help: "Read script API and tool usage by topic.",
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
