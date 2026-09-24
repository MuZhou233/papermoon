# Manual playbook editor

English | [中文](README.zh.md)

The editor adds a playbook overview and independent detail pages to PaperMoon. It calls the [logic core](../playbook-core/README.md) through authenticated DSH requests. It creates no agent sessions and performs no publication, approval or model calls.

## Pages and authoring

PaperMoon opens the playbook overview by default. Cards show the playbook, project and latest revision. Search and project filters use a paginated metadata query. Project management creates, renames and deletes projects; deleting a project removes its playbooks and their private data while preserving revisions still referenced elsewhere. New playbooks require a name, project and explicit default language. New-playbook and add-language forms offer zh-CN and en presets plus a field for any other exact language code.

The detail page opens the latest revision and provides Draft, Revisions and Settings. Draft switches between virtual program files and text entries without separating their save operation. Program files support creation, rename, deletion, syntax highlighting, search, undo and redo. Text entries expose their key, usage description and exact-language translations. Empty translations remain distinct from missing ones. Language management never fills missing translations from another language. Metadata is preserved but has no editor.

Save draft persists pending operations with the observed sequence. Submission requires a saved draft and nonblank description, accepts reference revisions and ordered compilation targets, and compiles automatically. The default target is playbook.js in the default language. Playbook errors block submission unless Allow submission when compilation fails is checked. That option still compiles and saves no artifacts if any target fails. Empty playbooks remain uncompiled until an explicit check or submission.

Revisions are immutable and listed newest first by their playbook-local ordinal. A revision can be read, compared, copied or restored wholly or partially. Copies explicitly select their target project and whether to include history; publication records are not copied by this interface. Restoration replaces saved draft content without creating a revision. Full restoration changes its creation base; partial restoration retains it.

## Local state and conflicts

Each editor owns an independent IndexedDB backup containing its saved baseline and pending operations. Opening another window does not overwrite that backup. Recovery copies a selected backup into the current editor; deletion of an older backup is explicit. A backup failure leaves in-memory edits intact and displays a warning. Browser storage is recovery assistance, not server persistence.

A save captures the current operation prefix. Input entered while it is in flight remains pending after the response. A failed save first reads the server to detect a lost successful response; it does not automatically repeat the write. Sequence conflicts retain local content and provide a comparison and explicit discard/reload. Navigation, file selection and language preferences are separate from draft content.

Revision submission, copying and restoration operate on saved content. Pending edits must be saved first. RPC failures are displayed rather than retried automatically. A missing playbook has a dedicated state with a route back to the overview.

## Interfaces and ownership

The [Host adapter](src/index.ts) registers exact POST routes beneath /api/papermoon through DSH Connection. Its existing carrier enforces browser authentication and Host/Origin checks. Requests retain the Connection envelope and correlation ID. The [protocol](src/protocol.ts) validates payloads before dispatch; the [wire adapter](src/wire.ts) converts business maps to lossless JSON values, including maps inside differences.

| Operation group | Endpoints |
|---|---|
| Overview and projects | catalog, projects, createProject, renameProject, deleteProject |
| Playbooks | playbook, createPlaybook, renamePlaybook, deletePlaybook, copy |
| Content | snapshot, save, restore, compare |
| Revisions | commit, history, revision |
| Compilation | compile, compiled, revisionCompilation, revisionArtifact |

The browser registers the main page and sidebar entry through DSH slots. The [PaperMoon UI library](../../packages/ui/README.md) owns components; page code does not import DSH component implementations. DSH-facing interfaces stay in thin adapters and are exercised by real Web integration. Ordinary component and repository tests need no DSH checkout.

## Build and verification

Run pnpm build:plugins to emit the Host module and browser factory. The build externalizes the host's React modules and embeds PaperMoon styles inside the lazy factory. It consumes no private DSH build tooling. The [root launcher](../../docs/development.md) supplies the composition overlay and data location.

Run pnpm test:editor for browser scenarios using an isolated database, credentials directory and random port. The test owns and stops its Web process, exercises the real plugin loader and authentication, and calls no model. Main checks cover the interface and local draft state separately. User feedback determines whether the navigation and editing experience are ready for everyday use.

## Compilation and preview

Drafts expose entry, language and explicit compilation through the [compiler service](../playbook-compiler/README.md). Pending edits require Save and compile or cancellation. Draft previews read the saved check artifact. Revision pages instead read frozen attachments and expose no compile action. Missing or corrupt referenced artifacts display a persistent-data error. Revisions without artifacts offer restoration to the draft, where a new submission can produce a playable version.

Local edits, changed options or a new server sequence mark earlier results stale. Visible draft pages refresh at five-second intervals and on focus or reconnect, preserving pending edits. Diagnostic navigation checks the server again before moving to the source position or text key and language; stale diagnostics cannot select positions in newer content. Preview does not create Session records or imply publication eligibility.

Start performance opens the [shared launch dialog](../performances/README.md) for the latest or explicitly viewed historical revision. The editor itself does not run a model or infer publication eligibility.
