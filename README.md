# PaperMoon

English | [中文](README.zh.md)

PaperMoon is a DSH distribution for AI-driven interactive storytelling, providing a frontend for LLM-driven text adventure games and roleplay.

## Current implementation

The repository provides a maintenance framework, the original DSH Web launcher and a [script storage module](plugins/story-storage/README.md) for future product features. Storage has a programmatic API and a loadable service plugin; it has no Web controls yet.

## Start

Use Node 24 and pnpm 11.7.0 from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start -- --no-open
```

Use `pnpm run setup`, not pnpm's built-in `pnpm setup` shell-configuration command. Setup discards source edits in the DSH submodule that have not been exported as patches. It preserves Git-ignored configuration and main-repository data. Run the build separately; start never installs dependencies, builds or resets sources.

Runtime data defaults to `.papermoon/dsh` and `.papermoon/agents`. Explicit `DSH_HOME` and `DSH_AGENTS_HOME` override these paths. DSH resolves credentials using its normal environment and configuration mechanism; the root `.env` is ignored by Git. The default session workspace is the PaperMoon root.

## Maintain

Plugins and tooling are maintained in this repository; the `dsh/` Git submodule pins the upstream version.

[Development](docs/development.md) covers commands and troubleshooting. [Architecture](docs/architecture.md) explains which repository maintains each part, and [Testing](docs/testing.md) lists the required checks. [Patch maintenance](patches/README.md) explains how to customize DSH; [Agent Notes](.agents/notes/README.md) record main-repository decisions and their reasons.
