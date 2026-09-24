# Agent Note: Playbook naming and Story Mode requirements

Status: implemented

English | [中文](2026-09-24-playbook-and-story-mode.zh.md)

## Problem

Calling reusable authored content a story or script suggests that its complete plot has been written in advance. PaperMoon's content primarily supplies a background, an opening and interaction mechanisms. The product also needs a distinct name and a place to describe chapter-based experiences before implementing them.

## Decision

Playbook names authored content in both languages. The storage, core, compiler, editor, tools and workspace packages, their interfaces and their consumers use the same name. Story is reserved for the planned Story Mode, called 故事模式 in Chinese. Performance continues to name an actual interaction and its branches. The [architecture](../../../../docs/architecture.md) owns these responsibilities.

This updates the format boundary recorded by the [context-composition decision](2026-09-17-context-composition.md). It is an incompatible rename with no old interface aliases or data migration. New default paths and format identities keep new content separate from former story data. The [current-format decision](../simplification/2026-09-25-current-format-only.md) removes product format versioning and historical-format handling. [Development](../../../../docs/development.md#frozen-revision-data) owns the current data rules and restart guidance.

The [Story Mode directory](../../../../docs/story-mode/README.md) keeps each subsection in its own Markdown document as product requirements, including any UI and guidance that affect the experience. Shared experience requirements have one owning document. Existing engineering and delivery workflows continue unchanged. Implemented chapters must remain completable from the beginning in the current version; this does not promise continuation of old saved exercises.

The planned Story Mode plugin owns chapter definitions, progress orchestration, dedicated UI, guidance and preset content including Playbooks. General mechanisms remain in other packages so ordinary use benefits from chapter-driven development. This decision establishes naming and requirement records; it does not ship a Story Mode plugin.

[Chapter 0: hello world](../../../../docs/story-mode/00/README.md) now records the agreed experience requirements. Its model-configuration subsection replaces the former DeepSeek API Key title placeholder; the shared requirements remain in the directory entry document.

The chapter introduces trajectory inspection with a prepared example before applying it to a real exercise, so users can learn the same interaction before making a model request. Story Mode supplies the example and guidance; general trajectory reading and display remain in other packages. The example locks its input, and both conversations share a minimal system prompt so the user can compare their request contexts. The exercise leaves model choice to the user while constraining effort within the exercise; the chapter documents own the exact prompt and interaction rules.

## Alternatives considered

Keeping story or script for authored content preserves the misleading expectation of a predetermined plot and occupies the name needed by Story Mode. Scenario is less natural in the intended Chinese interface. Lorebook is familiar to SillyTavern users but suggests its existing entry-based concept. Playbook accommodates the authored mechanisms while retaining a distinct product identity.

Renaming only the interface text would leave conflicting package and API terminology. Compatibility aliases and migration would preserve former names and require additional storage, artifact and session behavior. The chosen scope adopts new formats and preserves old files without supporting them.

Treating chapters as a new development workflow would duplicate existing engineering rules. Markdown experience requirements provide the product direction while Agent Notes continue to own implementation decisions.

## Consequences

Consumers and authored programs use the new names together. Existing data cannot be continued through the new interfaces and is never rewritten automatically. Bilingual documents, examples and checks follow the rename; no chapter-document exemption is added. Later chapters may change architecture while retaining the intended experience of earlier implemented chapters.
