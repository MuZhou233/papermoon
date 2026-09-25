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

[Chapter 0: hello world](../../../../docs/story-mode/00/README.md) records the agreed experience requirements. The former DeepSeek API Key title placeholder first became a model-configuration subsection. Its requirements now describe a [Story Mode introduction](../../../../docs/story-mode/00/01-introduction.md) in the main content area, with operational guidance in the sidebar. Requiring a visit when a usable configuration already exists adds no preparation value, so the requirements gate advancement on any configured model, without changing the user’s selection or making a test request. The shared requirements remain in the directory entry document.

The chapter introduces trajectory inspection with a prepared example before applying it to a real exercise, so users can learn the same interaction before making a model request. Story Mode supplies the example and guidance; general trajectory reading and display remain in other packages. The example locks its input, and both conversations share a minimal system prompt so the user can compare their request contexts. The exercise leaves model choice to the user. Its earlier effort constraint is superseded by the [effort-guidance decision](../simplification/2026-09-25-story-mode-effort-guidance.md); the chapter documents own the exact prompt and interaction rules.

The chapter requirements separate learning progress from continued conversation. The first successful reply establishes the trajectory to inspect, while later messages remain available through the native conversation experience, including after chapter completion. Keeping that target stable lets users continue exploring without losing progress when a later request fails.

## Alternatives considered

Keeping story or script for authored content preserves the misleading expectation of a predetermined plot and occupies the name needed by Story Mode. Scenario is less natural in the intended Chinese interface. Lorebook is familiar to SillyTavern users but suggests its existing entry-based concept. Playbook accommodates the authored mechanisms while retaining a distinct product identity.

Renaming only the interface text would leave conflicting package and API terminology. Compatibility aliases and migration would preserve former names and require additional storage, artifact and session behavior. The chosen scope adopts new formats and preserves old files without supporting them.

Treating chapters as a new development workflow would duplicate existing engineering rules. Markdown experience requirements provide the product direction while Agent Notes continue to own implementation decisions.

Accepting implementation text as the requirement would preserve unreviewed wording. Copying every unchanged DSH label into chapter documents would duplicate upstream ownership, while deferring all existing chapter text would leave the current gaps unresolved. The adopted boundary records confirmed chapter wording now and identifies reused controls and runtime sources.

## Consequences

Consumers and authored programs use the new names together. Existing data cannot be continued through the new interfaces and is never rewritten automatically. Bilingual documents, examples and checks follow the rename; no chapter-document exemption is added. Later chapters may change architecture while retaining the intended experience of earlier implemented chapters.
