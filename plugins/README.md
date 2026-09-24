# PaperMoon plugins

English | [中文](README.zh.md)

Product plugins live here and follow the main repository's maintenance rules. The [playbook storage plugin](playbook-storage/README.md) owns persistence; the [logic core](playbook-core/README.md) defines authored content and business operations. The [manual editor](playbook-editor/README.md) owns browser operations and pages. The main workspace discovers packages in this directory’s immediate subdirectories.

Use DSH's available plugin interfaces for integration. API usage requirements do not import DSH's internal package layout or delivery policy. Necessary DSH source changes belong in [patches](../patches/README.md), with separate submodule evidence. Describe a plugin's actual configuration and user-visible behavior in its own bilingual README when it is introduced.

[Writer management](writers/README.md) owns prompt settings and initial-context preview. [Playbook tools](playbook-tools/README.md) own the executable catalog and scoped DSH registration. Neither module starts model conversations. [Writer sessions](writer-sessions/README.md) connect definitions and tools to playbook workspaces and own session configuration, context freezing and observation policy.
