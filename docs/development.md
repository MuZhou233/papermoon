# Development

English | [中文](development.zh.md)

## Setup and commands

Use the Node and pnpm versions declared at the root. Install main dependencies before invoking repository tools. Scripts report outdated dependencies rather than installing them automatically. The Gitlink in the main repository’s index determines the DSH version, including any update you have staged.

| Command | Effect |
|---|---|
| `pnpm run setup` | Reset DSH, apply registered patches, install locked DSH dependencies |
| `pnpm build` | Build main plugins, then clean declared DSH outputs and run its official build |
| `pnpm build:plugins` | Build main plugins without DSH |
| `pnpm check:plugins:pure` | Check built pure core and writer-context entries with Node built-ins and Cordis imports blocked |
| `pnpm check:plugins:dsh` | Check storage/core/writer lifecycles and scoped script tools against actual DSH Cordis |
| `pnpm start -- --port 3081 --no-open` | Start PaperMoon over Web; pass arguments as separate argv elements |
| `pnpm start:dsh -- --port 3081 --no-open` | Start original Web without product plugins |
| `pnpm test:editor` | Verify the editor and writer manager in Chromium against a temporary Web process |
| `pnpm check` | Main type, lint, tests, docs and Notes |
| `pnpm check:docs` | Main documentation and checker provenance |
| `pnpm check:notes` | Active Notes and immutable archives |
| `pnpm check:patches` | Reconstructed source plus declared DSH delivery checks |
| `pnpm test:smoke` | Start a temporary Web process to verify the build without calling a model |

The package script named setup must be invoked as `pnpm run setup`: `pnpm setup` is reserved by pnpm. Automation uses the explicit script form.

The [PaperMoon composition](../profiles/papermoon/cordis.patch.yml) mounts storage, core, editor and writer-management plugins through the official profile overlay. It is configuration, not a source patch. Startup does not rebuild plugins; use `pnpm build:plugins` after changing main plugin or UI sources. Browser tests need built DSH artifacts and Chromium, installed with `pnpm exec playwright install chromium`.

## Editing and upgrading

Keep custom plugins in the main repository and preserve source customization in [patches](../patches/README.md). Initialization removes untracked, non-ignored files inside DSH; it never performs an ignored-file purge. Export intended source changes before rerunning setup. Keep user data outside that managed checkout.

To change DSH, select an official commit, stage the new Gitlink, update patches and their required checks, then run setup, build, patch checks and smoke. Changes to main checker sources are reviewed separately; they do not follow the Gitlink automatically. Package locks remain independent.

## Troubleshooting

If build artifacts are missing, the launcher asks you to build first. Rerun the build command to update existing artifacts. If a patch fails to apply, setup restores the source pinned by the Gitlink and stops; fix the patch before rerunning setup. Patch verification rejects unknown check scripts, undeclared files and source differences.

Initialization does not start a server. Web stays attached to the terminal; stop it with the normal interrupt or termination signal. The smoke test uses temporary data and a random loopback port and waits for shutdown. [Testing](testing.md) describes delivery evidence.

Writer settings share the product data directory selected by `PAPERMOON_DATA_DIR`, using an independent `writers.sqlite`. The profile does not register script tools globally. Client plugin bundling is shared in `tooling/repository/build-clients.ts`.
