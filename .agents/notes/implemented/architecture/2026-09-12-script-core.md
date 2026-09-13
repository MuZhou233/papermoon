# Agent Note: Authored-content core and persistence adaptation

Status: implemented

English | [中文](2026-09-12-script-core.zh.md)

## Problem

Program and multilingual-text editing need common rules across future model tools and user interfaces. Storing their conventions directly in SQL would make frequent authoring changes affect the persistence module. Putting the rules in individual tools or editors would duplicate validation and allow different interpretations of the same revision.

## Decision

The [logic core](../../../../plugins/story-core/README.md) defines readonly authored-content snapshots, pure operations and a versioned business KV encoding. A separate repository entry composes these rules with the [storage API](../../../../plugins/story-storage/README.md). A thin Cordis consumer registers the repository service. The pure entry loads no Node built-ins or Cordis; the repository owns no connection or authoritative memory cache. Compiler and model/user interfaces are separate consumers, with no approval or compilation prerequisite built into publication registration.

Programs are virtual files; text entries own usage descriptions and exact-language translations. Each authored entity has JSON object metadata that travels with its content. Management metadata stays with the project, script or draft. Revision and directory metadata are explicit immutable submission data. Translation lookup reports absence without per-key fallback, allowing consumers to identify incomplete translations rather than silently combine languages. Drafts and revisions may contain unfinished source or incomplete translations.

One KV row holds the content header, with separate rows for each file, registered language and text entry. Text translations remain inside their entry’s JSON value. The core owns those key conventions, format validation and grouped business differences. SQL filters equal values and pages changed records; the core does not load complete bodies merely to compare them. Text line alignment remains a presentation concern.

A business edit validates one candidate in memory and saves changed entries through a sequence-checked transaction. A failed write never publishes the candidate as saved. Full restoration changes the draft’s creation base; partial restoration edits selected content without claiming a new whole-document origin. The [storage ownership decision](2026-09-12-script-storage.md) continues to govern shared revisions and reference reclamation. Generic storage extensions add owner metadata, atomic initial values and owner/content snapshot reads without interpreting business records.

## Alternatives considered

A database-aware entity model could hide reads and writes in entity methods, but that would obscure which changes are merely candidates and which have committed. A long-lived memory mirror would need another concurrency and synchronization mechanism. Explicit snapshots and a small persistence adapter retain the current database authority.

A separate abstract repository registry or package for every responsibility would add interfaces before there are independent implementations. Pure, repository and plugin entries separate imports and lifecycle while keeping this cohesive feature in one package. Shared identifier types and the pure JSON encoder reuse the existing storage vocabulary without importing its database implementation into the pure entry.

Embedding texts freely in source would leave program and copy editing without a shared data interface. Requiring every program string to reference a text key would add source analysis and constrain the script language. An explicit text catalog provides targeted copy operations while leaving source validation and authoring guidance to their owners.

Per-key fallback could produce an apparently complete result containing several languages. Exact-language reads make missing content observable, while an upper layer can still choose one language for a whole operation. A full-catalog KV value would simplify encoding but require rewriting every entry for a small copy edit. One row per text entry keeps its translations and metadata together without imposing a language-specific SQL schema.

## Consequences

New scripts are structurally valid before source exists. Business revision submission requires a nonblank description, while the generic storage API retains its less restrictive text field. Metadata and owner attributes are documented by their own modules; the core does not inherit session ownership, file-read observations, approval state or compiler artifacts.

The database format is 3 and rejects version 1 and 2 files without migration or deletion. Business content has its own papermoon.story version 1 identity. Later value-format changes need not change SQL tables. Tests cover pure content, transactional repository operations, built pure imports and real Cordis dependency teardown. The [manual editor](2026-09-12-manual-script-editor.md) mounts this service through product configuration; original Web and DSH source remain unchanged.
