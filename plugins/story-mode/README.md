# Story Mode plugin

English | [中文](README.zh.md)

Story Mode implements [Fogbound Earthshine](../../docs/story-mode/fogbound-earthshine/README.md), starting with the five sections of Your First Character. Each save is a Playbook with its own immutable storyline binding. The story entrance and the ordinary Playbook catalog share these saves. [Shared requirements](../../docs/story-mode/design.md) own product behavior; [chapter requirements](../../docs/story-mode/fogbound-earthshine/01/README.md) own the exact bilingual lesson and interface text.

## Ownership

The plugin supplies storyline content, stage policy and orchestration. `papermoonPlaybookCore` resolves capabilities for all consumers; `papermoonPerformances` owns model selection, execution and durable conversation records. The right sidebar supplies page and session surfaces, while [anchored guidance](../ui-guidance/README.md) points to real controls. The ordinary left navigation remains available.

The Playbook draft's protected `$managed` metadata holds the storyline binding, current section and step, completion state and performance session reference. Its registered policy opens messages in 1.2, system text in 1.3, model selection in 1.4 and performance in 1.5. Saving through the editor or writer satisfies the same content conditions. Sections 1.1–1.4 advance through explicit Continue. Chapter 1 keeps copy, restoration, mode switching, scripts and ordinary submission closed. Removing the policy provider pauses protected operations.

## Startup, submission and review

Startup creates an ordinary untagged revision from saved content and freezes its compilation and bilingual teaching. The reserved performance Session owns model and effort selection; the selection applies locally. Repeated starts reuse that Session and revision. Displaying the authored opening makes no model request.

The first durable completed model response containing body text qualifies the chapter. One storage transaction copies the startup version into a chapter revision, adds the unique `story/fogbound-earthshine/chapter/1` tag and advances protected progress. Later draft edits survive. A failed submission remains incomplete; retry uses the saved response. Duplicate events and requests return the same chapter result.

Read-only review loads the chapter's content and teaching plus the referenced worldline record ranges through the successful turn. Later conversation falls outside those ranges. Missing records display an error. Closing review returns to current progress, and execution remains owned by the performance. Chapter completion retains the conversation; Chapter 2 has a disabled entrance with its availability message.

## Interfaces and presentation

Authenticated `papermoon-story/*` RPC methods expose `catalog`, `list`, `create`, `state`, `models`, `choose`, `advance`, `start`, `retry`, `review` and `context`. Mutations serialize per Playbook and core writes retain sequence checks. `context` resolves editor and real writer/performance associations. The editor provides a central panel for model controls and a page context for guidance.

The guide follows that context across its editor and sessions. Creation keeps the right sidebar collapsed and anchors a dismissible hint to its expand button; displaying the guide clears the hint. Explicit continuation opens the guide. Progress updates retain the selected tool, focus and width. A collapsed surface shows its unseen-update notice to the left of expansion, while another selected tool leaves a dot on the guide tab. Display acknowledgement clears the notice. Per-save reading and acknowledgement preferences are presentation state. Narrow layouts use the shared fullscreen surface and a return control after locating an external operation.

The entrance and guide use DSH theme tokens and shared controls. A compact header and footer leave the scrolling body for teaching, analysis and operation guidance. Examples use the shared `PromptTrace` trajectory table and literal detail pane, with teaching-specific display labels. Central capability tags and editor emphasis mark new opening, system, model and performance controls until the corresponding saved result or startup. These cues derive from existing save state.

`src/content.ts` preserves the requirements' teaching, examples, analysis, operation guidance and state labels. `tests/content.spec.ts` checks those strings against the active five sections. Other UI labels live in `src/locales.ts`.

## Enable and disable

The PaperMoon profile enables this bundle by default; the Plugins page persists the user's choice. Unloading removes the guide and policy registration. Playbook data and module-owned sessions remain stored, and protected operations wait for the provider to return. Storage follows the [current-format policy](../../docs/development.md#frozen-revision-data); existing runtime files remain untouched.

## Verification

Main tests cover scope, isolated saves, restartable startup, submission failure and idempotence. `pnpm test:story-mode` runs a hosted DSH application with temporary data and a deterministic adapter. It checks the five-section flow, actual system/message ordering, absence of startup inference, preserved later drafts, bounded review, refresh, creation hints, trajectory example selection, capability cues, collapsed notices and narrow-screen hints. The editor and writer-session suites cover shared authoring and conversation behavior.
