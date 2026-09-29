# Playbook authoring design

English | [中文](playbook-authoring.zh.md)

This document defines capabilities for plain-text authoring and scoped writer tools. [Story Mode](story-mode/design.md) selects which capabilities a storyline stage exposes; [Chapter 1](story-mode/fogbound-earthshine/01/README.md) applies them to a first character. The [architecture decision](../.agents/notes/implemented/architecture/2026-09-29-plaintext-playbook-authoring.md) owns the rationale. The plugin contracts maintain runtime interfaces and storage fields.

## Plain-text content

System prompts and opening messages each support a plain-text mode selected independently of the other. They are authored Playbook content, saved in drafts and frozen in revisions, rather than a script-editing shortcut. Existing script authoring remains a separate capability; a consumer does not need to expose all modes together.

The system prompt is one literal text value. Opening messages form an ordered list, each with a user or assistant role and a literal body. Preserve whitespace, newlines, roles and order through saving, revision creation and performance initialization. Do not execute scripts or expand templates in plain-text values. The active mode of each component determines its contribution to the performance context.

General drafts can contain incomplete or empty content. Storyline advancement and performance preparation may impose their own prerequisites; those conditions do not become universal storage restrictions.

## Manual editors

The two plain-text editors share syntax highlighting, search, undo/redo and visible save state. Provide manual Markdown and XML highlighting, defaulting to Markdown. Automatic detection is optional. Highlighting is a display preference: switching it does not rewrite content, change the authoring mode or clear pending edits. Incomplete Markdown or XML syntax does not block saving.

Place authoring mode and syntax highlighting in a compact toolbar attached to the editor frame. Show a visible highlighting label, the selected language and a chevron; the menu marks the current choice and supports keyboard selection. Use DSH theme colors, control sizes and focus states. Message role labels use the trajectory table palette, with blue for user and violet for assistant. Dropdown menus have an opaque background in light and dark themes. Opening messages use separate cards with a numbered header, role control and labelled ordering/delete icons. The layout wraps controls on narrow screens and keeps the editing area within its frame.

Opening messages support adding, deleting, editing bodies, changing roles between user and assistant, and reordering. New messages default to assistant; users can change that choice. Consecutive messages may have the same role. An empty list is valid. Reordering preserves each message's body and role, with keyboard-accessible controls as well as any pointer interaction.

Use the existing draft-save, unsaved-change and conflict experience. Do not silently discard local work when a writer saves another change. A caller that needs saved content must resolve pending edits before proceeding. Highlight settings are editor preferences, not model instructions or storyline progress.

## Capability modules and writers

Organize tools into system-prompt, opening-message, program, text-catalog, history and compilation capabilities. System-prompt tools read and modify that content. Opening-message tools read, add, delete, edit bodies, change roles and reorder messages. Preserve existing operation semantics when separating the other modules.

Tool catalogs, parameter scopes, help and execution derive from the same capability set used by manual editing. Ordinary Playbooks expose applicable capabilities; story saves additionally apply the current stage's restrictions. Shared status and help expose only permitted content and operations. Neither a broad metadata result nor a history/diff result may reveal otherwise unavailable content.

An existing writer session updates its tools when capabilities change. Restored and forked sessions resolve current permissions again; a frozen writer prompt or previous tool registration does not freeze authorization. Every execution rechecks the allowed operation and content scope, so a stale call cannot bypass a restriction. Editing metadata, restoring history or switching modes must obey the same rules as direct editing.

Writers cannot edit storyline binding or progress, or fabricate chapter tags. Those records belong to Story Mode orchestration. A writer's saved content can satisfy a chapter's content prerequisite, while manual continuation still belongs to the user. Tool availability alone does not advance a step.

Retain object-read protection, conflict detection and atomic saves for manual and writer edits to the same content. A denied or conflicting operation saves no partial changes. Read observations do not grant capability access, and capability access does not replace required observations. Tool modules live in the reusable extension layer and receive policy through shared capability interfaces rather than importing storyline content.

## Performance and chapter boundaries

Performance initialization consumes the saved content selected by each component's active mode and freezes a consistent context. Starting a performance does not by itself complete a chapter. When successful execution is a chapter condition, the chapter submission must correspond to the content used by that performance and its qualifying record, without including later draft edits or overwriting those edits. Story progress can advance while the current draft retains later work.

The [save design](story-mode/design.md#chapter-submissions-and-review) owns durable completion, tags, retries and read-only review. Chapter requirements determine the qualifying operation. This boundary does not prescribe tool names, parameter schemas, database fields or an implementation for composing plain-text and script content.

## Acceptance scenarios

- Save and reload plain-text content in each component independently; preserve bodies, roles and order in the revision and actual performance context.
- Switch Markdown/XML highlighting without changing text or losing unsaved work; save incomplete syntax and confirm it remains literal.
- Add, delete, edit, change roles and reorder opening messages, including an empty list and adjacent messages with the same role.
- Confirm that manual controls, registered writer tools, help, status and execution use the same scope. Reject direct and indirect reads or writes outside it.
- Update an already open writer session after a stage change; recheck permissions on restoration, Fork and stale tool execution.
- Exercise concurrent manual/writer changes, required read observations and denied batches without silent overwrites or partial saves.
- Complete a chapter after editing the draft beyond the performance's starting snapshot. The submission retains the performed content and qualifying record, while the later draft remains intact.
