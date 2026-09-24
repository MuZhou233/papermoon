# Agent Note: DSH rc.2 migration

Status: implemented

English | [中文](2026-09-25-dsh-rc2-migration.zh.md)

## Problem

PaperMoon's patches targeted an older DSH checkout. The rc.2 release replaces preset discovery, Session messages and client binding lifetimes. Carrying the old interfaces forward would duplicate upstream responsibilities and couple simultaneous conversations.

## Decision

Pin `dsh-v0.1.7-rc.2` at `477b4f420553e8a52c2fbccc464d7561b239c443`. Keep Node 24 and pnpm 11.7.0. Minimize carried patches, expanding them when a necessary shared capability is absent. Product policy stays in PaperMoon plugins. The upstream Coding Tools gate applies without display exceptions and does not change existing sessions' modes when disabled.

The profile declares writer and performance presets through the registry. Selection hooks run serially within Agent maintenance exclusion, so product validation and workspace reconciliation finish before input admission. Initialization listeners complete during the awaited Agent creation event without waiting for that Agent to become idle.

Session v4 developer messages and independent tool results replace the old message assumptions. Authored assistant context has an explicit producer; the neutral adapter representation retains its role without fabricated model provenance. Request reconstruction applies the projections at the requested history position, including continuation bases. History selection refolds message projections and tool declarations together. Composition checksums cover immutable source messages; projected content remains valid request input.

The upstream picker retains selection authority. A minimal binding-specific reader exposes its pending selection for new sessions and the bound preset projection for existing ones. Writer, performance and inspection state and subscriptions belong to each Session binding and are also disposed when their plugin unloads. Input blockers keep independent owners and allow editing while blocking submission. Resource workspaces preserve upstream archive, pin, activity and navigation behavior.

These requirements extend a few previously unpatched consumers: model-adapter conversion needs a neutral authored-message path, the new conversation assembly needs product slots, and the mounted editor must retain a visible draft while blocked. Focused regressions exercise those consumers. A separate build patch admits the new desktop keyboard type-output directory to the upstream cleaner's allowlist; otherwise the normal parent build stops during cleanup. Its regression preserves neighboring files. These are shared runtime and build gaps, rather than reasons to copy whole upstream plugins.

Old preset directory scanning and global selection state are removed. Upstream Agent creation, ordinary input admission and Coding Tools presentation are retained. Existing context, history, inclusive-union schema, native tool presentation, reply-preservation and trajectory extensions remain necessary for current product consumers. Runtime catalogs and direct bilingual contracts follow the resulting implementation. The [patch maintenance decision](2026-09-18-patch-maintenance.md) owns organization; the [patch guide](../../../../patches/README.md) owns the scope rule.

## Alternatives considered

Keeping old preset discovery and global client state would preserve obsolete interfaces and prevent correct multi-session behavior. Replacing entire upstream plugins would increase maintenance scope. Removing shared context and history hooks would lose current Playbook and worldline behavior. None meets the migration goal.

Suppressing cleanup failures or building a copied source tree would bypass the normal reconstruction path. Fixing the exact missing output classification keeps setup and build usable against the real managed checkout and makes the repair independently testable.

## Consequences

The parent Gitlink and complete patch set must move together because setup reads the staged Gitlink and resets DSH. Verification reconstructs those patches, then builds and tests the actual managed checkout. Temporary checkouts serve source comparison only. Registered checks cover runtime catalogs, affected behavior, deterministic replay, types and lint; product integration and browser tests cover the user flows separately. Pair recording follows review of both languages and does not add DSH site-wide checks.

Current fixture recordings use the DSH format constant and current message structure. Product data migration, historical aliases and format-evolution tests remain excluded. DSH keeps responsibility for its own protocol versions and recovery. The migration left Story Mode and its then-existing DeepSeek API Key subsection placeholder unchanged. The current [Chapter 0 requirements](../../../../docs/story-mode/00/README.md) are maintained separately.
