# 仓库架构

[English](architecture.md) | 中文

## 产品与 DSH

DSH 提供通用 Agent 运行与应用基础。PaperMoon 的产品设计建立在这些能力之上，通过自己的插件、配置和必要补丁提供产品体验。“前端”描述发行版面向用户的用途，实现可以包含浏览器代码和服务端逻辑。[产品介绍](../README.zh.md)说明使用场景，[定位决策](../.agents/notes/implemented/architecture/2026-09-12-product-positioning.zh.md)记录与 DSH 的关系及其理由。

## 职责

主仓库维护插件、工具、文档、依赖和 CI。`dsh/` 的 Gitlink 固定 DSH 官方提交，子模块不作为主仓库 workspace 中的包。作用于 DSH 的修改保存为补丁，按子模块标准交付；管理补丁的工具按主仓库标准交付。同一变更涉及两者时，分别按各自规则验证。

主仓库独立规定自己的维护规则。使用 DSH 接口不会将其包结构、运行时设计规则、SDK 要求或组织工作流引入主库规范。[维护决策](../.agents/notes/implemented/process/2026-09-11-independent-maintenance.zh.md)记录了这一选择。

## 当前启动方式与数据

启动器执行 DSH 官方构建后的 CLI，使用标准 Web profile，以 PaperMoon 根目录作为工作目录。安装依赖和构建时，启动器在子模块中设置 `CI=true`，启用 DSH 支持的自动安装方式。未设置时，开发 hook 安装器会拒绝子模块的 Git 配置。补丁检查和启动沿用调用者的环境，不强制设置此变量。

当前运行的是原版 DSH Web，配置、认证、模型行为和 UI 均沿用该应用。启动器提供独立的默认数据目录。[开发指南](development.zh.md)说明命令接口。

## 维护工具

主库检查只读取自有文件和夹具，排除子模块、依赖目录和运行数据。适配后的检查器在 `tooling/checks/` 独立维护，保留原始许可和来源记录。[检查器指南](../tooling/checks/README.zh.md)说明配置方式和检查范围。
