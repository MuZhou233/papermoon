# PaperMoon

English | [中文](README.zh.md)

PaperMoon maintains its own plugins and tools around a pinned DSH Git submodule. The shipped launcher opens the original DSH Web application; the patch series is empty and no product plugin is installed.

## Start

Use Node 24 and pnpm 11.7.0 from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start -- --no-open
```

Use `pnpm run setup`, not pnpm's built-in `pnpm setup` shell-configuration command. Setup discards unexported source edits inside the managed submodule. It preserves ignored configuration and main-repository data. Build is explicit; start never installs, builds or resets sources.

Runtime data defaults to `.papermoon/dsh` and `.papermoon/agents`. Explicit `DSH_HOME` and `DSH_AGENTS_HOME` override these paths. DSH resolves credentials using its normal environment and configuration mechanism; the root `.env` is ignored by Git. The default session workspace is the PaperMoon root.

## Maintain

[Development](docs/development.md) explains commands and failures. [Architecture](docs/architecture.md) assigns ownership. [Testing](docs/testing.md) defines evidence. [Patch maintenance](patches/README.md) describes DSH customization; [Agent Notes](.agents/notes/README.md) preserve main-repository decisions.
