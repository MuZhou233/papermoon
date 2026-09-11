# PaperMoon maintenance

PaperMoon is a DSH distribution for AI-driven interactive storytelling. Read [architecture](docs/architecture.md) for its product role and repository responsibilities, and [development](docs/development.md) for commands.

## Ownership

Rules follow the effective change: modifications applied inside the DSH submodule follow that checkout's instructions and delivery requirements. Main-repository files follow this file and its linked PaperMoon rules. DSH patch requirements do not extend to the whole parent commit. A patch's DSH Agent Note stays in the patch; do not duplicate its decision in a main-repository Note. See [patch maintenance](patches/README.md).

Do not edit the managed DSH checkout without preserving intended changes in registered patches. Initialization resets that checkout. Keep runtime data and credentials outside it.

## Main-repository work

Use ESM and strict TypeScript. Explain public operations and non-obvious restrictions where callers use them; do not require comments that repeat code. Keep dependencies and checks independent of DSH's private maintenance scripts. Plugins may consume DSH interfaces without adopting its internal package layout or delivery system.

Update the owning documentation and tests with behavior. Every non-trivial main-repository change adds or updates an owning [Agent Note](.agents/notes/README.md); purely mechanical or local edits are exempt. Search existing decisions before adding another Note. Rules and rationale each have one maintained home.

Human-facing documentation is bilingual. Follow [documentation rules](docs/AGENTS.md). Derived checker code retains its [provenance](tooling/checks/README.md) and license. Do not import historical product files, prompts, or data formats into this repository.

Run [relevant checks](docs/testing.md) and report commands actually executed. CI checks the complete main repository. Product experience remains a separate user-feedback judgment; main-repository delivery does not require live-model recordings, GIFs or per-file coverage quotas. DSH patches retain their own evidence requirements.

Use explicit commands and CI; do not install a separate main-repository Git hook system. Never commit credentials, runtime data or generated dependency directories. Keep exactly one trailing newline in text files. Do not push unless requested.

## Workflow entrypoints

Use the [bilingual writing guide](.agents/skills/bilingual-syntax-style-guide/SKILL.md) when writing, rewriting or polishing Chinese and English prose.

Use [documentation maintenance](.agents/skills/papermoon-docs/SKILL.md) for bilingual edits, [Note maintenance](.agents/skills/papermoon-notes/SKILL.md) for lifecycle decisions, and [delivery checks](.agents/skills/papermoon-checks/SKILL.md) to distinguish parent and patch evidence.
