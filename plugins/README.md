# PaperMoon plugins

English | [中文](README.zh.md)

Product plugins live here and follow the main repository's maintenance rules. No runtime plugins are implemented yet. Add a package when a product feature needs one; the main workspace discovers packages in this directory’s immediate subdirectories.

Use DSH's available plugin interfaces for integration. API usage requirements do not import DSH's internal package layout or delivery policy. Necessary DSH source changes belong in [patches](../patches/README.md), with separate submodule evidence. Describe a plugin's actual configuration and user-visible behavior in its own bilingual README when it is introduced.
