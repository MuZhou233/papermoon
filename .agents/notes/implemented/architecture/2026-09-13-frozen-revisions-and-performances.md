# Agent Note: Frozen revisions and text performances

Status: implemented

English | [中文](2026-09-13-frozen-revisions-and-performances.zh.md)

## Problem

A historical version cannot be authoritative if its executable result can be appended or replaced later. Recompilation at launch can also change behavior when compiler rules change. Mutable draft checks serve editing, while a performance needs a complete retained input.

## Decision

The [submission service](../../../../plugins/playbook-compiler/README.md) compiles a pinned draft before one SQLite revision transaction. It requires success by default; explicit permission allows playbook errors to produce a source-only revision. Multiple targets attach all results or none. Operational failures always abort. The final sequence check rejects intervening edits without recompiling or retrying.

Storage owns generic immutable attachment bodies and ordered manifests. Copying history shares their revision identity; the last directory deletion reclaims them. The core does not interpret compilation. A separate artifact reader and runtime start [performances](../../../../plugins/performances/README.md), whose logs retain full artifacts and provenance. Start, resume and Fork never compile. Source deletion does not invalidate a retained session.

This extends the [CommonJS decision](2026-09-13-commonjs-opening-compiler.md): independent file artifacts now serve draft checks, while revision attachments are authoritative history. Its module syntax, frozen text runtime and execution isolation remain in effect. The [manual editor](2026-09-12-manual-playbook-editor.md) keeps free draft editing; submission and historical preview follow this decision.

DSH Session configuration can carry producer-owned presentation fields separately from model input. Initialization makes the Session visible without a turn; a label describes its purpose and explicit display text contributes to search. The list cache has its own version. Search combines current user, assistant and authored context with a separate query for log-only configuration display text, retaining visibility rules and the shared result limit. SQLite extraction uses derived schema 9 without rewriting canonical Session data.

## Alternatives considered

A synthetic user message or model turn would misstate authorship and usage. Indexing arbitrary configuration would expose implementation strings. Including all log-only messages would expose shadowed content. Product-specific conditions in the Session Controller would couple DSH to each application.

Attaching a selected cache ID would allow submission without compiling the submitted snapshot. Compiling on launch or supplementing a committed revision would make historical behavior depend on later mutable state. A second compilation database would split the source and artifact commit. Making incomplete drafts uneditable would prevent normal authoring. Requiring approval would add an unrelated workflow policy.

## Consequences

Initializing plugins own their display text and separately declare actual model input. Generic plugins without presentation fields retain ordinary list and search behavior. Event validation, list, search, SDK and browser checks cover the presentation additions; no Agent Loop stage or released Session generation changes.

Revision bodies and artifacts commit atomically; preview cache files may be cleaned independently. Failed compilation can be preserved only through explicit source-only submission, and that version cannot start a performance. Initialized sessions retain their source names and complete artifacts even when source data disappears.

Deterministic unit and actual DSH browser checks cover transaction rollback, source conflicts, artifact corruption, exact initial roles, opening-only display, Fork and source deletion. Engineering evidence does not replace user feedback about authoring or narrative quality.
