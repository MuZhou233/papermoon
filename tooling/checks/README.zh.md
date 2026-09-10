# 主仓库检查

[English](README.md) | 中文

## 归属与来源

主库检查实现 PaperMoon 选定的维护规则，不导入 DSH 私有脚本或扫描子模块。改编的 Markdown、链接和归档验证器及测试记录在 `provenance.json` 中，包含官方来源提交、原文件摘要及适配说明。`DSH-LICENSE` 保留 MIT 声明。后续适配作为主库变更审查，Gitlink 不会更新这些文件。

## 配置与命令

`config.json` 保存带理由的精确配对豁免、英文字数预算及类型摘录登记。主库 Markdown 文件自动发现。过期豁免、孤立翻译和缺失的预算目标都会失败。主库源码中的符号链接会被拒绝，不跟随依赖、DSH 或运行数据。

```sh
pnpm check:docs
pnpm check:notes
pnpm docs:record README.md docs/development.md
pnpm note --help
```

记录命令在结构验证后仅重写选定的活跃双语一致性文件。先审查语言质量。归档记录只能通过归档操作创建。英中结构和技术字面量保持对应，哈希表示内容已审阅，不代表语义等价。

TypeScript 示例使用主库编译配置，导入相对于文档解析，不写入源码文件。`ts type-equiv Name` 代码块必须有`typeExcerpts` 条目，包含 `document`、`symbol` 和 `source`；接口、类型别名和枚举去除注释及导出修饰符后比较声明。

## 限制

检查保证可机械验证的结构，不判断编辑质量、测试选择或 Note 整合的语义完整性。主库检查不实现 DSH 的 SDK、生成目录、包结构或真实模型制度。[测试规范](../../docs/testing.zh.md)划分人工审查和集成证据。
