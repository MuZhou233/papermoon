# Development

English | [中文](development.zh.md)

## Setup and commands

Use the Node and pnpm versions declared at the root. Install main dependencies before invoking repository tools. Repository scripts report outdated dependencies rather than installing them automatically. The Gitlink in the main repository’s index determines the DSH version, including any update you have staged.

| Command | Effect |
|---|---|
| `pnpm run setup` | Reset DSH, apply registered patches, install locked DSH dependencies |
| `pnpm build` | Build main plugins, then clean declared DSH outputs and run its official build |
| `pnpm build:plugins` | Build main plugins without DSH |
| `pnpm check:compiler:built` | Run built compiler Worker and independent runtime under plain Node |
| `pnpm check:plugins:pure` | Check built pure core and writer-context entries with Node built-ins and Cordis imports blocked |
| `pnpm check:plugins:dsh` | Check storage/core/writer lifecycles and scoped Playbook tools against actual DSH Cordis |
| `pnpm start -- --port 3081 --no-open` | Start PaperMoon over Web; pass arguments as separate argv elements |
| `pnpm start:dsh -- --port 3081 --no-open` | Start original Web without product plugins |
| `pnpm test:story-mode` | Exercise Chapter 0 with a deterministic local adapter |
| `pnpm test:editor` | Verify the editor and writer manager in Chromium against a temporary Web process |
| `pnpm test:writer-sessions` | Verify writer admission, literal requests and recovery with a deterministic adapter |
| `pnpm check` | Main type, lint, tests, docs and Notes |
| `pnpm check:docs` | Main documentation and checker provenance |
| `pnpm check:notes` | Active Notes and immutable archives |
| `pnpm check:patches:source` | Compare reconstructed patches with DSH source without running delivery checks |
| `pnpm check:patches` | Reconstructed source plus declared DSH delivery checks |
| `pnpm test:smoke` | Start a temporary Web process to verify the build without calling a model |

The package script named setup must be invoked as `pnpm run setup`: `pnpm setup` is reserved by pnpm. Automation uses the explicit script form.

The [PaperMoon composition](../profiles/papermoon/README.md) mounts product extensions through native DSH bundles in the `papermoon` profile. Story Mode is enabled initially and can be switched in Plugins; its installed bundle remains available when disabled. Profile configuration lives under `$DSH_HOME/profiles/papermoon/`; the former `web` profile remains untouched and is used by `pnpm start:dsh`. Configure the new profile through Settings; startup does not copy old profile settings. It also does not rebuild plugins: run `pnpm build:plugins` after changing main plugin or UI sources. Browser tests need built DSH artifacts and Chromium, installed with `pnpm exec playwright install chromium`.

## Editing and upgrading

Keep custom plugins in the main repository and preserve source customization in [patches](../patches/README.md). Initialization removes untracked, non-ignored files inside DSH; it never performs an ignored-file purge. Export intended source changes before rerunning setup. Keep user data outside that managed checkout.

To change DSH, select an official commit, stage the new Gitlink, update patches and their required checks, then run setup, build, patch checks and smoke. Changes to main checker sources are reviewed separately; they do not follow the Gitlink automatically. Package locks remain independent.

## Tool writing

Write tool descriptions, parameter and result explanations, and help in declarative or imperative sentences. Describe capabilities objectively, using DSH file-editing tools as the reference for how much information to disclose. Include what callers need to choose a tool, call it and interpret the result.

Tool descriptions state purpose and effects. Parameter descriptions explain inputs, defaults and necessary restrictions. Result descriptions explain returned values. Help provides API rules and examples.

Omit irrelevant limitations, redundant explanations and internal mechanics that do not affect a call. Document persistence and retry details in engineering guides; explain a sequence or identifier in tool text when the caller needs to use it. Do not add creative requirements, mandatory checking routines or instructions to report internal state to the user.

## Troubleshooting

If build artifacts are missing, the launcher asks you to build first. Rerun the build command to update existing artifacts. If a patch fails to apply, setup restores the source pinned by the Gitlink and stops; fix the patch before rerunning setup. Patch verification rejects unknown check scripts, undeclared files and source differences.

Initialization does not start a server. Web stays attached to the terminal; stop it with the normal interrupt or termination signal. The smoke test uses temporary data and a random loopback port and waits for shutdown. [Testing](testing.md) describes delivery evidence.

Writer settings share the product data directory selected by `PAPERMOON_DATA_DIR`, using an independent `writers.sqlite`. The profile does not register Playbook tools globally. Client plugin bundling is shared in `tooling/repository/build-clients.ts`.

Host bundles leave PaperMoon package imports external so Worker paths resolve beside their owning emitted modules. Source aliases remain enabled for browser bundles and main source tests.

## Workspace registration format

Playbook workspaces register under papermoon-playbook in DSH's workspace registry. The default registry path is `.papermoon/dsh/storages/workspace.json`; an explicit `DSH_HOME` changes the parent directory. DSH owns the registry's format and persistence contract.

## Compiled artifacts

The compiler plugin's directory defaults to `.papermoon/compiled-playbooks/`, beneath `PAPERMOON_DATA_DIR` when supplied. Each content-addressed JSON file is an independent derived result; draft changes and project deletion do not delete it. No automatic collection or failed-attempt history is maintained. To clear compiled results, stop the service and remove only the configured compiled-playbooks directory. This also removes restart previews until the corresponding content is explicitly compiled again. Keep authored databases and other product data intact.

Compilation uses no experimental Node flags. The built-worker check prints the actual Node version; CI runs its selected Node 24 release independently. Source tests and production builds use their own emitted/source module paths.

## Frozen revision data

PaperMoon currently maintains only the current product format. It has no product format version numbers, historical readers, migrations or compatibility test matrix. Tests cover current behavior, structural validation and data integrity. Dependency versions and DSH protocol fields remain governed by their own contracts.

Playbook storage uses application ID 0x504d5042. Its default file is playbook.sqlite under PAPERMOON_DATA_DIR, or .papermoon when unset. Business KV and compiled artifacts use the papermoon.playbook identity. After a change to the data structure, create fresh development data: create a Playbook, submit a revision and start a session. Authored programs use playbook.js, require('@papermoon/playbook') and definePlaybook.

The compiled-playbooks directory contains independent draft checks; authoritative revision artifacts reside inside Playbook SQLite, and running performances retain their own logged copies. Structural validation and checksums still detect malformed or damaged records; removing format versioning does not remove these checks.

Editor backups reside in the papermoon-playbook-editor browser database. Reader and writer code use the same current structure.

## Context artifact formats

Context composition uses compiler identity papermoon.playbook.commonjs and follows the [current data rules](#frozen-revision-data). Submitted revisions cannot be supplemented with a new artifact. [The API](../plugins/playbook-compiler/api.md#context-composition) defines composition inputs and limits.
