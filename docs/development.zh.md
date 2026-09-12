# 开发指南

[English](development.md) | 中文

## 初始化与命令

使用根目录声明的 Node 和 pnpm 版本。先安装主库依赖，再调用仓库工具。脚本遇到过期依赖会报错，不会自动安装。DSH 版本以主仓库暂存区中的 Gitlink 为准，也包括已经暂存的版本更新。

| 命令 | 效果 |
|---|---|
| `pnpm run setup` | 重置 DSH、应用已登记补丁、安装锁定的 DSH 依赖 |
| `pnpm build` | 构建主库插件，再清理 DSH 声明的产物并运行官方构建 |
| `pnpm build:plugins` | 无需 DSH 即可构建主库插件 |
| `pnpm check:plugins:dsh` | 使用已构建的 DSH Cordis 检查存储插件类型与生命周期 |
| `pnpm start -- --port 3081 --no-open` | 启动原版 Web；参数分别通过 argv 传递 |
| `pnpm check` | 主库类型、lint、测试、文档与 Note 检查 |
| `pnpm check:docs` | 主库文档与检查器来源检查 |
| `pnpm check:notes` | 活跃 Note 与不可变归档检查 |
| `pnpm check:patches` | 重建源码并执行登记的 DSH 交付检查 |
| `pnpm test:smoke` | 启动临时 Web 进程验证构建产物，不调用模型 |

setup 脚本必须通过 `pnpm run setup` 调用，`pnpm setup` 是 pnpm 的保留命令。自动化脚本也使用前一种写法。

## 编辑与升级

自定义插件保留在主库，源码定制保存在[补丁](../patches/README.zh.md)中。初始化会移除 DSH 内未跟踪且未忽略的文件，不会清理已忽略的文件。重新初始化前导出需要保留的源码修改。用户数据放在 DSH 子模块目录之外。

更新 DSH 时，选择官方提交，暂存新的 Gitlink，调整补丁及所需检查，然后执行初始化、构建、补丁检查和启动验证。主库检查器源码单独审查，不随 Gitlink 自动更新。两套依赖锁文件各自独立。

## 故障处理

缺少构建产物时，启动器会提示先构建。更新已有产物也需要重新运行构建命令。补丁应用失败时，初始化会恢复 Gitlink 指定的源码并停止，修复补丁后再试。补丁验证会拒绝未知的检查脚本、未登记文件和源码差异。

初始化不会启动服务。Web 在当前终端中运行，收到中断或终止信号后停止。启动测试使用临时数据和随机分配的本机回环端口，结束时等待进程退出。[测试规范](testing.zh.md)说明交付证据。
