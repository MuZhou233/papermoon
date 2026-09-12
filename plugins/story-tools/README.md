# Script tools

English | [中文](README.zh.md)

## Purpose

`@papermoon/story-tools` wraps the [logic core](../story-core/README.md) for future model-facing interfaces. `createStoryTools(repository, scriptId)` creates an executable tool set bound to one script. `toolCatalog()` exposes the same names, descriptions, parameter declarations, result declarations and read/write classification used by registration. Neither API creates a Session or calls a model.

## Tools

| Group | Tools | Operations |
|---|---|---|
| State | `story_status` | Script and draft identities, sequence, languages and counts |
| Program | `story_program_list`, `story_program_read`, `story_program_search`, `story_program_edit` | File discovery, exact source reading, literal search and atomic program edits |
| Text | `story_text_list`, `story_text_read`, `story_text_search`, `story_text_edit` | Entry discovery, exact-language reads, search, languages, descriptions, translations and metadata |
| History | `story_history`, `story_commit`, `story_diff`, `story_restore` | Metadata, immutable revisions, business-value differences and content restoration |
| Help | `story_help` | Usage, failure conditions and small examples by topic |

Program and text mutations use separate operation lists. Both require `expectedSequence`; a failed operation or stale sequence saves nothing. Program `replace-text` requires nonempty `oldText` matching exactly once, including overlapping matches. It preserves the surrounding source, including line endings. Final structural validation applies to the complete batch. A successful write returns its new sequence and affected objects, without echoing all source text.

Text reads distinguish missing language, entry and translation. An empty translation is present; no language fallback occurs. Deleting the default language requires choosing another in the same batch. Metadata replacements follow the core's rules.

Reads default to the bound script's draft. Revision references must belong to its retained directory, including references used for comparison, restoration and commit provenance. List results omit source bodies; specific reads return requested content. Pagination uses the core's default 100 and maximum 1000 entries. Draft continuation requires the observed sequence. Differences contain business values, not line diffs or inferred renames. Commits require nonblank descriptions and do not compile, publish or approve content.

## DSH integration

`/plugin` exports `registerStoryTools(scope, repository, scriptId)`. The caller supplies an isolated DSH scope and owns its lifecycle. Registrations are effects and also return a disposer. Read-only tools opt into DSH's concurrent scheduling; mutations remain exclusive. Arguments are validated against the catalog schemas; output is canonical JSON rendered as text by DSH. Cancellation before execution does not mutate data; synchronous repository operations finish at their transaction commit point.

Names, descriptions and parameter schemas come from the registered catalog. Help text enters model history only as the result of a `story_help` call; registration does not append it to writer prompts.

The default Web profile does not register these tools globally. The writer management page reads only the catalog and has no execution endpoint. There is no second execution loop, automatic retry, repository-summary injection, file-read observation policy, host filesystem tool or project-management tool.

## Verification

Run `pnpm exec vitest run plugins/story-tools/tests` for deterministic temporary-database cases. After `pnpm build:plugins`, `pnpm check:plugins:dsh` checks actual Cordis registration, schemas, execution, independent scopes, cancellation, output rejection and cleanup. Main unit tests do not require DSH. The [decision](../../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.md) records these choices.
