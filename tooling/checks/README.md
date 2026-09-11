# Main-repository checks

English | [中文](README.zh.md)

## Ownership and source

The main checks implement PaperMoon's selected maintenance rules. They never import private DSH scripts or scan the submodule. Derived Markdown, link and archive validators and their tests are listed in `provenance.json`, with the official source commit, original file digest and adaptation summary. `DSH-LICENSE` retains the MIT notice. Review future adaptations as main-repository changes; the Gitlink does not update these files.

## Configuration and commands

`config.json` registers pairing exemptions by file path and reason, English word limits and type excerpts. The checker discovers main-repository Markdown files automatically. It rejects exemptions for missing files, translations without source documents and word-limit entries for missing documents. It also rejects symlinked sources and excludes dependencies, DSH and runtime data.

```sh
pnpm check:docs
pnpm check:notes
pnpm docs:record README.md docs/development.md
pnpm note --help
```

Review both languages before recording their hashes. The recording command checks structure, then updates only the selected active documents’ pairing files. Only the archive command creates archive records. English and Chinese documents must have matching structure and literal technical content; the hashes identify the reviewed text but do not prove that the translations agree.

TypeScript examples use the main compiler configuration and resolve imports relative to the document without writing source files. A `ts type-equiv Name` fence must have a `typeExcerpts` entry with `document`, `symbol` and `source`; interfaces, type aliases and enums are compared as declarations without comments or export modifiers.

## Limits

Checks verify document structure. Reviewers assess writing quality, test selection and whether consolidated Notes preserve the original reasoning. Main checks do not enforce DSH’s SDK, generated-catalog, package-structure or live-model policies. [Testing](../../docs/testing.md) explains the human review and integration checks required for delivery.
