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

Generate Git patches with binary data when needed. Patches may modify only files within DSH. DSH must be a submodule of the main repository, not a symlink or an external worktree. Patch files and their parent directories must not be symlinks either. The parent Git whitespace check permits trailing whitespace only in patch artifacts, whose blank context lines require a space marker. Actual source additions are checked by `git apply --whitespace=error` during reconstruction. Patches are applied through the Git index without three-way merging. If application fails, setup stops, restores the upstream base and skips dependency installation.

## Registered capabilities

The series separates resource workspaces, durable prompt admission with authored context, client selection/message extensions, and initialized-session presentation. These patches contain generic DSH behavior; script rules and writer snapshots stay in PaperMoon plugins. Registered checks cover the affected host/client tests, both compiler faces, lint, documentation and keyless session replay. CI also runs the Python SDK client tests in the submodule.

## Verify and update

`pnpm check:patches` reconstructs a temporary checkout, compares effective source with the actual submodule, rejects undeclared files, runs registered checks in DSH and compares source again. It accepts the modifications defined by patches rather than requiring a clean worktree. Ignored build and runtime files are outside the source comparison.

Select tests under the DSH rules for the pinned revision; the command runner does not infer those obligations. [Development](../docs/development.md) describes the complete upgrade sequence. Report which checks ran and their results; link to DSH’s rules instead of maintaining another copy.

Registered DSH checks use the same CI package-manager environment as setup, so dependency-layout verification does not attempt a second installation or local Git hook setup.

The inclusive-union patch extends tool schema validation and both language type renderers with anyOf. The retained-outcome patch allows a failed tool receipt to be corrected from earlier durable evidence while preserving its message and call identity. Both use existing registration and Session mechanisms, without product-specific rules.

The typed-dictionary patch validates schema-valued additionalProperties and projects dictionary types. The reply-visibility patch provides effect-owned Client registrations for presets that keep intermediate Assistant text visible. PaperMoon registers the moderator preset; the DSH default remains unchanged.

The tool-argument diagnostic patch preserves JSON parser failures in ordinary tool error results, including available locations. Malformed arguments do not execute tools; valid JSON continues through parameter validation.

The execution-history patch adds retained-range selection, request reconstruction, admission deduplication and client selection/action extensions. PaperMoon owns the worldline tree and restores script state from its selected path. The patch also covers both SDKs and preserves frozen Session format generations.

The request-assembly patch records per-request message references and authored text independently of transcript selection. The Loop, replay and invariant use the same resolver. PaperMoon owns script composition and its inspection page.

The trajectory-inspection patch adds Session-local readonly sources, ordered context records and navigation slots. PaperMoon supplies node selection and dual-mode data; the shared DSH ledger retains search, details, tool associations and request inspection. It does not change Session formats.

Reroll and edited resubmission use shared user-input admission in the execution-history patch. The chat action slots remain generic; message source determines bubble and trajectory classification.
