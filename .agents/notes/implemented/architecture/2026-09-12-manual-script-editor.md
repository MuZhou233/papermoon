# Agent Note: Manual authoring through product-owned UI and host adapters

Status: implemented

English | [中文](2026-09-12-manual-script-editor.zh.md)

## Problem

Authored content needs a manual interface for program and multilingual-text editing, submission and history inspection. Binding the pages directly to DSH component sources would make product changes depend on the managed checkout. Treating editor buffers as persisted content would also obscure conflicts and successful saves.

## Decision

The [editor plugin](../../../../plugins/story-editor/README.md) owns browser pages and validated requests over DSH's authenticated carrier. Its thin adapters register slots and exact request routes. DSH's main panel and sidebar extension points support the pages without source patches. The [UI library](../../../../packages/ui/README.md) maintains selected attributed component copies and a CodeMirror binding; DSH provides theme variables and the shared React runtime.

The overview presents scripts directly, with projects as grouping and filtering. Detail pages separate editable drafts, immutable revisions and management settings. Saving, submission and restoration remain explicit operations over the logic core. The [compiler service](2026-09-13-commonjs-opening-compiler.md) owns explicit compilation and saved previews. The editor has no publication, approval or model workflow, and does not edit metadata.

A local editor holds a saved snapshot and ordered pending operations. Saves use the observed sequence and preserve input entered during the request. Independent IndexedDB backups prevent one window from overwriting another window's recovery data. Conflicts retain local content for comparison and explicit resolution. Storage remains authoritative; backup and navigation records do not become domain entities.

## Alternatives considered

Direct DSH component imports or re-exports would share implementation changes across repositories. Attributed copies cost maintenance but keep product UI independently editable. Replacing the DSH shell would duplicate navigation, themes and authentication already available through plugins. A generic editor-backend registry would add abstractions before there is a second editor implementation.

Monaco offers a broader code-development environment and language services. CodeMirror provides the required editing, readonly and comparison features with independently selected extensions. Plain multiline controls remain appropriate for translations. Compiler diagnostics can select editor positions without giving the editor ownership of source persistence.

An independent Connection RPC channel failed in real integration because its registration accessed a Host service outside the provider's injected scope. Exact routes on the existing authenticated carrier avoid that path without changing DSH or bypassing authentication. Both routes and request validation stay in the adapter.

## Consequences

Root startup now composes PaperMoon over the standard Web profile; a separate original-Web command remains available for comparison. The editor integration itself requires no DSH patches; [writer sessions](2026-09-12-writer-sessions.md) own the generic conversation extensions. Catalog filtering and descending history queries extend the generic repository API without changing the database or business-content formats. The [core decision](2026-09-12-script-core.md) continues to govern authored structures and revision semantics.

Main tests cover local editor state and request behavior without DSH. Browser integration uses temporary data, the actual plugin loader and authenticated routes, then stops its process. Engineering checks and user experience feedback remain separate evidence.
