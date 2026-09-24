# Playbook 工具

[English](README.md) | 中文

## 用途

`@papermoon/playbook-tools` 封装[逻辑核心](../playbook-core/README.zh.md)，供面向模型的接口调用。`createPlaybookTools(repository, playbookId)` 创建绑定单个 Playbook 的可执行工具集。`toolCatalog()` 提供与注册时相同的名称、说明、参数声明、结果声明和读写分类。两个 API 均不创建 Session，也不调用模型。

## 工具

| 分组 | 工具 | 操作 |
|---|---|---|
| 状态 | `playbook_status` | Playbook 与草稿身份、序号、语言及数量 |
| 程序 | `playbook_program_list`, `playbook_program_read`, `playbook_program_search`, `playbook_program_edit` | 文件查询、完整源码读取、字面搜索和原子程序修改 |
| 文案 | `playbook_text_list`, `playbook_text_read`, `playbook_text_search`, `playbook_text_edit` | 条目查询、指定语言读取、搜索、语言、用途说明、译文及元数据 |
| 历史 | `playbook_history`, `playbook_commit`, `playbook_diff`, `playbook_restore` | 元数据、不可变修订版本、业务内容差异及内容恢复 |
| 编译 | `playbook_compile`, `playbook_simulate` | 固定草稿编译与临时函数执行 |
| 帮助 | `playbook_help` | 按主题提供用法、失败条件和小例子 |

程序和文案分别使用自己的修改列表。两者都不接受批次级 `expectedSequence`。会话工具将受影响对象与读取记录比较，分别修改文件或译文时无需刷新整份草稿序号。对象校验或操作失败时，不保存任何修改。程序的 `replace-text` 要求 `oldText` 非空且仅匹配一次，重叠匹配也计入次数。替换保留周围源码及其换行。结构约束按整批操作的最终结果校验。写入成功后返回新序号和受影响对象，不回传全部源码。

文案读取区分语言未登记、条目不存在和译文缺失。空译文仍视为存在，不进行语言回退。`delete-language` 操作单独携带 `expectedSequence`，因为它会删除该语言的全部译文；序号过期时拒绝整批操作。删除默认语言时，必须在同批操作中选定另一种语言。会话修改默认语言前，需要通过 `playbook_status` 读取其当前值。元数据整体替换沿用核心规则。

读取默认访问当前绑定 Playbook 的草稿。修订版本引用必须属于该 Playbook 的保留目录，比较、恢复及提交来源中的引用也遵循此规则。列表结果省略正文，具体读取返回所需内容。分页沿用核心的默认 100 项、最多 1000 项；续读草稿要求已知序号。差异包含业务值，不生成行差异，也不推断重命名。提交和恢复仍要求整份草稿的 `expectedSequence`。提交保存完整草稿内容，修订版本说明由调用方提供，不能全为空白。可选的 `references` 接受 `playbook_history` 中的额外参考修订版本 ID，不接受文件路径，也不选择提交内容。省略它不影响完整快照和自动记录的草稿起点。修订版本不存在时，错误标明参数、适用时的数组下标及传入的 ID。提交在保存前编译，不发布或批准内容。

## DSH 接入

`/plugin` 导出 `registerPlaybookTools(scope, repository, playbookId)`。调用方提供独立 DSH scope，并负责其生命周期。注册通过 effect 完成，同时返回卸载函数。只读工具允许 DSH 并发调度，修改工具在各自 Agent 内独占执行，不跨会话锁定 Playbook。参数按目录中的 schema 校验，输出为规范 JSON，由 DSH 渲染为文本。执行前取消不会修改数据；同步仓库操作在事务提交点结束。

名称、说明和参数声明来自注册目录。`playbook_help` 默认总览说明草稿、程序与文案的关系、CommonJS 入口及主题目录。工具说明、参数说明、结果说明和帮助遵循[工具编写标准](../../docs/development.zh.md#工具编写)。程序帮助包含可编译的入口例子，编译帮助负责声明与加载规则。帮助正文仅在调用 `playbook_help` 后作为结果进入模型历史，注册不会把它追加到编剧提示词。

默认 Web profile 不将这些工具注册到全局。编剧管理页仅读取目录，没有执行接口。本模块不增加执行循环、仓库摘要注入、宿主文件工具或项目管理工具。

## 验证

运行 `pnpm exec vitest run plugins/playbook-tools/tests`，通过临时数据库验证确定性场景。`pnpm build:plugins` 后，`pnpm check:plugins:dsh` 检查真实 Cordis 注册、schema、执行、独立 scope、取消、输出拒绝和清理。主库单元测试不需要 DSH。[设计记录](../../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.zh.md) 说明这些选择。

## 会话读取记录

工具工厂接受可选的 `PlaybookObservations`，记录明确返回的草稿对象，也记录所查询译文的缺失。修改已有文件要求完整文件的读取记录，译文按语言分别校验，整条文案的修改要求完整条目读取。状态查询记录程序与文案目录元数据、语言及默认语言。会话插件提供这些记录；内部调用方省略它时，不校验对象读取权限。

每次局部编辑读取最新完整快照，校验原有读取记录，再计算变更。逻辑核心与存储仍要求该快照的序号。只有存储序号校验拒绝时才重新计算，最多尝试三次，耗尽次数后返回 `write-contention`。对象冲突、内容无效、数据库错误和数据库占用均不重试。每次尝试前及保存前检查取消状态。数据库事务不执行业务回调。

事务提交后，回执序号与更新的读取记录均来自这次保存的快照。后续写入不能改变这份快照的身份，也不能授予未读内容的修改权限。平台内部读取不刷新其他对象的读取记录。编辑失败时保留原记录；历史恢复清除受影响范围的记录，删除语言清除文案读取记录。调用方在 Agent 卸载时丢弃记录，存储层不保存它们。[并发设计记录](../../.agents/notes/implemented/architecture/2026-09-13-object-scoped-edits.zh.md)说明事务与快照规则。

## 编译服务

createPlaybookTools 的第四个参数、registerPlaybookTools 的第五个参数可传入 CompilationService。完整管理目录包含 playbook_compile，实际执行注册只有在提供服务时才包含它。PaperMoon profile 明确装配该服务。这个不修改源码的操作会等待编译与保存，支持取消，不改变读取观察。调用必须指定草稿序号。完整上下文与诊断进入普通工具结果，不向提示词注入编译指导。用法见[Playbook API](../playbook-compiler/api.zh.md)。

playbook_commit 使用[提交时编译](../playbook-compiler/README.zh.md#提交与冻结修订版本)，返回 committed、编译诊断及冻结附件摘要，接受 targets 和 allowCompilationFailure，默认要求成功。playbook_compile 只检查草稿，两者都不授予文件读取权限，且要求编译服务；未提供服务时，可执行工具集中不包含它们。模型侧历史和恢复仍限于绑定 Playbook，人工参考选择可以引用其他保留的修订版本。

playbook_simulate 固定当前草稿，编译后在临时状态中依次执行声明的函数。它返回原始结果、诊断与调用前后状态，不写入产物、修订版本或真实演绎状态。它依赖编译服务，支持取消，不授予修改所需的读取权限。functions 帮助主题说明闭包工厂、JSDoc 和调用语义。
