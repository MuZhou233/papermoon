# 剧本编译器与运行时

[English](README.md) | 中文

本包将固定的 [StoryContent](../story-core/README.zh.md) 编译为起始消息、状态与函数声明。剧本程序使用受限 CommonJS，宿主包使用 ESM。[剧本 API](api.zh.md) 定义声明、JSDoc 和文案读取方式。

## 入口与职责

| 入口 | 公共操作 |
|---|---|
| @papermoon/story-compiler | compile, StoryCompiler, resolveOptions |
| @papermoon/story-compiler/runtime | loadArtifact, initialize |
| @papermoon/story-compiler/execution | StoryRuntime.invoke, compose, close |
| @papermoon/story-compiler/service | CompilationService, ArtifactStore |
| @papermoon/story-compiler/revisions | RevisionArtifacts, revisionCompilation |
| @papermoon/story-compiler/plugin | Cordis 服务 papermoonStoryCompiler |

编译接收内容与显式配置。服务先按已知序号读取一致的草稿快照，再开始异步工作。来源身份写入回执，不作为程序输入。编译期间的编辑不会改变这份输入。存储层和逻辑核心不导入编译器。

runtime 入口校验冻结产物，每次返回独立的起始上下文，不加载 Worker 或执行源码。execution 入口在 Worker 中运行冻结模块与函数，不导入编译服务或 JSDoc 解析器，不读取草稿、重新生成工具 Schema 或保存进度。演绎会话负责持久保存状态。

## 执行与限制

每次编译或调用都新建 Worker、VM Context 和模块缓存。Acorn 检查受限 JavaScript，TypeScript 在编译时解析显式 JSDoc，vm.Script 执行严格模式的 CommonJS 包装。调用时核对工厂、函数与冻结声明的身份。只有显式状态跨调用保留，模块全局变量和闭包局部变量每次重新创建。

工厂接收受保护的状态引用。构造工厂时，属性写入、嵌套写入、删除和属性定义都会失败。实际函数执行时才允许修改候选状态。JSON Schema 由 Ajv 校验，不转换类型、不填充默认值、不删除属性。参数、返回值或候选状态无效时，持久化前即失败。状态 Schema 使用异步校验、不支持的关键字或无法解析的引用时，编译失败。

外层时限覆盖解析、求值与规范化，VM 调用另有同步超时。正常结束、取消和失败都先终止 Worker 再返回；关闭时取消并等待任务结束。Context 不提供宿主文件、网络、进程、环境变量、时钟、随机源或异步调度，禁用动态代码生成。这些措施用于限制错误和资源消耗；[Node 明确指出 VM 不是安全机制](https://nodejs.org/download/release/v24.3.0/docs/api/vm.html)。

| limits 下的选项 | 默认值 |
|---|---|
| inputBytes | 8388608 |
| modules | 256 |
| outputBytes | 1048576 |
| executionMs | 1000 |
| totalMs | 10000 |
| concurrency | 2 |
| memoryMb | 128 |

限制均为正的安全整数。入口和语言在求值前确定，默认为 story.js 和内容的默认语言。每个编译器或执行器实例达到并发上限时返回 busy，不设置后台队列。独立 compile 函数共用一个实例。插件配置接受 directory、limits 和 attachmentBytes；创作接口只选择入口与语言。演绎调用采用产物中冻结的限制。

诊断包含代码、阶段、说明，以及可取得的文件、行列、声明字段、文案键或语言。模块循环带有引用链，JSDoc 错误尽可能定位到无效类型注解或别名声明，其余情况定位到源码函数。无法确定的位置留空。完整产物、调用状态与结果、诊断和模拟结果都受输出限制约束；演绎持久化还会检查完整动作记录。

## 产物与持久化

产物格式 3 冻结编译器与 API 身份、规范化源码指纹、有效配置、起始上下文、初始状态与 Schema、函数声明、已加载模块、所选语言文案和 SHA-256 校验信息。不保存函数对象、闭包、VM 实例或字节码。读取时拒绝不支持的版本、无效字段和哈希损坏，不重新编译或修复。哈希用于发现改动，不是签名。

CompilationService.compile 对固定草稿求值，保存成功后才返回产物身份。find 按内容、配置和编译器身份查询，不执行程序。read 与 initialize 按产物身份读取，不依赖草稿。ArtifactStore 通过临时文件和原子的不覆盖链接写入 JSON。相同结果幂等保存，同一键对应不同结果则失败。不保存失败尝试的历史。存储器默认单条上限为 16 MiB，可通过构造参数调整。[开发文档](../../docs/development.zh.md) 说明数据路径与清理方式。

Cordis 服务依赖 papermoonStoryCore。消费者先清理，服务再取消并等待编译、模拟结束，最后由存储释放连接。Story 数据库仍为格式 3，业务 KV 仍为格式 1。产物格式 1 和 2 不受支持，既有文件和修订版本附件不改写。

## 提交与冻结修订版本

submit 对同一份固定草稿编译每个目标。省略 targets 时选择 story.js 和默认语言；显式列表必须非空且无重复。顺序随修订版本冻结，第一项作为默认演绎目标。allowCompilationFailure 默认为 false。全部目标成功才附带结果；明确允许剧本编译失败时，可提交源码和空附件清单，但不能跳过编译。

取消、无效配置、服务不可用、Worker 异常、存储失败和外层超时会中止提交。剧本语法、加载、声明、翻译和同步执行限制返回诊断。服务校验来源身份与附件总量 attachmentBytes，再通过一个 SQLite 事务保存源码、有序产物正文和报告。最终序号校验拒绝并发编辑。响应丢失不会撤销已提交的修订版本。

RevisionArtifacts 读取冻结报告和附件，不调用编译器。已提交产物不能追加、修改或替换。显式空清单与正文缺失不同；正文缺失或损坏时直接失败。独立 ArtifactStore 只保存草稿检查结果，删除它不会删除历史产物。

## 模拟与验证

simulate 固定草稿，编译但不保存产物，然后在临时状态中依次调用函数。每步包含参数、调用前状态，以及原始返回值和结果状态，或错误诊断。剧本错误保留调用前状态，后续调用继续；取消或服务异常则停止。整次模拟有外层时限和结果总量限制，不保存草稿内容、修订版本或演绎状态。

主库测试使用临时数据和确定性源码。pnpm check:compiler:built 在普通 Node 下验证构建后的 Worker 与独立产物读取。pnpm check:plugins:dsh 验证真实 Cordis 清理和 DSH 原生函数调用。浏览器测试覆盖预览、工具历史、只读状态、刷新和窄屏。检查不调用真实模型，不使用用户数据。[闭包决定](../../.agents/notes/implemented/architecture/2026-09-13-closure-functions.zh.md) 扩展了 [CommonJS 决定](../../.agents/notes/implemented/architecture/2026-09-13-commonjs-opening-compiler.zh.md)。
