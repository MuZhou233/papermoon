# Development

English | [中文](development.zh.md)

## Setup and commands

Use the Node and pnpm versions declared at the root. Install main dependencies before invoking repository tools. Scripts report outdated dependencies rather than installing them automatically. The Gitlink in the main repository’s index determines the DSH version, including any update you have staged.

| Command | Effect |
|---|---|
| `pnpm run setup` | Reset DSH, apply registered patches, install locked DSH dependencies |
| `pnpm build` | Clean declared DSH build outputs and run its official build |
| `pnpm start -- --port 3081 --no-open` | Start original Web; pass arguments as separate argv elements |
| `pnpm check` | Main type, lint, tests, docs and Notes |
| `pnpm check:docs` | Main documentation and checker provenance |
| `pnpm check:notes` | Active Notes and immutable archives |
| `pnpm check:patches` | Reconstructed source plus declared DSH delivery checks |
| `pnpm test:smoke` | Start a temporary Web process to verify the build without calling a model |

The package script named setup must be invoked as `pnpm run setup`: `pnpm setup` is reserved by pnpm. Automation uses the explicit script form.

## Editing and upgrading

Keep custom plugins in the main repository and preserve source customization in [patches](../patches/README.md). Initialization removes untracked, non-ignored files inside DSH; it never performs an ignored-file purge. Export intended source changes before rerunning setup. Keep user data outside that managed checkout.

To change DSH, select an official commit, stage the new Gitlink, update patches and their required checks, then run setup, build, patch checks and smoke. Changes to main checker sources are reviewed separately; they do not follow the Gitlink automatically. Package locks remain independent.

## Troubleshooting

If build artifacts are missing, the launcher asks you to build first. Rerun the build command to update existing artifacts. If a patch fails to apply, setup restores the source pinned by the Gitlink and stops; fix the patch before rerunning setup. Patch verification rejects unknown check scripts, undeclared files and source differences.

Initialization does not start a server. Web stays attached to the terminal; stop it with the normal interrupt or termination signal. The smoke test uses temporary data and a random loopback port and waits for shutdown. [Testing](testing.md) describes delivery evidence.
