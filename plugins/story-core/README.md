# Script logic core

English | [中文](README.zh.md)

This package defines authored programs and multilingual text, transforms content snapshots, and adapts business operations to [script storage](../story-storage/README.md). It exposes internal TypeScript APIs and a loadable Cordis service. The [manual editor](../story-editor/README.md) mounts it through the PaperMoon profile overlay; original Web does not.

## Responsibilities and entries

`@papermoon/story-core` exports the [content model](src/model.ts), constructors, pure edits, queries, restoration and KV encoding. This entry loads no SQLite, filesystem or Cordis code. Readonly data types describe snapshots; edits return detached candidates without modifying inputs or claiming a persisted sequence. Returned collections must be treated as readonly.

`@papermoon/story-core/repository` exports [StoryRepository](src/repository.ts), which receives an existing StoryStorage. It reads and validates content, applies business changes, and calls atomic storage operations. It keeps no authoritative memory cache and owns no connection. The shared JSON value encoder comes from `@papermoon/story-storage/value`, a pure entry with the same serialization rules as storage.

`@papermoon/story-core/plugin` registers papermoonStoryCore and declares papermoonStoryStorage as a dependency. Cordis waits for that provider before mounting the core. Removing the provider unregisters the core and drains dependent cleanup before storage closes. Removing only the core leaves storage open.

Compilation, artifact persistence, session permissions, model tools, approval and runtime selection belong to consumers or separate modules. A compiler can consume a fixed content snapshot and explicit configuration without accessing storage. This core does not evaluate source or interpolate text.

## Content and metadata

A project contains scripts. Each script has an independent draft and history directory; directory entries reference shared immutable revisions. A draft or revision body contains StoryContent: a format identity, content metadata, a program and a text catalog. Programs contain files. Text catalogs contain registered languages, a default language and text entries; each entry has an optional shared usage description and a map of translations.

Every entity has JSON object metadata, defaulting to an empty object when created. Content, program, file, catalog, language, entry and translation metadata travel with authored content and freeze in revisions. Project, script and draft management metadata remain on their owners. Revision, directory-entry and publication metadata are specified at creation and have no update API. Metadata updates replace the whole object; they do not merge nested values.

Draft management metadata uses the draft sequence and can change atomically with content. Committing does not turn it into revision metadata. Restoring authored content preserves it. Project/script management updates do not advance the draft sequence. Copying a current draft copies its management metadata; copying a revision starts with empty draft management metadata. Both accept an explicit override. Copied directory entries retain their metadata while referencing the same revision bodies.

Programs use case-sensitive virtual relative paths with `/` separators. Absolute and drive paths, backslashes, empty components, `.`, `..` and NUL are rejected. A path cannot be both a file and a parent directory. Directories are derived from files; empty directories are not stored. Source may be empty or unfinished, and no extension or entry file is required. Renaming preserves file metadata and leaves source references untouched.

Language identifiers are exact, nonempty Unicode strings without NUL. They are not inferred from the host or normalized into language families. A catalog always contains its default language. Text keys use the same identifier rules and are unique within the catalog. Entries may have no translations; an empty string is a present translation. Descriptions are optional, shared across languages and may be empty. Removing a language removes its translations; a batch that removes the default must select another registered default.

lookupTranslation distinguishes missing language, entry and translation. It never falls back to the default language or another language. Changing the default does not fill missing text. Saving and committing allow incomplete translations. Literal template-like text is preserved; template grammar and runtime completeness checks belong to later consumers.

```ts
import { createContent, applyOperations, lookupTranslation } from './src/index.ts'

const content = applyOperations(createContent({ defaultLanguage: 'zh-CN' }), [
  { kind: 'create-file', path: 'entry.mjs', source: 't("welcome")' },
  { kind: 'add-language', language: 'en' },
  { kind: 'create-text', key: 'welcome', description: 'Opening greeting' },
  { kind: 'set-translation', key: 'welcome', language: 'zh-CN', text: '欢迎。' },
])
const translation = lookupTranslation(content, 'welcome', 'en')
if (translation.kind === 'missing') console.log(translation.reason)
```

