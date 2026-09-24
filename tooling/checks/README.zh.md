# 主仓库检查

[English](README.md) | 中文

## 归属与来源

主库检查实现 PaperMoon 选定的维护规则，不导入 DSH 私有脚本或扫描子模块。改编的 Markdown、链接和归档验证器及测试记录在 `provenance.json` 中，包含官方来源提交、原文件摘要及适配说明。`DSH-LICENSE` 保留 MIT 声明。后续适配作为主库变更审查，Gitlink 不会更新这些文件。

## 配置与命令

`config.json` 按文件路径登记配对豁免及理由、英文字数上限和类型摘录。检查器自动查找主仓库的 Markdown 文件。豁免或字数上限指向不存在的文件、译文缺少原文时，检查会报错。检查器也会拒绝符号链接源码，排除依赖、DSH、运行数据和仓库根目录下的 `tmp/`。`tmp/` 中的临时调研资料无需逐项登记豁免；嵌套的同名目录仍在检查范围内。

```sh
pnpm check:docs
pnpm check:notes
pnpm docs:record README.md docs/development.md
pnpm note --help
```

先审阅两种语言，再记录哈希。记录命令检查结构后，只更新选定活跃文档的一致性文件。归档记录只能由归档命令创建。中英文档的结构和技术字面量必须一致；哈希标明审阅的是哪一版文本，不能证明翻译准确。

TypeScript 示例使用主库编译配置，导入相对于文档解析，不写入源码文件。`ts type-equiv Name` 代码块必须登记对应的 `typeExcerpts` 条目，包含 `document`、`symbol` 和 `source`。检查器去除注释和导出修饰符后，比较接口、类型别名和枚举声明。

## 限制

检查器验证文档结构。写作质量、测试选择是否合适、整合后的 Note 是否保留原有理由，由审查者判断。主仓库检查不执行 DSH 的 SDK、生成目录、包结构或真实模型检查规则。[测试规范](../../docs/testing.zh.md)说明交付所需的人工审查和集成检查。
