# Script tools

English | [中文](README.zh.md)

## Purpose

`@papermoon/story-tools` wraps the [logic core](../story-core/README.md) for model-facing interfaces. `createStoryTools(repository, scriptId)` creates an executable tool set bound to one script. `toolCatalog()` exposes the same names, descriptions, parameter declarations, result declarations and read/write classification used by registration. Neither API creates a Session or calls a model.

## Tools

| Group | Tools | Operations |
|---|---|---|
| State | `story_status` | Script and draft identities, sequence, languages and counts |
| Program | `story_program_list`, `story_program_read`, `story_program_search`, `story_program_edit` | File discovery, exact source reading, literal search and atomic program edits |
| Text | `story_text_list`, `story_text_read`, `story_text_search`, `story_text_edit` | Entry discovery, exact-language reads, search, languages, descriptions, translations and metadata |
| History | `story_history`, `story_commit`, `story_diff`, `story_restore` | Metadata, immutable revisions, business-value differences and content restoration |
| Compilation | `story_compile` | Fixed draft, saved artifact, context and diagnostics |
| Help | `story_help` | Usage, failure conditions and small examples by topic |

Program and text mutations use separate operation lists. Neither accepts a batch `expectedSequence`. Session tools check the affected objects against their read observations, so separate files or translations can be edited without refreshing the complete draft sequence. A failed object check or invalid operation saves nothing. Program `replace-text` requires nonempty `oldText` matching exactly once, including overlapping matches. It preserves the surrounding source, including line endings. Final structural validation applies to the complete batch. A successful write returns its new sequence and affected objects, without echoing all source text.

Text reads distinguish missing language, entry and translation. An empty translation is present; no language fallback occurs. A `delete-language` operation requires its own `expectedSequence` because it deletes every translation in that language; a stale sequence rejects the entire batch. Deleting the default language requires choosing another in the same batch. Session changes to the default language require its observed value from `story_status`. Metadata replacements follow the core's rules.

Reads default to the bound script's draft. Revision references must belong to its retained directory, including references used for comparison, restoration and commit provenance. List results omit source bodies; specific reads return requested content. Pagination uses the core's default 100 and maximum 1000 entries. Draft continuation requires the observed sequence. Differences contain business values, not line diffs or inferred renames. Commits and restoration still require a complete-draft `expectedSequence`. Commits save the complete draft content and require nonblank descriptions supplied by the caller. Optional `references` contains additional revision IDs from `story_history`, not file paths or a content selection. Omitting it preserves the complete snapshot and automatic draft origin. Missing revision errors identify the parameter, array index where applicable, and supplied ID. Commits compile before saving; they do not publish or approve content.

## DSH integration

`/plugin` exports `registerStoryTools(scope, repository, scriptId)`. The caller supplies an isolated DSH scope and owns its lifecycle. Registrations are effects and also return a disposer. Read-only tools opt into DSH's concurrent scheduling; mutations run exclusively within each Agent, without locking the script across sessions. Arguments are validated against the catalog schemas; output is canonical JSON rendered as text by DSH. Cancellation before execution does not mutate data; synchronous repository operations finish at their transaction commit point.

Names, descriptions and parameter schemas come from the registered catalog. The default `story_help` overview describes the draft, program/text relationship, CommonJS entry and topic directory. Descriptions, parameter and result explanations, and help follow the [tool writing standard](../../docs/development.md#tool-writing). Program help includes a compilable entry example; compilation help owns the declaration and loading rules. Help text enters model history only as the result of a `story_help` call; registration does not append it to writer prompts.

The default Web profile does not register these tools globally. The writer management page reads only the catalog and has no execution endpoint. There is no second execution loop, repository-summary injection, host filesystem tool or project-management tool.

## Verification

Run `pnpm exec vitest run plugins/story-tools/tests` for deterministic temporary-database cases. After `pnpm build:plugins`, `pnpm check:plugins:dsh` checks actual Cordis registration, schemas, execution, independent scopes, cancellation, output rejection and cleanup. Main unit tests do not require DSH. The [decision](../../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.md) records these choices.

## Session observations

The tool factory accepts optional `StoryObservations` for explicitly returned draft objects, including a requested translation's absence. Existing files require complete-file observations; translations use their own language scope. Whole-entry changes require a complete entry read. Status reads observe program/catalog metadata, languages and the default language. The session plugin supplies these observations; internal callers that omit them retain unguarded object editing.

Each local edit reads the latest complete snapshot, checks the original observations and computes its changes. The core and storage still require that snapshot's sequence. Only a rejected storage sequence check can repeat this calculation, for at most three attempts; exhausted attempts report `write-contention`. Object conflicts, invalid content, database errors and busy connections are not retried. Cancellation is checked before each attempt and before saving. No business callback runs inside a database transaction.

After commit, the returned snapshot supplies both the receipt sequence and the updated observations. A later write cannot relabel that snapshot or grant authority over unseen content. Internal reads do not refresh observations of other objects. Failed edits leave observations unchanged. Restoration clears its affected observations; language deletion clears text observations. The caller discards them when its Agent unloads; storage does not persist them. The [concurrency decision](../../.agents/notes/implemented/architecture/2026-09-13-object-scoped-edits.md) explains the transaction and snapshot rules.

## Compilation service

Pass an optional CompilationService as the fourth argument to createStoryTools, or the fifth argument to registerStoryTools. The full management catalog includes story_compile, but executable registration includes it only when its service is supplied. The PaperMoon profile supplies it explicitly. This read-only source operation awaits compilation and persistence, honors cancellation and leaves observations unchanged. It requires an explicit draft sequence. Complete context and diagnostics enter the normal tool result; no compiler instructions are injected into prompts. See the [script API](../story-compiler/api.md).

story_commit uses [submission compilation](../story-compiler/README.md#submission-and-frozen-revisions), returning committed, compilation diagnostics and frozen attachment summaries. It accepts targets and allowCompilationFailure; the default requires success. story_compile checks drafts only. Neither operation grants file observations. Both tools require the compilation service and are absent from executable sets without it. Model-facing history and restoration remain limited to the bound script; manual reference selection may cite other retained revisions.
