# DSH patches

English | [中文](README.zh.md)

## Source ownership

The parent Gitlink selects the official DSH base. `series.json` lists patch files in application order and the DSH package scripts needed for delivery. Empty patches and checks describe an unchanged upstream. Every nonempty series requires explicit checks; their sufficiency is reviewed using the submodule's instructions.

Patch files are the durable source of customization. Export intended changes before `pnpm run setup`; initialization resets tracked changes and removes non-ignored untracked files in DSH. It does not erase ignored credentials, dependencies or parent runtime data. Do not put independent work inside this managed checkout.

## Series format

```json
{
  "version": 1,
  "patches": ["0001-extension.patch"],
  "checks": [{ "script": "test", "args": ["-t", "extension"] }]
}
```

The example illustrates serialization, not sufficient checks for every patch. Script names must exist in the patched DSH package manifest. Argument arrays are passed without a shell. Do not register commands that modify expected outputs as verification. Preserve DSH-required tests, docs and Notes in each patch; a parent Note is required only for a separate main-repository decision.

Generate Git patches with binary data when needed. Patch paths remain within DSH; symlinked parent paths and external worktrees are rejected. Apply uses the Git index and stops on errors without three-way merging. A failure restores the upstream base and prevents installation.

## Verify and update

`pnpm check:patches` reconstructs a temporary checkout, compares effective source with the actual submodule, rejects undeclared files, runs registered checks in DSH and compares source again. It accepts the modifications defined by patches rather than requiring a clean worktree. Ignored build and runtime files are outside the source comparison.

Select tests under the DSH rules for the pinned revision; the command runner does not infer those obligations. [Development](../docs/development.md) describes the complete upgrade sequence. Record executed checks in delivery evidence, not a duplicated copy of DSH's rules.
