# 仓库架构

[English](architecture.md) | 中文

## 职责

主仓库拥有插件、工具、文档、依赖和 CI。`dsh/` 的 Gitlink 固定官方实现，它不属于主库 workspace。作用于 DSH 的修改保存为补丁，按子模块标准交付。补丁工具自身属于主库代码。混合变更分别提供两部分证据。

主库规则自包含。使用 DSH 接口不会将其包结构、运行时设计规则、SDK 要求或组织工作流引入主库规范。[维护决策](../.agents/notes/implemented/process/2026-09-11-independent-maintenance.zh.md)记录了这一选择。

## 启动与数据

启动器执行 DSH 官方构建后的 CLI，使用标准 Web profile，以 PaperMoon 根目录作为工作目录。依赖安装和构建在子模块中运行，并继承 `CI=true` 以使用 DSH 支持的自动安装路径；否则开发 hook 安装器会拒绝子模块的 Git 配置。补丁检查使用正常环境，启动不会强制设置此变量。

启动器提供独立的默认数据目录，配置、认证、模型行为和 UI 均交由 DSH 处理。不增加独立服务端、profile 组合或应用 API。[开发指南](development.zh.md)维护命令接口。

## 维护工具

主库检查只读取自有文件和夹具，排除子模块、依赖目录和运行数据。适配后的检查器在 `tooling/checks/` 独立维护，保留原始许可和来源记录。[检查器指南](../tooling/checks/README.zh.md)维护配置和能力限制。
