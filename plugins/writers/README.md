# Writer management

English | [中文](README.zh.md)

## Purpose

`@papermoon/writers` maintains writer definitions and their initial context. The management page opens above Settings in the sidebar. It supports creation, search, renaming, duplication, deletion and explicit saves. Prompt edits remain in memory across panel changes; leaving with edits offers save, discard or cancel, and refresh warns before discarding them. Concurrent changes reject stale saves and retain local text.

The page has Prompts, Tools and Settings tabs. Prompts owns the system text and initial sequence that form the configurable part of model `messages`; Tools owns tool declarations, corresponding to the request's separate `tools` field. Tools is read-only in this version. The catalog also shows result declarations and execution properties for reference; these are not additional prompt messages or native tool-parameter fields.

Settings contains the writer name, description, duplication and deletion. Prompts opens as a trajectory-style table of numbered roles and content summaries; selecting a row shows its complete literal text. Edit replaces that preview with the form and message actions, and Exit editing restores the preview. Edit and Save belong to the active tab. Leaving a tab or exiting editing with unsaved changes offers save, discard and cancel. Settings fields stack vertically.

Edit mode is not restored after a page reload or writer change. If browser preference storage is unavailable, navigation and server saves still work; only remembering the page position is unavailable.

A definition contains a stable ID, name, optional description, system prompt, ordered initial messages and JSON metadata. The system prompt and each initial message can have an optional name. Each message has an ID, a `user` or `assistant` role and literal text. Role options explain whether the text provides instructions to the model or represents a reply in its history. Repeated roles, empty text and original line breaks are preserved. The UI edits prompts and descriptions; metadata is available through the internal API and retained by UI saves.

## Context and creation template

`resolveWriterContext` returns detached system text and ordered role/content messages. Prompt names label the editor and preview without entering this result. It does not interpolate variables, add DSH guidance or combine messages into one user message. The page uses the same function for its read-only preview; this is initial context, not a captured model request.

Initialization leaves the writer list empty. New writers use a template whose sole prompt is `你是 PaperMoon 的编剧助手。` and whose initial sequence is empty. The template has no stored identity; every created writer can be edited or deleted. New and Duplicate open a dialog where the name and description can be changed before confirmation. Cancelling creates no record. Duplication preserves the source prompts and copies the chosen name and description into an independent definition. Every writer displays the same [built-in tools](../playbook-tools/README.md). Tool selection is not configurable. [Writer sessions](../writer-sessions/README.md) own model conversations and use a frozen copy of these settings.

## Interfaces and persistence

The main package entry exports definitions and context resolution without loading SQLite. `/repository` exports `WriterRepository`; `/plugin` mounts the `papermoonWriters` service and authenticated management routes. The API supports list, get, create, update, copy, delete, context and catalog. Update and delete require the observed sequence; each successful update increments it. Update replaces the complete definition, so omitted optional names or descriptions are removed while identity and creation time remain fixed. Reads and writes both report database contention as `busy`. Duplication assigns new writer and message IDs.

The plugin's required `path` selects its SQLite file. The PaperMoon profile uses `writers.sqlite` in the product data directory. The repository owns one connection, short write transactions, `DELETE` journaling and `EXTRA` synchronization. The repository validates its independent application ID, declared schema and stored definitions. User settings do not enter playbook content, revision history or DSH preset files. Plugin disposal unregisters routes and drains dependent services before closing the database.

## Verification

Run `pnpm typecheck`, `pnpm exec vitest run plugins/writers/tests`, `pnpm build:plugins` and `pnpm check:plugins:dsh`. `pnpm test:editor writers.spec.ts` exercises the actual management page with temporary runtime data and no model calls. The [decision](../../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.md) records the ownership and scope choices.
