# PaperMoon 组合配置

[English](README.md) | 中文

`@papermoon/extensions` 是一个 DSH 组合包，挂载普通 PaperMoon 扩展，包括可复用的文本对话。启动器在 `papermoon` profile 中选用它、官方基础／Web 组合包，以及可独立开关的故事模式组合包。

启动器为仓库维护的包创建本地链接，仅在 profile 清单不存在时初始化选择。DSH 管理用户配置、组合包选择和热重载，不再由产品叠加配置强制覆盖这些选择。`pnpm start:dsh` 继续使用原 `web` profile。