The repository exposes queryScripts for filtered metadata catalogs, getHistoryEntry for exact membership, and ascending or descending listRevisions pages. These queries retain the [storage pagination rules](../story-storage/README.md#api-and-pagination).

## Editing and history

applyOperations runs typed ContentOperation values in order and checks cross-entity rules on the final content. Object creation rejects an existing identity; edits and deletion require the target to exist. Rename requires an existing source and an unused target, except that renaming to the same identity is allowed. Source references are not rewritten. set-translation preserves existing metadata when metadata is omitted and creates empty metadata for a new translation. set-description accepts null to remove the description. set-metadata replaces metadata at any authored entity.

StoryRepository.editDraft loads one complete snapshot, transforms it in memory, computes changed KV entries, then writes them with the expected sequence. The storage transaction rechecks that sequence. Only a successful write returns a new persisted snapshot. Every accepted save advances the sequence once, including empty or unchanged batches. Failures and conflicts save no partial content and do not trigger automatic retries or merging.

commitRevision requires a description that contains non-whitespace text and preserves its original text. It validates the content structure without compiling or requiring complete translations. The storage transaction copies the complete draft, appends a directory entry, updates the creation base and advances the draft sequence. Independent commits always create distinct revisions. metadata and historyMetadata describe the revision and its directory entry separately; references remain informational.

restoreDraft selects all content, the entire program, the entire catalog, one file or one text entry. Full restoration changes the draft’s base revision. Partial restoration leaves that base unchanged and preserves unrelated content. Restored objects include their metadata. Missing source objects fail instead of deleting the target. Restoring a text entry does not register missing languages; callers must register them explicitly first. Restoration neither removes history nor commits a revision.

copyScript retains storage’s explicit content, history and publication scopes. It validates the chosen content without compiling it and preserves database-side revision reuse. registerPublication records an existing script-directory membership and metadata; it has no compilation or approval prerequisite, and repeated registrations create independent records. Deletion and reference reclamation follow the storage API. Names need not be unique, and creating a project or script does not create sessions.

```ts
import type { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from './src/repository.ts'

export function author(storage: StoryStorage) {
  const stories = new StoryRepository(storage)
  const project = stories.createProject({ name: 'Example' })
  const script = stories.createScript({
    projectId: project.id, name: 'First direction', defaultLanguage: 'zh-CN',
  })
  const saved = stories.editDraft({
    scriptId: script.id, expectedSequence: 0,
    operations: [{ kind: 'create-file', path: 'entry.mjs', source: 'unfinished {' }],
  })
  return stories.commitRevision({
    scriptId: script.id, expectedSequence: saved.draft.sequence,
    description: 'Establish the first direction',
  })
}
```

## Reading, search and comparison

readSnapshot obtains owner attributes and content in one storage read transaction. Draft results carry the exact sequence; revision results carry the immutable revision identity. readFile, readText and readLanguage return the requested object and resolved source. List methods, listMissingTranslations, searchProgram and searchTexts return stable pages and resolved sources. These queries currently load one complete snapshot; editing writes only changed entries.

Pages default to 100 entries with a maximum of 1000. File, language and text pages use UTF-8 binary identity order. Pass the returned ref and next to later pages. Continuing a draft page without a sequence is rejected, as is any later read after the sequence changes. Metadata-only history lists retain storage’s ordinal order. Project, script and publication lists retain its ID ordering and unfrozen catalog semantics.

Search uses case-sensitive literal matching. Results group matches by file or text entry and identify the field, language and non-overlapping UTF-16 offsets in the original string. Text search defaults to key, description and translation fields; omitting language searches all translations, while providing it searches that exact registered language. Empty queries are rejected. Consumers own excerpting and highlighting.

compare loads headers and SQL-filtered changed records, rather than complete bodies. It supports all content or a settings, program, languages or texts scope. Each changed file, language, text entry or settings record occupies one result. Results contain before/after business objects and field paths, including description, translation and metadata changes. Added and removed objects carry their entire value. Metadata is compared as a whole; text line alignment, inferred renames and merges are not provided.

Comparison returns both resolved sources and an opaque next cursor tied to those sources and the scope. Reuse them for subsequent pages; changing either draft invalidates continuation. Revision descriptions, management metadata and publications are outside content comparison. SQL may scan all relevant entries and makes no changed-row-only cost guarantee.

## Format and failures

The business format is papermoon.story, version 1. Its KV encoding stores one content header, one record per program file, one per registered language and one per text entry. The header holds content/program/catalog metadata and the default language; each text record contains its description, metadata and all translations. Consumers use typed APIs instead of constructing these keys. Undeclared records, unknown fields, unsupported formats and broken content relationships fail decoding; missing data is not repaired. Metadata is the supported place for additional consumer data.

A newly created script receives its empty program, registered default language and content header atomically at draft sequence zero. The required storage format is 2; format 1 databases are rejected without migration, replacement or deletion. Changing the business value format does not inherently require changing SQL tables.

StoryError exposes invalid-input, invalid-content, not-found or already-exists plus a location. Storage errors, including conflict, busy, closed and format-mismatch, retain their original identity. Missing-translation results are ordinary query outcomes. Errors carry no UI localization or compiler diagnosis.

## Build and verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:docs` and `pnpm check:notes` from the root without DSH. `pnpm build:plugins` builds storage before the core. `pnpm check:plugins:pure` exercises the emitted pure entry with Node built-ins and Cordis imports blocked. `pnpm check:plugins:dsh` additionally requires built DSH Cordis and verifies real dependency waiting, consumer cleanup and remounting. Tests use temporary databases and do not start Web or call a model.

The [core decision](../../.agents/notes/implemented/architecture/2026-09-12-script-core.md) records the responsibilities and alternatives. [Development](../../docs/development.md) owns root commands.
