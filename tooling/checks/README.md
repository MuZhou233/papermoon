# Main-repository checks

English | [中文](README.zh.md)

## Ownership and source

The main checks implement PaperMoon's selected maintenance rules. They never import private DSH scripts or scan the submodule. Derived Markdown, link and archive validators and their tests are listed in `provenance.json`, with the official source commit, original file digest and adaptation summary. `DSH-LICENSE` retains the MIT notice. Review future adaptations as main-repository changes; the Gitlink does not update these files.

## Configuration and commands

`config.json` contains exact pairing exemptions with reasons, English word budgets and registered type excerpts. Main Markdown files are discovered automatically. Stale exemptions, orphan translations and missing budget targets fail. Symlinked main sources are rejected; dependencies, DSH and runtime data are not followed.

```sh
pnpm check:docs
pnpm check:notes
pnpm docs:record README.md docs/development.md
pnpm note --help
```

Recording rewrites only the selected active bilingual sidecars after structural validation. Review language quality first. Archive records can only be created by the archival operation. English and Chinese maintain corresponding structure and technical literals; hashes acknowledge reviewed content, not semantic equivalence.

TypeScript examples use the main compiler configuration and resolve imports relative to the document without writing source files. A `ts type-equiv Name` fence must have a `typeExcerpts` entry with `document`, `symbol` and `source`; interfaces, type aliases and enums are compared as declarations without comments or export modifiers.

## Limits

Checks enforce machine-verifiable structure, not editorial quality, appropriate test selection or the semantic completeness of a consolidated Note. Main checks do not implement DSH SDK, generated-catalog, package-structure or live-model policies. [Testing](../../docs/testing.md) assigns human review and integration evidence.
