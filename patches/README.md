# DSH patches

English | [中文](README.zh.md)

This directory maintains PaperMoon’s necessary changes to DSH. The parent Gitlink pins the official base; [series.json](series.json) lists the patches and checks. Prefer DSH extension points and PaperMoon plugins for product behavior.

`dsh/` is a managed checkout. Export intended changes before `pnpm run setup`, which resets tracked files and removes non-ignored untracked files before applying the patches. Keep runtime data and independent work outside it. See [development](../docs/development.md) for initialization and upgrades.

## Organization

Group changes by maintenance responsibility, including their implementation, tests and direct contracts across files and packages. Keep small consumer adaptations with the shared mechanism they follow. Summaries used by several responsibilities may have their own group.

Each changed DSH file belongs to one patch, containing its complete difference from the pinned base. This makes the final difference readable without following intermediate patches. A patch can cover several capabilities and need not run independently. Git retains the history.

Merge, split, rename or move patches and directories when their responsibilities or shared maintenance needs change. Extend an existing patch when its responsibility continues; introduce a new one when a separate responsibility emerges. The current names, counts and directory levels are not a fixed classification. Move related tests, contracts and generated artifacts with their owner. Pure regrouping requires source equivalence, not a new decision record.

Register each patch path once in `series.json`, relative to this directory, and remove empty patches with their registrations. The manifest defines application order. Patch files and directories must be regular repository files and directories, without symlinks. The manifest’s version identifies its format, not the DSH or patch revision.

## Editing and export

Run these commands from the PaperMoon root.

1. Run `pnpm check:patches:source` before editing. Investigate differences before resetting the checkout.
2. Edit the final source in `dsh/`, preserving DSH’s code and runtime constraints. Update the affected tests and direct contracts.
3. Use `git apply --numstat` to inspect the owning patch’s paths. Export their complete differences from `HEAD`, including newly assigned files. Make new files visible with `git -C dsh add -N -- path/to/new-file.ts` first.
4. Review the export, update other affected patches or their organization, and run source comparison plus the relevant checks. Keep each file in one patch when moving ownership.

For example, all current changes in the token-meter package share one owner:

```sh
git apply --numstat patches/plugins/token-meter.patch
git -C dsh diff --binary --no-renames HEAD -- \
  packages/llm/token-meter \
  > patches/plugins/token-meter.patch
pnpm check:patches:source
```

Use a whole directory only when every changed file in it belongs to that patch; otherwise list the owned files. Include all earlier differences, not just the latest edit. Review and static analysis use the reconstructed source in the managed checkout.

## Documentation and decisions

Preserve source comments and the affected packages’ necessary bilingual README contracts and pairing records. Update semantics, restrictions and extension points where callers read them. Review both languages before recording pairs with the checked-out DSH command.

Full-site architecture and reference pages retain their upstream baseline; they do not describe every PaperMoon extension. Patches do not synchronize those pages, their generated documentation or DSH Agent Notes. Runtime-generated code, recorded snapshots and test inputs remain maintained artifacts, including Markdown used as test data.

Keep patch rationale in the owning main-repository [Agent Note](../.agents/notes/README.md). When consolidating earlier records, preserve distinct reasons, alternatives, constraints and verification evidence, then repair references. Package contracts and decision records each retain one maintained home.

## Verification and generated artifacts

| Command | Purpose |
|---|---|
| `pnpm check:patches:source` | Reconstructs the patches in a temporary checkout, compares them with `dsh/` and rejects duplicate file ownership or undeclared source |
| `pnpm check:patches` | Compares source, runs registered DSH checks, then compares source again |

The manifest’s checks name DSH package scripts and argument arrays, executed without shell interpolation. A nonempty patch list requires checks. Choose evidence under [testing and delivery](../docs/testing.md#dsh-patches): behavior tests, recorded replay, type checking, lint and runtime-catalog checks. Checks must not rewrite source or expected results. Full-site documentation synchronization is outside this scope.

Host API generation supports `pnpm -C dsh run gen-cordis-catalog --runtime-only`; freshness checking uses `pnpm -C dsh run verify-cordis-catalog --runtime-only`. Other runtime catalogs retain their DSH generation commands. Review and export regenerated differences; setup applies the saved patches without running generators.

For mechanical regrouping, compare the reconstruction with the previous source before changing the managed checkout. Behavior changes require their corresponding tests. Source comparison excludes ignored build outputs and runtime files; patch application checks added-source whitespace while preserving context spaces.

## Promoting patches to plugins

Local corrections remain patches by default. Consider promoting a coherent part of the patched functionality when it has a clear boundary through DSH extension points or profile composition, PaperMoon needs to maintain its behavior independently, and plugin source is clearer to maintain than an upstream difference.

Assess responsibilities and dependencies, not line, file or patch counts. Promotion need not move a whole patch or copy a whole bundled plugin. Changes spreading into shared formats or many consumers need a design review.

Maintain the promoted plugin under main-repository rules. Preserve the upstream source, base and license for derived code; compose the plugin through the profile and verify its DSH interactions. Remove transferred differences and regroup what remains. The [maintenance decision](../.agents/notes/implemented/architecture/2026-09-18-patch-maintenance.md) records the rationale and current organization.
