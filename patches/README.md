# DSH patches

English | [中文](README.zh.md)

## Source ownership

The main repository’s Gitlink selects the official DSH base. `series.json` lists patches in application order and the DSH package scripts required for delivery. Empty patch and check lists mean that DSH is unchanged. Every nonempty patch list must declare checks; reviewers use the submodule’s instructions to assess whether those checks cover the changes.

Patch files are the durable source of customization. Export intended changes before `pnpm run setup`; initialization resets tracked changes and removes non-ignored untracked files in DSH. It does not erase ignored credentials, dependencies or parent runtime data. Do not put independent work inside this managed checkout.

## Series format

```json
{
  "version": 1,
  "patches": ["0001-extension.patch"],
  "checks": [{ "script": "test", "args": ["-t", "extension"] }]
}
```

The example shows the file format; choose checks that cover your actual patch. Script names must exist in the patched DSH package manifest. Argument arrays are passed without a shell. Do not register commands that modify expected outputs as verification. Preserve DSH-required tests, docs and Notes in each patch; a parent Note is required only for a separate main-repository decision.

Generate Git patches with binary data when needed. Patches may modify only files within DSH. DSH must be a submodule of the main repository, not a symlink or an external worktree. Patch files and their parent directories must not be symlinks either. Patches are applied through the Git index without three-way merging. If application fails, setup stops, restores the upstream base and skips dependency installation.

## Verify and update

`pnpm check:patches` reconstructs a temporary checkout, compares effective source with the actual submodule, rejects undeclared files, runs registered checks in DSH and compares source again. It accepts the modifications defined by patches rather than requiring a clean worktree. Ignored build and runtime files are outside the source comparison.

Select tests under the DSH rules for the pinned revision; the command runner does not infer those obligations. [Development](../docs/development.md) describes the complete upgrade sequence. Report which checks ran and their results; link to DSH’s rules instead of maintaining another copy.
