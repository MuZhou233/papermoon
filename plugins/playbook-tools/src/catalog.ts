/** The same validated definitions drive discovery, execution and the management UI. */
import { z } from 'zod'
import { results, type ResultSchema } from './results.ts'
const object = z.strictObject,
  text = z.string(),
  sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const metadata = z.record(z.string(), z.unknown())
const expectedSequence = sequence.describe('Use the draft sequence returned by a read or edit. The operation fails if the draft has changed.')
const revisionId = text.describe('Use a revision ID from this playbook\'s playbook_history.')
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
  playbook_simulate: object({
    calls: z.array(object({ name: text, args: z.record(z.string(), z.unknown()) })),
    entry: text.optional().describe('Select the CommonJS entry file. Defaults to playbook.js.'),
    language: text.optional().describe('Select a registered language. Defaults to the playbook default language.'),
  }),
  playbook_compile: object({
    ref: object({ kind: z.literal('draft'), sequence: sequence.describe('Use the sequence of the draft snapshot to compile.') }),
    entry: text.optional().describe('Select the CommonJS entry file. Defaults to playbook.js.'),
    language: text.optional().describe('Select a registered language. Defaults to the playbook\'s default language.'),
  }),
  playbook_status: object({}),
  playbook_program_list: object({ ref: ref.optional(), ...page }),
  playbook_program_read: object({ ref: ref.optional(), path: text }),
  playbook_program_search: object({ ref: ref.optional(), query: text, ...page }),
  playbook_program_edit: object({
    operations: z.array(programOperation),
  }),
  playbook_text_list: object({
    ref: ref.optional(),
    ...page,
    missingLanguage: text.optional().describe('List entries missing a translation in this registered language.'),
  }),
  playbook_text_read: object({
    ref: ref.optional(),
    key: text,
    language: text.optional().describe('Read this language\'s translation. Omit to read the complete entry.'),
  }),
  playbook_text_search: object({
    ref: ref.optional(),
    query: text,
    language: text.optional().describe('Select an exact registered language.'),
    fields: z.array(z.enum(['key', 'description', 'translation'])).optional(),
    ...page,
  }),
  playbook_text_edit: object({
    operations: z.array(textOperation),
  }),
  playbook_history: object({
    after: sequence.optional().describe('Continue after this revision ordinal, using the previous result\'s next cursor.'),
    limit: page.limit,
    revisionId: revisionId.optional(),
  }),
  playbook_commit: object({
    expectedSequence,
    description: text.refine((value) => !!value.trim()).describe('Describe the revision. The description must contain non-whitespace text.'),
    metadata: metadata.optional(),
    entryMetadata: metadata.optional(),
    targets: z.array(object({ entry: text.optional(), language: text.optional() })).min(1).optional().describe('Compile these targets in order. Defaults to playbook.js in the draft default language. The first target is the default for performance.'),
    allowCompilationFailure: z.boolean().optional().describe('Allow a revision without artifacts when playbook compilation fails. Defaults to false. Successful compilation always attaches all results.'),
    references: z.array(revisionId).optional().describe('Record additional revision IDs as references for this revision.'),
  }),
  playbook_diff: object({
    left: ref,
    right: ref,
    scope: z
      .enum(['all', 'settings', 'program', 'languages', 'texts'])
      .optional(),
    ...page,
  }),
  playbook_restore: object({
    expectedSequence,
    revisionId,
    selection,
  }),
  playbook_help: object({
    topic: z.enum(['overview', 'program', 'texts', 'history', 'compilation', 'functions', 'context']).optional().describe('Select a help topic. Defaults to overview.'),
  }),
}
export type ToolName = keyof typeof schemas
export const help = {
  context: [
    "composeContext({opening,history,input,state}) returns {systemPrompt,messages}. It runs once per admitted player input, including rerolls and edited input. Tool continuations append actual execution messages without rerunning it. System text stays at the head; messages may be original references {ref:id} or custom {role: user|assistant, name?, content}. An assistant prompt is an ordinary message, not a provider completion prefix.",
    "opening includes systemPrompt and opening message ids, roles and names. history is the selected worldline's ordered node directory with id, outcome and blocks; blocks expose ids and roles, not bodies. input contains the current id and original content blocks. state is the readonly state restored from the parent node. No historical message bodies, I/O, clocks or random source are available.",
    "Reference the current input exactly once. Each opening or historical block can be referenced at most once, only from this ancestry. A model response and all its tool calls/results are one indivisible block. Names and ids do not enter message text. Custom messages cannot contain forged tools. Invalid plans stop the request; they do not fall back to full history.",
    "Example member of the exported declaration: composeContext({opening,history,input}) { return {systemPrompt:opening.systemPrompt,messages:[...opening.messages.map(m=>({ref:m.id})),...history.slice(-8).flatMap(n=>n.blocks.map(b=>({ref:b.id}))),{ref:input.id},{role:'assistant',content:'Continue the scene.'}]}; }. The window size is playbook logic. Without this member, context contains the opening, all current-worldline history and the current input.",
  ].join('\n\n'),
  functions: [
    "Declare state:{initial,schema} and functions:[factory]. Each factory receives {state} and returns an ordinary named function. Factories cannot modify state. Only the returned function becomes a tool; its name is unchanged.",
    "Add one JSDoc description, an explicit @param type for each named parameter and an explicit @returns JSON type. Optional parameters and JavaScript defaults are supported. Basic JSON types, arrays, declared object fields, literal unions and same-file nonrecursive @typedef declarations are supported, including consecutive typedef blocks with @property tags. String-key dictionaries use Record<string, T>, Object<string, T> or {[key:string]: T}, with an explicit JSON value type. Bare object, rest/destructured parameters, other generics, recursive types and external imports are not supported.",
    "A normal return commits the candidate state after validation and delivers the original value. An exception discards all changes. Fields such as status or rejected are ordinary data; the platform does not interpret them. Query functions return selected state explicitly. No state is automatically appended to tool results.",
    "This complete program exposes a numeric tool: function factory({state}) {\n/** Read the stored value.\n * @returns {number} Stored value.\n */\nreturn function readValue() { return state.value; };\n}\nmodule.exports={systemPrompt:\"\",messages:[],state:{initial:{value:0},schema:{type:\"object\",properties:{value:{type:\"number\"}},required:[\"value\"],additionalProperties:false}},functions:[factory]};",
    "playbook_simulate({calls:[{name:\"readValue\",args:{}}]}) compiles the current draft snapshot and calls the functions in order on temporary state. Results include the snapshot identity, original values, errors and state changes. The draft and real performances are not changed. Exceptions preserve the prior simulated state and later calls continue; cancellation or service failure stops the simulation.",
    "Each call constructs a fresh closure from frozen modules. Only state persists across calls. t(key) reads frozen text in the selected language; missing text fails without a language fallback. Functions cannot access host files, network, asynchronous work, clocks or randomness.",
  ].join('\n\n'),
  overview: [
    "The bound playbook contains a mutable draft and immutable revisions. Its draft stores program files and a multilingual text catalog.",
    "Program tools list, read, search and edit virtual files. Text tools manage languages, entries and translations. playbook_status reports draft status. playbook_commit compiles and saves a complete revision, playbook_history lists revisions, playbook_diff compares content, and playbook_restore restores selected content. playbook_compile checks and saves a compiled artifact; playbook_simulate executes declared functions on temporary state.",
    "Programs use CommonJS. The default entry playbook.js exports a declaration through module.exports, with systemPrompt and an ordered messages array. require(\"@papermoon/playbook\") provides definePlaybook and t(key), which reads text in the selected language.",
    "Select a playbook_help topic for details: program covers files and a compilable entry; texts covers languages and translations; history covers revisions, comparisons and restoration; compilation covers the declaration and module API; functions covers closures, JSDoc and simulation; context covers per-input context assembly.",
  ].join('\n\n'),
  program: [
    "playbook_program_read({path:\"playbook.js\"}) reads the complete file. Paths are relative virtual paths with / separators. create-file requires an unused path; replace-file replaces the complete source. replace-text requires a nonempty oldText with exactly one literal match. Edits in a batch execute in order and save together.",
    "This call creates a minimal CommonJS entry when playbook.js is absent:",
    "```json\n{\n  \"operations\": [\n    {\n      \"kind\": \"create-file\",\n      \"path\": \"playbook.js\",\n      \"source\": \"const { definePlaybook } = require(\\\"@papermoon/playbook\\\");\\nmodule.exports = definePlaybook({ systemPrompt: \\\"\\\", messages: [] });\"\n    }\n  ]\n}\n```",
    "rename-file moves the file to the supplied path. Update references to the old path separately. set-metadata replaces the selected metadata object. The compilation topic describes definePlaybook, t(key) and relative require calls.",
  ].join('\n\n'),
  texts: [
    "playbook_text_edit manages languages, text entries, translations and metadata. This call adds a text entry to a catalog with en registered: {operations:[{kind:\"create-text\",key:\"greeting\",description:\"Opening greeting\"},{kind:\"set-translation\",key:\"greeting\",language:\"en\",text:\"Hello\"}]}.",
    "playbook_text_read({key:\"greeting\",language:\"en\"}) reads that language exactly. Omit language to read the complete entry. A missing result identifies an unregistered language, absent entry or absent translation. Empty text is a valid translation.",
    "add-language registers a language. set-default-language selects a registered language; read the current default with playbook_status before changing it in a session. delete-language removes a language and all its translations, using {kind:\"delete-language\",language:\"en\",expectedSequence:3}. Use the draft sequence returned by a read or edit. Deleting the default language requires choosing another in the same batch.",
    "set-description sets the usage description; null removes it. rename-text changes the key; update program references separately. set-metadata replaces the selected metadata object. Edits in a batch execute in order and save together.",
  ].join('\n\n'),
  history: [
    "playbook_history lists revision metadata. Use its revision IDs to read content with ref:{kind:\"revision\",revisionId:\"...\"} or compare it with playbook_diff. For paginated draft queries, use the returned ref and next cursor.",
    "playbook_commit({expectedSequence:2,description:\"Opening scene\"}) compiles the complete draft and saves an immutable revision with its results. Use the draft sequence returned by a read or edit. The description must contain non-whitespace text. Optional references records additional revision IDs from playbook_history as provenance. targets selects entry/language pairs; the default is playbook.js in the draft default language. Compilation failure prevents submission unless allowCompilationFailure:true is supplied. In that case a failed compilation saves the revision with no artifacts; successful compilation still saves all results. Frozen revisions cannot be compiled again; restore content to the draft before submitting a new revision.",
    "playbook_restore({expectedSequence:3,revisionId:\"...\",selection:{kind:\"file\",path:\"playbook.js\"}}) replaces the selected draft content. Selection supports all, program, catalog, file and text. Full restoration updates the draft origin; partial restoration preserves it.",
  ].join('\n\n'),
  compilation: [
    "playbook_compile({ref:{kind:\"draft\",sequence:2},entry:\"playbook.js\",language:\"en\"}) compiles that draft snapshot and saves the result. Use the draft sequence returned by a read or edit. The entry defaults to playbook.js, and language defaults to the playbook default.",
    "Use synchronous CommonJS. require accepts @papermoon/playbook or explicit relative .js paths, such as require(\"./parts/context.js\"). Each referenced module is evaluated once. Circular references are rejected.",
    "Export the declaration through module.exports. It accepts systemPrompt, systemPromptName, messages, optional state:{initial,schema} optional functions:[factory] and optional composeContext. The functions topic describes factory signatures, JSDoc and state changes. systemPrompt is a required string; messages is a required array. Each message contains role (user or assistant), content (string) and optional name (string). systemPromptName is an optional string. Empty strings and repeated roles are valid. Names label preview entries; model context consists of systemPrompt and message role/content.",
    "Example: const {definePlaybook,t}=require(\"@papermoon/playbook\"); module.exports=definePlaybook({systemPrompt:t(\"opening.system\"),messages:[{name:\"Opening\",role:\"assistant\",content:t(\"opening.narration\")}]}); Store both text keys in the selected language with playbook_text_edit. t(key) reads that language only and returns the complete text. Missing entries or translations produce diagnostics.",
    "The result includes source identity and diagnostics. Success also returns the saved artifact ID, starting context, initial state and function declarations. Program diagnostics locate files and declaration fields; text diagnostics identify the key and language.",
  ].join('\n\n'),
} satisfies Record<NonNullable<z.infer<typeof schemas.playbook_help>['topic']>, string>
const descriptions: Record<ToolName, string> = {
  playbook_simulate: 'Compile the current draft and call its functions in order on temporary state.',
  playbook_compile: "Compile a draft into a saved playbook artifact.",
  playbook_status: "Read draft status, languages and content counts.",
  playbook_program_list: "List program file paths and metadata.",
  playbook_program_read: "Read a program file with its complete source and metadata.",
  playbook_program_search: "Search program files for literal text.",
  playbook_program_edit: "Apply program file and metadata edits as one batch.",
  playbook_text_list: "List text entries or entries missing a specified translation.",
  playbook_text_read: "Read a complete text entry or one language's translation.",
  playbook_text_search: "Search text keys, usage descriptions and translations.",
  playbook_text_edit: "Apply language, text entry, translation and metadata edits as one batch.",
  playbook_history: "List revisions or read one revision's metadata.",
  playbook_commit: "Compile the draft and save an immutable revision with its results.",
  playbook_diff: "Compare program, text and metadata changes between two content snapshots.",
  playbook_restore: "Replace selected draft content with content from a revision.",
  playbook_help: "Read playbook API and tool usage by topic.",
}
const writes = new Set<ToolName>([
  'playbook_program_edit',
  'playbook_text_edit',
  'playbook_commit',
  'playbook_restore',
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
