# 仓库架构

[English](architecture.md) | 中文

## 产品与 DSH

DSH 提供通用 Agent 运行与应用基础。PaperMoon 的产品设计建立在这些能力之上，通过自己的插件、配置和必要补丁提供产品体验。“前端”描述发行版面向用户的用途，实现可以包含浏览器代码和服务端逻辑。[产品介绍](../README.zh.md)说明使用场景，[定位决策](../.agents/notes/implemented/architecture/2026-09-12-product-positioning.zh.md)记录与 DSH 的关系及其理由。

## 职责

主仓库维护插件、工具、文档、依赖和 CI。`dsh/` 的 Gitlink 固定 DSH 官方提交，子模块不作为主仓库 workspace 中的包。作用于 DSH 的修改保存为补丁，按子模块标准交付；管理补丁的工具按主仓库标准交付。同一变更涉及两者时，分别按各自规则验证。

主仓库独立规定自己的维护规则。使用 DSH 接口不会将其包结构、运行时设计规则、SDK 要求或组织工作流引入主库规范。[维护决策](../.agents/notes/implemented/process/2026-09-11-independent-maintenance.zh.md)记录了这一选择。

## 当前启动方式与数据

启动器以 PaperMoon 根目录为工作目录，调用 DSH 官方构建后的 CLI，在标准 Web profile 上加载 PaperMoon 组合配置。子模块内的依赖安装、构建和登记的检查使用 `CI=true`，保持 DSH 的自动化安装行为和依赖布局。启动继承调用方环境。

组合配置加入人工剧本编辑器、编剧管理、编剧会话和文本演绎，同时保留 DSH 的配置、认证、普通对话和设置。启动器提供独立的默认数据目录，也保留原版 Web 命令用于对照。[开发文档](development.zh.md)说明命令接口。

## 剧本数据

[存储模块](../plugins/story-storage/README.zh.md)通过独立 SQLite 数据库管理产品数据，并导出可加载的 Cordis 适配器。核心不依赖 DSH。PaperMoon 组合配置挂载该插件，原版 Web 配置不挂载。[存储决策](../.agents/notes/implemented/architecture/2026-09-12-script-storage.zh.md)记录归属和事务选择。

[逻辑核心](../plugins/story-core/README.zh.md)维护程序与多语言文案结构、纯内容编辑和业务 KV 编码。仓库入口通过存储编排操作，Cordis 入口注册内部服务。编译、会话策略及面向用户和模型的接口由模块之外负责。[核心决策](../.agents/notes/implemented/architecture/2026-09-12-script-core.zh.md)记录这一划分。

## 维护工具

主库检查只读取自有文件和夹具，排除子模块、依赖目录和运行数据。适配后的检查器在 `tooling/checks/` 独立维护，保留原始许可和来源记录。[检查器指南](../tooling/checks/README.zh.md)说明配置方式和检查范围。

## 人工创作

[编辑器插件](../plugins/story-editor/README.zh.md)维护面向用户的操作和页面。[UI 库](../packages/ui/README.zh.md)维护注明来源的组件副本与编辑控件，仅复用 DSH 的主题和宿主接口。[界面设计决定](../.agents/notes/implemented/architecture/2026-09-12-manual-script-editor.zh.md)记录接入方式和本地缓冲区设计。

## 编剧配置与工具

[编剧管理](../plugins/writers/README.zh.md)在独立数据库中维护提示词配置，并提供纯起始上下文解析。[剧本工具](../plugins/story-tools/README.zh.md)维护逻辑核心之上的模型操作，注册到调用方提供的 DSH scope。管理页展示同一份工具目录，不创建会话或调用模型。[设计记录](../.agents/notes/implemented/architecture/2026-09-12-writer-definitions-and-tools.zh.md)说明这些职责。

## 编剧会话

[会话插件](../plugins/writer-sessions/README.zh.md)维护编剧配置、已固定上下文和读取保护。剧本目标登记由[共用工作区提供者](../plugins/story-workspaces/README.zh.md)负责。通用 DSH 能力通过补丁维护，[决定记录](../.agents/notes/implemented/architecture/2026-09-12-writer-sessions.zh.md)说明职责与替代方案。

## 编译与初始化

[编译器](../plugins/story-compiler/README.zh.md)接收确定内容与明确配置，通过独立入口初始化冻结的起始文本并执行函数。服务读取仓库快照，管理独立产物文件。编辑器与作用域内的工具共用该服务，存储与逻辑核心不反向依赖它。[决定记录](../.agents/notes/implemented/architecture/2026-09-13-commonjs-opening-compiler.zh.md)说明 CommonJS 与产物归属。

## 修订提交与演绎

[编译服务](../plugins/story-compiler/README.zh.md#提交与冻结修订版本)负责在修订事务前自动编译。存储保存通用不可变附件，核心只传递附件。独立修订读取器与文本运行时初始化[演绎会话](../plugins/performances/README.zh.md)，不执行编译或访问预览缓存。会话保存完整产物副本，源剧本删除后仍可继续。[共用剧本工作区](../plugins/story-workspaces/README.zh.md)通过稳定提供者组织编剧与主持人会话。

函数声明、冻结源码与调用由[编译器包](../plugins/story-compiler/README.zh.md)维护。[演绎插件](../plugins/performances/README.zh.md)串行执行调用，将完整动作持久保存到 Session 日志。函数状态不会隐式进入存储 KV 或模型上下文。
