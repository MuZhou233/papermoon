# Agent Note: Plain-text authoring and scoped writer tools

Status: implemented

English | [中文](2026-09-29-plaintext-playbook-authoring.zh.md)

## Problem

First-character creation needs direct system and opening editing. A program-only model makes those operations depend on script structure, while unrestricted writer tools and history can expose or change content ahead of its teaching stage.

## Decision

The [authoring requirements](../../../../docs/playbook-authoring.md) are implemented as independent system and opening modes. Ordinary Playbooks default to plain text and preserve inactive mode content. Ordered messages have stable identities and retain their role and literal body. Shared CodeMirror controls provide explicit Markdown/XML highlighting, search, undo and save status; a language compartment changes highlighting while preserving the document, cursor and history.

The manual surface groups display settings in an attached toolbar and each opening message in a numbered card. Compact menus reuse the shared DSH selection and focus behavior, while scoped styles align line numbers, spacing and action icons with the editor frame. The editor and prompt trace share a role-badge component using the trajectory table palette, keeping role colors consistent. Menus use an opaque layer-2 surface so underlying text remains visually separate. This keeps the relationship between settings and content visible and leaves the authoring lifecycle unchanged. Portaled menus wait for their measured position before moving focus into an option; later scroll or resize placement preserves that focus.

Shared editor styles cover native carets and selections alongside CodeMirror's drawn layers. Syntax tokens use DSH's code-block palette, and search controls and revision differences consume its surface and state colors. CSS resolves theme changes while each editor retains its state. This avoids rebuilding editors on theme changes and keeps explicit app themes aligned with the host.

Pure text prepares a frozen context directly. Mixed modes use script compilation and replace only the selected plain component; frozen `sourceContext` keeps script verification independent of that replacement. Functions, state and custom composition retain their existing module ownership. The first performance freezes saved content; chapter submission reuses that source through the [save decision](2026-09-28-storyline-playbook-saves.md).

Core capability resolution, authorization and projection serve manual editing, writer tools, versions and performance. Story Mode contributes a registered policy. System, opening, program, text, history and compilation tools form separate modules; catalog filtering, help topics, result projection and execution use the same scope. Missing policy pauses protected operations. Metadata, restore, copy and alternate entry points retain checks.

Existing writer sessions refresh registrations at stage changes, and resumed or forked sessions resolve current permissions. Each call rechecks scope. Object observations and atomic sequence writes preserve the [editing decision](2026-09-13-object-scoped-edits.md). Manual saves retain text typed during an in-flight request and show conflicts with system/opening comparisons. Writers cannot write binding, progress or chapter tags.

Chapter capabilities follow its [five-section table](../../../../docs/story-mode/fogbound-earthshine/01/README.md): opening first, system next, model selection and then performance. Writer saves satisfy the same content conditions, including empty openings. Continued progress in the earlier sections remains a user action. Teaching text comes directly from requirements.

## Alternatives considered

Generated scripts behind a simplified editor would tie plain authoring to script structure. A single whole-Playbook mode would prevent mixed use. Independent first-class content represents each choice directly and preserves work when ordinary modes change.

UI-only filtering or registration only at session creation would leave direct and stale calls outside policy. Write-only restrictions would expose unopened content through reads. Shared authorization covers discovery and execution while keeping chapter dependencies out of reusable tool modules.

Requiring manual saves after writer edits would measure the chosen interface rather than saved content. Requiring messages would exclude player-initiated openings; prefilling examples would replace the user's initial creative choice. Retired copy fixtures would preserve a deleted design. Blank initial content and active requirement checks retain the chosen behavior.

## Consequences

Ordinary creation gains a direct editing path, while script authoring remains independently selectable. Current-format content and frozen artifacts change together, with existing data left untouched. The [guidance decision](2026-09-29-story-mode-contextual-guidance.md) follows these capabilities without granting them.

Unit and integration checks cover literal preservation, mixed composition, component observations, policy unload, old calls, existing-session refresh and Fork. CodeMirror tests verify text, selection and undo across highlighting changes. Editor and writer browser suites verify ordinary creation, compilation, conflicts and conversation. The first-chapter browser checks the exact system text and ordered messages sent to the deterministic model.
