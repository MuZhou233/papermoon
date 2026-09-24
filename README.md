# PaperMoon

English | [中文](README.zh.md)

PaperMoon is a DSH distribution for AI-driven interactive storytelling, providing a frontend for LLM-driven text adventure games and roleplay.

## Current implementation

The [manual editor](plugins/playbook-editor/README.md) provides a playbook overview, program and multilingual-text editing, immutable revisions, comparison, copying and restoration. It uses the [logic core](plugins/playbook-core/README.md) and independent [storage](plugins/playbook-storage/README.md). The [writer manager](plugins/writers/README.md) edits system prompts and initial messages and displays the built-in playbook tools. [Writer sessions](plugins/writer-sessions/README.md) connect those definitions and tools to playbook workspaces while preserving ordinary DSH chats. The [compiler](plugins/playbook-compiler/README.md) freezes CommonJS starting contexts into saved artifacts for preview and initialization.

## Start

Use Node 24 and pnpm 11.7.0 from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start -- --no-open
```

Use `pnpm run setup`, not pnpm's built-in `pnpm setup` shell-configuration command. Setup discards source edits in the DSH submodule that have not been exported as patches. It preserves Git-ignored configuration and main-repository data. Run the build separately; start never installs dependencies, builds or resets sources.

DSH runtime data defaults to `.papermoon/dsh` and `.papermoon/agents`. Explicit `DSH_HOME` and `DSH_AGENTS_HOME` override these paths. Playbook storage and writer settings default to `.papermoon/playbook.sqlite` and `.papermoon/writers.sqlite`; `PAPERMOON_DATA_DIR` overrides their parent directory. DSH resolves credentials using its normal environment and configuration mechanism; the root `.env` is ignored by Git. The default session workspace is the PaperMoon root.

## Maintain

[Story mode requirements](docs/story-mode/README.md) organize planned experiences by chapter. Playbooks define backgrounds, openings and interaction mechanisms; performances unfold from them. Story mode is planned and has no runtime plugin yet.

Plugins and tooling are maintained in this repository; the `dsh/` Git submodule pins the upstream version.

[Development](docs/development.md) covers commands and troubleshooting. [Architecture](docs/architecture.md) explains which repository maintains each part, and [Testing](docs/testing.md) lists the required checks. [Patch maintenance](patches/README.md) explains how to customize DSH; [Agent Notes](.agents/notes/README.md) record main-repository decisions and their reasons.
