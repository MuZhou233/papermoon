# Agent Note: Playbook naming and Story Mode requirements

Status: implemented

English | [中文](2026-09-24-playbook-and-story-mode.zh.md)

## Problem

Calling reusable authored content a story or script suggests that its complete plot has been written in advance. PaperMoon's content primarily supplies a background, an opening and interaction mechanisms. The product also needs a distinct name and a place to describe chapter-based experiences before implementing them.

## Decision

Playbook names authored content in both languages. The storage, core, compiler, editor, tools and workspace packages, their interfaces and their consumers use the same name. Story is reserved for Story Mode, called 故事模式 in Chinese. Performance continues to name an actual interaction and its branches. The [architecture](../../../../docs/architecture.md) owns these responsibilities.

This updates the format boundary recorded by the [context-composition decision](2026-09-17-context-composition.md). It is an incompatible rename with no old interface aliases or data migration. New default paths and format identities keep new content separate from former story data. The [current-format decision](../simplification/2026-09-25-current-format-only.md) removes product format versioning and historical-format handling. [Development](../../../../docs/development.md#frozen-revision-data) owns the current data rules and restart guidance.

The [Story Mode directory](../../../../docs/story-mode/README.md) keeps each subsection in its own Markdown document as product requirements, including any UI and guidance that affect the experience. Shared experience requirements have one owning document. Existing engineering and delivery workflows continue unchanged. Implemented chapters must remain completable from the beginning in the current version; this does not promise continuation of old saved exercises.

The requirements also own exact product wording and translations. Describing a hint’s purpose without its text left room for implementation-time writing, including an unspecified fixed example reply. The [text authority rule](../../../../docs/story-mode/README.md#text-authority) now requires wording to be discussed and recorded before implementation or revision. Shared wording has one home; chapter documents own their content. Unchanged DSH controls and actual runtime data identify their source, while authored templates and Story Mode errors retain explicit wording. The confirmed text is recorded in both languages; it does not acquire authority merely by appearing in code.

The Story Mode plugin owns chapter definitions, progress orchestration, dedicated UI, guidance and preset content including Playbooks. General mechanisms remain in other packages so ordinary use benefits from chapter-driven development. This decision establishes naming and requirement records. The [layering and implementation decision](2026-09-25-story-mode-layers.md) records the subsequent runtime boundary.

Model preparation checks usable configuration and the user's selection; visiting settings has no independent learning value when a valid choice already exists. Native conversation and trajectory mechanisms remain reusable extension responsibilities. The [effort decision](../simplification/2026-09-25-story-mode-effort-guidance.md) preserves user choice. A durable first qualifying reply keeps completion stable during later conversation and failures.

## Alternatives considered

Keeping story or script for authored content preserves the misleading expectation of a predetermined plot and occupies the name needed by Story Mode. Scenario is less natural in the intended Chinese interface. Lorebook is familiar to SillyTavern users but suggests its existing entry-based concept. Playbook accommodates the authored mechanisms while retaining a distinct product identity.

Renaming only the interface text would leave conflicting package and API terminology. Compatibility aliases and migration would preserve former names and require additional storage, artifact and session behavior. The chosen scope adopts new formats and preserves old files without supporting them.

Treating chapters as a new development workflow would duplicate existing engineering rules. Markdown experience requirements provide the product direction while Agent Notes continue to own implementation decisions.

Accepting implementation text as the requirement would preserve unreviewed wording. Copying every unchanged DSH label into chapter documents would duplicate upstream ownership, while deferring all existing chapter text would leave the current gaps unresolved. The adopted boundary records confirmed chapter wording now and identifies reused controls and runtime sources.

## Consequences

The [storyline save decision](2026-09-28-storyline-playbook-saves.md) preserves naming and text authority. The [first-character decision](2026-09-29-plaintext-playbook-authoring.md) implements the five-section replacement; retired chapter code, configuration and tests have been removed under the current-format policy.
