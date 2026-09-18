# PaperMoon maintenance

PaperMoon is a DSH distribution for AI-driven interactive storytelling. Read [architecture](docs/architecture.md) for its product role and repository responsibilities, and [development](docs/development.md) for commands.

## Ownership

Main-repository files follow this file and its linked PaperMoon rules. PaperMoon-carried DSH patches follow the checked-out DSH code and runtime constraints, with the documentation and delivery scope defined by [patch maintenance](patches/README.md). That scope replaces DSH's upstream-wide documentation and Note requirements for these patches. Patch decisions belong in the owning main-repository Agent Notes.

Do not edit the managed DSH checkout without preserving intended changes in registered patches. Initialization resets that checkout. Keep runtime data and credentials outside it.

## Main-repository work

Use ESM and strict TypeScript. Explain public operations and non-obvious restrictions where callers use them; do not require comments that repeat code. Keep dependencies and checks independent of DSH's private maintenance scripts. Plugins may consume DSH interfaces without adopting its internal package layout or delivery system.

When adding or changing tools, follow the [tool writing standard](docs/development.md#tool-writing) for descriptions, parameter and result explanations, and help.

Update the owning documentation and tests with behavior. Every non-trivial main-repository change adds or updates an owning [Agent Note](.agents/notes/README.md); purely mechanical or local edits are exempt. Search existing decisions before adding another Note. Rules and rationale each have one maintained home.

Human-facing documentation is bilingual. Follow [documentation rules](docs/AGENTS.md). Derived checker code retains its [provenance](tooling/checks/README.md) and license. Do not import historical product files, prompts, or data formats into this repository.

Before committing, follow the [pre-commit review](docs/testing.md#before-committing) and report checks actually performed. CI checks the complete main repository. Product experience remains a separate user-feedback judgment; main-repository delivery does not require live-model recordings, GIFs or per-file coverage quotas. Select patch evidence under [testing and delivery](docs/testing.md#dsh-patches).

Use explicit commands and CI; do not install a separate main-repository Git hook system. Never commit credentials, runtime data or generated dependency directories. Keep exactly one trailing newline in text files. Do not push unless requested.

## Workflow entrypoints

Use the [bilingual writing guide](.agents/skills/bilingual-syntax-style-guide/SKILL.md) when writing, rewriting or polishing Chinese and English prose.

Use [documentation maintenance](.agents/skills/papermoon-docs/SKILL.md) for bilingual edits, [Note maintenance](.agents/skills/papermoon-notes/SKILL.md) for lifecycle decisions, and [delivery checks](.agents/skills/papermoon-checks/SKILL.md) to distinguish parent and patch evidence.
