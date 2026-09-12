# Repository architecture

English | [中文](architecture.zh.md)

## Product and DSH

DSH provides the general agent runtime and application infrastructure. PaperMoon's product design builds on these capabilities through its own plugins, configuration and necessary patches. Frontend describes the distribution's user-facing purpose; its implementation can include browser code and server-side logic. The [product introduction](../README.md) describes the intended experiences, and the [positioning decision](../.agents/notes/implemented/architecture/2026-09-12-product-positioning.md) records the relationship with DSH and its rationale.

## Responsibilities

The main repository maintains plugins, tooling, documentation, dependencies and CI. The Gitlink at `dsh/` pins an official DSH commit; the submodule is not a package in the main workspace. Changes applied to DSH are stored as patches and follow the submodule’s delivery standards. The tools that manage those patches follow main-repository standards. When a change affects both repositories, validate each part under its own rules.

The main rules are self-contained. Consuming a DSH interface does not import its package structure, runtime design rules, SDK requirements or organization workflows into main-repository policy. The [maintenance decision](../.agents/notes/implemented/process/2026-09-11-independent-maintenance.md) records this choice.

## Current launch and data

The launcher executes DSH's official built CLI with the standard Web profile, PaperMoon's composition overlay and the PaperMoon root as its working directory. Dependency installation and build run inside the submodule with `CI=true`, which enables DSH’s supported automated installation behavior. Without that setting, the development hook installer rejects the submodule’s Git configuration. Patch checks and launch inherit the caller’s environment without forcing this setting.

The composition adds the manual script editor while retaining DSH configuration, authentication, conversation and settings. The launcher supplies independent default data homes and keeps an original-Web command for comparison. [Development](development.md) documents the command interface.

## Script data

The [storage module](../plugins/story-storage/README.md) owns product data in an independent SQLite database and exports a loadable Cordis adapter. Its core has no DSH dependency. The PaperMoon overlay mounts it; the original Web composition does not. The [storage decision](../.agents/notes/implemented/architecture/2026-09-12-script-storage.md) records the ownership and transaction choices.

The [logic core](../plugins/story-core/README.md) owns program and multilingual-text structures, pure content edits and business KV encoding. Its repository entry composes operations over storage; its Cordis entry registers the internal service. These entries keep compilation, session policies and user/model interfaces outside the authored-content module. The [core decision](../.agents/notes/implemented/architecture/2026-09-12-script-core.md) records this division.

## Maintenance tools

Main checks read main-owned files and fixtures, excluding the submodule, dependency directories and runtime data. Adapted checkers live independently in `tooling/checks/`; they retain their original license and provenance. The [checker guide](../tooling/checks/README.md) explains their configuration and limits.

## Manual authoring

The [editor plugin](../plugins/story-editor/README.md) owns user-facing operations and pages. The [UI library](../packages/ui/README.md) maintains attributed component copies and editor controls, sharing only DSH theme and host interfaces. The [interface decision](../.agents/notes/implemented/architecture/2026-09-12-manual-script-editor.md) records the integration and local-buffer design.
