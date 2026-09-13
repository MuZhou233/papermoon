# 剧本编译器与起始上下文运行时

[English](README.md) | 中文

本包将确定的 [StoryContent](../story-core/README.zh.md) 快照编译为起始消息原文。剧本程序使用受限 CommonJS，宿主包使用 ESM。[剧本 API](api.zh.md)规定声明和文案读取方式。本包不创建模型、世界状态、运行期动作或演绎会话。

## 入口与职责

| 入口 | 公开操作 |
|---|---|
| @papermoon/story-compiler | compile(content, options, signal), StoryCompiler, resolveOptions |
| @papermoon/story-compiler/runtime | loadArtifact(serialized), initialize(artifact) |
| @papermoon/story-compiler/service | CompilationService, ArtifactStore |
| @papermoon/story-compiler/plugin | Cordis 服务 papermoonStoryCompiler |

编译器接收内容和明确配置，不通过数据库或文件系统读取创作输入。服务先读取一致的仓库快照，再开始异步编译。草稿请求必须携带已知序号；修订版本必须属于指定剧本。来源身份保留在回执中，不传入程序求值。编译期间编辑草稿，不会改变已捕获的输入。

运行时不导入编译 Worker 或创作仓库。它校验产物，每次初始化都返回独立上下文。修改某次返回值，不影响后续结果。它不执行源码、读取文案、调用模型或保存进度。

## 执行与限制

每次编译独占 Worker、VM Context 和模块缓存。Acorn 检查实际加载的源码，vm.Script 用严格模式包装器同步求值，并在同一个 VM 内校验声明。外层总时限覆盖解析、求值和规范化，VM 执行另设同步超时。完成、失败和取消都会先终止 Worker，再返回结果。服务关闭时取消待完成任务，并等待它们结束。

只有入口及其实际依赖会被解析。上下文不开放宿主文件、网络、进程、环境变量、时钟、随机源或异步调度器。动态代码生成被禁用，Context 使用独立微任务队列，memoryMb 限制 Worker 的 V8 老生代内存。这些措施用于限制错误和资源消耗；[Node 明确说明 VM 不构成安全机制](https://nodejs.org/download/release/v24.3.0/docs/api/vm.html)，不能把它当作恶意源码的完整隔离环境。

| limits 下的选项 | 默认值 |
|---|---|
| inputBytes | 8388608 |
| modules | 256 |
| outputBytes | 1048576 |
| executionMs | 1000 |
| totalMs | 10000 |
| concurrency | 2 |
| memoryMb | 128 |

限制值均为正安全整数。求值前，配置解析将默认入口定为 story.js，将默认语言定为内容的默认语言。明确指定的语言必须已登记。单个编译器实例达到并发上限时返回 busy，不排队。独立 compile 函数共用一个实例。Cordis 适配器接受 directory 和可选 limits 配置。用户与模型接口仅提供入口和语言选择，部署限制由插件配置管理。

诊断包含 code、stage、message，以及能够取得的文件、行列、声明字段、文案键或语言。未知声明字段会标明实际成员，并列出支持的字段。ESM 语法诊断明确说明 CommonJS 要求。语法位置对应原始文件，消息中不包含包装代码的行号。模块循环会附带引用链。不知道的位置不填入字段。取消、资源超限和 Worker 异常均不返回成功产物。

## 产物与保存

产物包含格式与编译器身份、规范化内容指纹、有效配置、上下文原文及 SHA-256 完整性信息，不包含可执行源码、闭包、VM 对象或字节码。运行时拒绝不支持的格式、错误字段和不匹配的哈希，不修复、不重新编译。完整性哈希可以发现内容变化，但不是签名。

CompilationService.compile 总会对捕获的输入求值。成功结果先保存，再返回可用身份。CompilationService.find 根据规范化内容、有效配置和编译器身份查询已有结果，不执行编译。read 和 initialize 按产物 ID 工作，无需访问原草稿。保存和编译都不会提交修订版本或改变发布记录。

ArtifactStore 将完整 JSON 写入临时文件，再通过不覆盖已有目标的原子链接落下记录。相同结果重复保存保持幂等，同一键出现不同结果时返回 artifact-conflict。保存失败会拒绝本次操作。记录不包含每次尝试的历史，也不保存失败诊断。独立存储适配器默认将单条记录限制为 16 MiB，可通过构造参数调整。[开发文档](../../docs/development.zh.md)说明产品目录及清理方式。

插件依赖 papermoonStoryCore，通过 effect 提供 papermoonStoryCompiler。先清理依赖它的使用方，再关闭编译服务，最后由存储提供者释放连接。剧本数据库与业务内容格式不变。

## 验证

主库测试使用临时数据库与确定性源码。pnpm check:compiler:built 在普通 Node 下运行构建后的 Worker 和独立运行时进程。pnpm check:plugins:dsh 验证真实 Cordis 清理、工具作用域及确定性模型收到的编译回执。pnpm test:editor 覆盖显式编译、程序与文案诊断、精确语言预览、旧结果标记和刷新恢复。测试不调用真实模型，也不使用用户运行数据。

[决定记录](../../.agents/notes/implemented/architecture/2026-09-13-commonjs-opening-compiler.zh.md)说明 CommonJS、文本冻结及独立产物存储的选择。
