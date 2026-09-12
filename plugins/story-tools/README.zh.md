# 剧本工具

[English](README.md) | 中文

## 用途

`@papermoon/story-tools` 封装[逻辑核心](../story-core/README.zh.md)，供未来面向模型的接口调用。`createStoryTools(repository, scriptId)` 创建绑定单个剧本的可执行工具集。`toolCatalog()` 提供与注册时相同的名称、说明、参数声明、结果声明和读写分类。两个 API 均不创建 Session，也不调用模型。

## 工具

| 分组 | 工具 | 操作 |
|---|---|---|
| 状态 | `story_status` | 剧本与草稿身份、序号、语言及数量 |
| 程序 | `story_program_list`, `story_program_read`, `story_program_search`, `story_program_edit` | 文件查询、完整源码读取、字面搜索和原子程序修改 |
| 文案 | `story_text_list`, `story_text_read`, `story_text_search`, `story_text_edit` | 条目查询、指定语言读取、搜索、语言、用途说明、译文及元数据 |
| 历史 | `story_history`, `story_commit`, `story_diff`, `story_restore` | 元数据、不可变修订版本、业务内容差异及内容恢复 |
| 帮助 | `story_help` | 按主题提供用法、失败条件和小例子 |

程序和文案分别使用自己的修改列表。两者都要求 `expectedSequence`；操作失败或序号过期时不保存任何修改。程序的 `replace-text` 要求 `oldText` 非空且仅匹配一次，重叠匹配也计入次数。替换保留周围源码及其换行。结构约束按整批操作的最终结果校验。写入成功后返回新序号和受影响对象，不回传全部源码。

文案读取区分语言未登记、条目不存在和译文缺失。空译文仍视为存在，不进行语言回退。删除默认语言时，必须在同批操作中选定另一种语言。元数据整体替换沿用核心规则。

读取默认访问当前绑定剧本的草稿。修订版本引用必须属于该剧本的保留目录，比较、恢复及提交来源中的引用也遵循此规则。列表结果省略正文，具体读取返回所需内容。分页沿用核心的默认 100 项、最多 1000 项；续读草稿要求已知序号。差异包含业务值，不生成行差异，也不推断重命名。提交要求非空白说明，不编译、发布或批准内容。

## DSH 接入

`/plugin` 导出 `registerStoryTools(scope, repository, scriptId)`。调用方提供独立 DSH scope，并负责其生命周期。注册通过 effect 完成，同时返回卸载函数。只读工具允许 DSH 并发调度，修改工具保持独占执行。参数按目录中的 schema 校验，输出为规范 JSON，由 DSH 渲染为文本。执行前取消不会修改数据；同步仓库操作在事务提交点结束。

名称、说明和参数声明来自注册目录。帮助正文仅在调用 `story_help` 后作为结果进入模型历史，注册不会把它追加到编剧提示词。

默认 Web profile 不将这些工具注册到全局。编剧管理页仅读取目录，没有执行接口。本模块不增加执行循环、自动重试、仓库摘要注入、文件已读策略、宿主文件工具或项目管理工具。

## 验证

运行 `pnpm exec vitest run plugins/story-tools/tests`，通过临时数据库验证确定性场景。`pnpm build:plugins` 后，`pnpm check:plugins:dsh` 检查真实 Cordis 注册、schema、执行、独立 scope、取消、输出拒绝和清理。主库单元测试不需要 DSH。[设计记录](../../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.zh.md) 说明这些选择。
