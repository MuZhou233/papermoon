# Agent Note: DSH patch maintenance

Status: implemented

English | [中文](2026-09-18-patch-maintenance.zh.md)

## Problem

Implementation-ordered patches repeatedly changed the same DSH files and mixed shared mechanisms with plugin changes. Mechanical package grouping separated small consumer adaptations while retaining DSH's full-site documentation and decision workflow. Both made a local fix harder to understand and maintain. PaperMoon remains a collection of product plugins with necessary upstream repairs.

## Decision

Maintain the final difference from the pinned official base by current responsibility. Each changed file has one patch owner; related implementation, tests and direct contracts can cross package boundaries. Patch names and directory levels may change with their contents. The [patch guide](../../../../patches/README.md) owns the long-term editing, regrouping and plugin-promotion rules; the manifest owns the current file list and checks.

The current organization follows these shared maintenance needs, without establishing a permanent classification:

| Patch | Responsibility |
|---|---|
| `shared/session.patch` | Session records, restoration, history and request selection, with dependent readers and query adaptations |
| `shared/tools.patch` | Tool schemas, validation and language type rendering |
| `shared/runtime-catalogs.patch` | Runtime APIs, slots and scoped events derived from several responsibilities |
| `plugins/agent-loop.patch` | Request execution and tool argument diagnostics |
| `plugins/session-controller.patch` | Input admission, Host submission, client reads and list presentation |
| `plugins/workspace.patch` | Resource workspaces and collaborating controllers, client navigation and preset selection |
| `plugins/chat.patch` | Chat content and reply presentation |
| `plugins/conversation.patch` | Conversation assembly and input extensions |
| `plugins/trajectory.patch` | Readonly trajectory inspection |
| `plugins/token-meter.patch` | Exact-request token estimation |

PaperMoon retains DSH code and runtime constraints, direct bilingual package contracts, runtime-generated artifacts and behavior evidence. Full-site documentation and DSH Note synchronization are outside the carried-patch scope. Patch rationale belongs in the owning main-repository decisions. This scope refines the patch portion of [independent maintenance](../process/2026-09-11-independent-maintenance.md), whose main-repository independence remains unchanged.

The existing plugin changes remain patches. They expose generic composition, display, inspection and resource facilities, while PaperMoon already owns its product policies. Copying complete plugins would take over upstream behavior still worth following. Promotion remains a separate decision based on responsibility and maintenance benefit.

## Alternatives considered

A chronological stack retains intermediate states and application dependencies. Grouping strictly by package separates adaptations that only exist to support another change. One aggregate diff hides responsibilities. Fixed folders or per-file ownership registries would require a second map to track ordinary reorganization.

Continuing DSH's full documentation workflow would make local code fixes update site-wide references, translations and duplicate decision records. Dropping all documentation would lose contracts at their call sites; dropping all generated artifacts would remove code that plugins actually read. The retained package contracts and runtime catalogs preserve those uses.

A fork or file overlay copies a larger upstream surface. A new export tool would introduce another maintained interface when Git and source comparison already cover the chosen representation. Automatic generation during setup would add a second reconstruction stage; generated runtime differences remain saved patches.

## Consequences

The upstream Gitlink, runtime behavior and existing tests and snapshots remain unchanged. Upstream-wide documentation returns to its base. Distinct patch rationale is consolidated into the owning main-repository Notes, with a separate tool-argument bug-fix Note. Direct package contracts retain their semantics and bilingual records.

The patch reader rejects duplicate file ownership, including rename sources. Reconstruction and source comparison remain separate from delivery checks. The full documentation aggregate is replaced with runtime-catalog checks, while behavior tests, recorded replay, type checking and lint remain registered. The Host generator's runtime-only mode uses the same projection without generating or checking documentation; its default mode is unchanged.

Pure regrouping uses source equivalence and does not introduce a new Note or rerun unchanged behavior checks. Promoting functionality, changing ownership obligations or changing behavior still updates the owning decision and relevant evidence. The [submodule decision](2026-09-11-submodule-launch.md) continues to own pinned reconstruction and runtime-data separation.
