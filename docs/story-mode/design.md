# Story Mode: Playbook saves and storylines

English | [中文](design.zh.md)

Story Mode uses a special Playbook as a save. Users choose a storyline when creating the save and follow its chapters, sections and steps. This document owns the shared requirements for that experience; [Fogbound Earthshine](fogbound-earthshine/README.md) owns the first storyline's content. The [architecture decision](../../.agents/notes/implemented/architecture/2026-09-28-storyline-playbook-saves.md) records the rationale and delivery boundary.

## Saves and navigation

Each save binds one Playbook to one storyline at creation. That binding cannot change afterward. Users can create several independent saves for the same storyline; progress and referenced exercise sessions belong to the individual save.

The Story Mode entry opens save management. Users can create a save, continue its current progress or review its completed chapters. Creation requires choosing a storyline and shows its name and introduction. Continuing opens the saved position within the selected storyline. Navigation shows the storyline, chapter, section and step, distinguishing completed, current and not yet started content without allowing users to bypass advancement conditions.

There is no replay, restart or in-place progress reset operation. Starting from the beginning creates a new save. Leaving, switching saves, refreshing and re-entering preserve each save's progress. Restoring a page does not resend a model request. Leaving or disabling Story Mode releases its active guidance and page restrictions without changing saved progress or ordinary sessions.

## Content and advancement

A storyline contains chapters, each chapter contains sections, and each section contains steps. Each step defines its user actions, visible results, guidance and advancement condition. Retain manual continuation and progression through verifiable user operations from the [shared interaction requirements](README.md#advancement).

Completing a step, a section and a chapter are distinct events. A chapter completes only when its defined requirements are satisfied; reaching the end of the currently described section does not itself complete the chapter or storyline. Section completion saves progress and creates a chapter submission only when the chapter completion condition is also met.

Use the existing conversation, trajectory, configuration and guidance mechanisms under the [shared interaction requirements](README.md#presentation-and-navigation). Apply their presentation rules to the focused step within the selected save.

## Chapter submissions and review

Completing a whole chapter creates an immutable revision in that Playbook's history. A tag identifies the storyline and chapter for which it is the submission. The revision retains the Playbook content, corresponding story progress and the references needed for chapter review. Ordinary saves and unrelated revisions do not become chapter submissions merely because they exist in the history.

Chapter completion and its tagged revision must agree durably. A failed submission leaves the chapter incomplete and allows retry without losing previously saved progress. Repeated actions, concurrent pages and recovery after interruption must not create duplicate submissions for the same chapter in one save or expose completion without its revision.

Review opens a completed chapter's submission read-only. It displays the content, step instructions and existing records associated with that chapter at submission time. Session references retain the relevant record boundary so later conversation cannot change the reviewed exchange. Instructions must remain those associated with the submission rather than silently following later content edits.

Review does not send model requests, execute chapter actions again, overwrite the current draft or change progress. Leaving review returns to the save's current position. A missing referenced record must be reported as unavailable; it must not be replaced with a new conversation or treated as permission to restart. Review depends on the owning modules retaining their referenced records and does not make the Playbook a self-contained export of those modules' data.

## Data and module responsibilities

The Playbook is the sole authority for storyline binding, progress and the module references needed to resume or review the save. Chapter revisions preserve the corresponding state. Story Mode has no separate progress file or database. Browser navigation state and in-memory projections are not alternative progress stores.

Session logs, model configuration and other module data remain with their existing owners. Storylines may supply content for those modules and restrict their use at a particular stage. The Story Mode layer owns these product rules; reusable storage, versioning, session execution and rendering mechanisms remain in the extension and platform layers described by the [architecture](../architecture.md#responsibilities).

Editors, writers and performances are available according to the current storyline stage. Manual editing and writer tools share the [authoring capability scope](../playbook-authoring.md#capability-modules-and-writers), including reads, writes, help and status results. Editing metadata, restoring content, copying a Playbook or disabling Story Mode cannot provide a way to change its storyline binding or bypass progression. The protected state remains valid wherever the Playbook is accessed.

These requirements define capabilities and integrity constraints, without specifying a public API, database schema or field protocol. The [current-format policy](../development.md#frozen-revision-data) applies: existing progress is not automatically imported, and old runtime data is not cleaned up as part of the design change.

## Acceptance scenarios

- Create two saves for the same storyline. Progressing one leaves the other's position and exercise records unchanged; switching and refreshing restore the selected save.
- Select the storyline at creation. Later edits, shared entry points, content restoration and mode changes cannot replace that binding or bypass stage restrictions.
- Complete a section whose chapter requirements are not yet satisfied. Preserve section progress without marking the chapter complete or creating a chapter tag.
- Complete a chapter and verify that its tagged revision preserves the matching content and progress. Failure, retry, duplicate actions, concurrent pages and interrupted recovery never leave a completed chapter without its submission or create duplicate submissions.
- Review a completed chapter after further edits and conversation. Its content, instructions and record boundary remain fixed; review makes no model request and leaves the current save unchanged.
- Return from review or re-enter a save and continue from its current position. Missing review records report their absence without creating replacement records.
- Resume with progress read from the Playbook and session records read from their owning module. No separate Story Mode progress file or database is required.
