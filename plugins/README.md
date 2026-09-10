# PaperMoon plugins

English | [中文](README.zh.md)

Product plugins live here and follow the main repository's maintenance rules. There is no runtime plugin in this foundation. Add a package only when a product capability needs it; the parent workspace discovers direct child packages.

Use DSH's available plugin interfaces for integration. API usage requirements do not import DSH's internal package layout or delivery policy. Necessary DSH source changes belong in [patches](../patches/README.md), with separate submodule evidence. Describe a plugin's actual configuration and user-visible behavior in its own bilingual README when it is introduced.
