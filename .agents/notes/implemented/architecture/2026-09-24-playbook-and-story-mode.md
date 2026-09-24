# Agent Note: Playbook naming and story-mode requirements

Status: implemented

English | [中文](2026-09-24-playbook-and-story-mode.zh.md)

## Problem

Calling reusable authored content a story or script suggests that its complete plot has been written in advance. PaperMoon's content primarily supplies a background, an opening and interaction mechanisms. The product also needs a distinct name and a place to describe chapter-based experiences before implementing them.

## Decision

Playbook names authored content in both languages. The storage, core, compiler, editor, tools and workspace packages, their interfaces and their consumers use the same name. Story is reserved for the planned story mode. Performance continues to name an actual interaction and its branches. The [architecture](../../../../docs/architecture.md) owns these responsibilities.

This updates the format boundary recorded by the [context-composition decision](2026-09-17-context-composition.md). It is an incompatible rename with no old interface aliases or data migration. New default paths and format identities keep new content separate from former story data. The [current-format decision](../simplification/2026-09-25-current-format-only.md) removes product format versioning and historical-format handling. [Development](../../../../docs/development.md#frozen-revision-data) owns the current data rules and restart guidance.

The [story-mode directory](../../../../docs/story-mode/README.md) keeps each subsection in its own Markdown document as product requirements, including any UI and guidance that affect the experience. Shared experience requirements have one owning document. Existing engineering and delivery workflows continue unchanged. Implemented chapters must remain completable from the beginning in the current version; this does not promise continuation of old saved exercises.

The planned story-mode plugin owns dedicated UI, guidance and preset Playbooks. General mechanisms remain in other packages so ordinary use benefits from chapter-driven development. This decision establishes naming and requirement records; it does not ship a story-mode plugin. Chapter 0, Section 1 contains only a bilingual title and language links, leaving its requirements to the user.

## Alternatives considered

Keeping story or script for authored content preserves the misleading expectation of a predetermined plot and occupies the name needed by story mode. Scenario is less natural in the intended Chinese interface. Lorebook is familiar to SillyTavern users but suggests its existing entry-based concept. Playbook accommodates the authored mechanisms while retaining a distinct product identity.

Renaming only the interface text would leave conflicting package and API terminology. Compatibility aliases and migration would preserve former names and require additional storage, artifact and session behavior. The chosen scope adopts new formats and preserves old files without supporting them.

Treating chapters as a new development workflow would duplicate existing engineering rules. Markdown experience requirements provide the product direction while Agent Notes continue to own implementation decisions.

## Consequences

Consumers and authored programs use the new names together. Existing data cannot be continued through the new interfaces and is never rewritten automatically. Bilingual documents, examples and checks follow the rename; no chapter-document exemption is added. Later chapters may change architecture while retaining the intended experience of earlier implemented chapters.
