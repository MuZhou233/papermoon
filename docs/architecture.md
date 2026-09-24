# Repository architecture

English | [中文](architecture.zh.md)

## Product and DSH

DSH provides the general agent runtime and application infrastructure. PaperMoon's product design builds on these capabilities through its own plugins, configuration and necessary patches. Frontend describes the distribution's user-facing purpose; its implementation can include browser code and server-side logic. The [product introduction](../README.md) describes the intended experiences, and the [positioning decision](../.agents/notes/implemented/architecture/2026-09-12-product-positioning.md) records the relationship with DSH and its rationale.

## Responsibilities

Playbook names the reusable authored content that defines a background, an opening and interaction mechanisms. A performance records an interaction started from that content. Story is reserved for the planned chapter-based story mode. Its plugin will own dedicated UI, guidance and preset Playbooks, while other packages provide shared editing, compilation and runtime mechanisms. The [chapter documents](story-mode/README.md) record product requirements; the story-mode plugin is not implemented. The [naming decision](../.agents/notes/implemented/architecture/2026-09-24-playbook-and-story-mode.md) records this boundary and the incompatible format change.

The main repository maintains plugins, tooling, documentation, dependencies and CI. The Gitlink at `dsh/` pins an official DSH commit; the submodule is not a package in the main workspace. Changes applied to DSH are stored as patches and retain its code and runtime constraints within PaperMoon's [patch maintenance scope](../patches/README.md). The tools that manage those patches follow main-repository standards. Validate each part with evidence appropriate to its effects.

The main rules are self-contained. Consuming a DSH interface does not import its package structure, runtime design rules, SDK requirements or organization workflows into main-repository policy. The [maintenance decision](../.agents/notes/implemented/process/2026-09-11-independent-maintenance.md) records this choice.

PaperMoon pins DSH `dsh-v0.1.7-rc.2` at `477b4f420553e8a52c2fbccc464d7561b239c443`. Product presets are declarative registry entries. Shared Session protocol, tool-update projection and client binding lifetimes remain DSH responsibilities; PaperMoon owns authored content, Playbook policy and per-session product controls.

## Current launch and data

The launcher executes DSH's official built CLI with the standard Web profile, PaperMoon's composition overlay and the PaperMoon root as its working directory. Dependency installation, build and registered checks run inside the submodule with `CI=true`, which preserves DSH’s automated installation behavior and dependency layout. Launch inherits the caller’s environment.

The composition adds the manual playbook editor, writer management, writer sessions and text performances while retaining DSH configuration, authentication, ordinary conversations and settings. The launcher supplies independent default data homes and keeps an original-Web command for comparison. [Development](development.md) documents the command interface.

## Playbook data

The [storage module](../plugins/playbook-storage/README.md) owns product data in an independent SQLite database and exports a loadable Cordis adapter. Its core has no DSH dependency. The PaperMoon overlay mounts it; the original Web composition does not. The [storage decision](../.agents/notes/implemented/architecture/2026-09-12-playbook-storage.md) records the ownership and transaction choices.

The [logic core](../plugins/playbook-core/README.md) owns program and multilingual-text structures, pure content edits and business KV encoding. Its repository entry composes operations over storage; its Cordis entry registers the internal service. These entries keep compilation, session policies and user/model interfaces outside the authored-content module. The [core decision](../.agents/notes/implemented/architecture/2026-09-12-playbook-core.md) records this division.

## Maintenance tools

Main checks read main-owned files and fixtures, excluding the submodule, dependency directories and runtime data. Adapted checkers live independently in `tooling/checks/`; they retain their original license and provenance. The [checker guide](../tooling/checks/README.md) explains their configuration and limits.

## Manual authoring

The [editor plugin](../plugins/playbook-editor/README.md) owns user-facing operations and pages. The [UI library](../packages/ui/README.md) maintains attributed component copies and editor controls, sharing only DSH theme and host interfaces. The [interface decision](../.agents/notes/implemented/architecture/2026-09-12-manual-playbook-editor.md) records the integration and local-buffer design.

## Writer definitions and tools

[Writer management](../plugins/writers/README.md) owns prompt definitions in a separate database and provides a pure initial-context resolver. [Playbook tools](../plugins/playbook-tools/README.md) maintain model-facing operations over the logic core and register into caller-owned DSH scopes. The management page displays their shared catalog; it does not create sessions or invoke models. The [decision](../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.md) records these responsibilities.

## Writer sessions

The [session plugin](../plugins/writer-sessions/README.md) owns writer configuration, frozen context and observations. Playbook target registration belongs to the [shared workspace provider](../plugins/playbook-workspaces/README.md). Generic DSH capabilities are maintained as patches; the [decision](../.agents/notes/implemented/architecture/2026-09-12-writer-sessions.md) records ownership and alternatives.

## Compilation and initialization

The [compiler](../plugins/playbook-compiler/README.md) consumes fixed content and explicit options, with separate entries for frozen starting text and function execution. Its service reads repository snapshots and owns independent artifact files. Editor and scoped tool consumers share it; the storage and logic core have no reverse dependency. The [decision](../.agents/notes/implemented/architecture/2026-09-13-commonjs-opening-compiler.md) records CommonJS and artifact ownership.

## Revision submission and performances

The [compiler service](../plugins/playbook-compiler/README.md#submission-and-frozen-revisions) owns automatic compilation before an atomic revision commit. Storage carries generic immutable attachments; the core only transports them. A separate revision reader and text runtime initialize [performance sessions](../plugins/performances/README.md) without compiler execution or preview-cache access. Sessions retain complete artifact copies, so source deletion does not destroy continued play. [Shared playbook workspaces](../plugins/playbook-workspaces/README.md) group writer and moderator sessions under one stable provider.

Function declarations, frozen code and invocation live in the [compiler package](../plugins/playbook-compiler/README.md). The [performance plugin](../plugins/performances/README.md) serializes calls and persists complete actions in Session logs. Function state does not enter storage KV or model context implicitly.

Worldline nodes and selected-path state belong to the [performance plugin](../plugins/performances/README.md#worldlines). DSH supplies generic logged history selection and request reconstruction. Both derive from the same raw Session log; context assembly does not define the historical tree.

Request composition belongs to the [performance plugin](../plugins/performances/README.md#actual-context); frozen playbook execution belongs to the compiler's runtime entry. DSH supplies durable request-local selection and replay independently of transcript history. The [decision](../.agents/notes/implemented/architecture/2026-09-17-context-composition.md) records the once-per-input policy.

Performance inspection uses the full DSH trajectory with a compact worldline navigator and original/rewritten context modes. Floors describe story depth; DSH turn numbers retain execution identity. [Inspection semantics](../plugins/performances/README.md#actual-context) remain separate from runtime history selection.
