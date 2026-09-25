# PaperMoon composition

English | [中文](README.zh.md)

`@papermoon/extensions` is a DSH bundle that mounts the ordinary PaperMoon extensions, including reusable text conversations. The launcher selects it alongside the official base/Web bundles and the separately switchable Story Mode bundle in the `papermoon` profile.

The launcher creates local links to the maintained packages and initializes profile selection only when its manifest does not exist. DSH owns user configuration, bundle selection and hot reload. No product overlay is forced above those choices. `pnpm start:dsh` continues to use the original `web` profile.
