# 开发指南

[English](development.md) | 中文

## 初始化与命令

使用根目录声明的 Node 和 pnpm 版本。先安装主库依赖，再调用仓库工具。脚本遇到过期依赖会报错，不会自动安装。DSH 版本以主仓库暂存区中的 Gitlink 为准，也包括已经暂存的版本更新。

| 命令 | 效果 |
|---|---|
| `pnpm run setup` | 重置 DSH、应用已登记补丁、安装锁定的 DSH 依赖 |
| `pnpm build` | 构建主库插件，再清理 DSH 声明的产物并运行官方构建 |
| `pnpm build:plugins` | 无需 DSH 即可构建主库插件 |
| `pnpm check:compiler:built` | 用普通 Node 验证构建后的编译 Worker 和独立运行时 |
| `pnpm check:plugins:pure` | 阻止导入 Node 内置模块和 Cordis，检查构建后的核心与编剧上下文纯入口 |
| `pnpm check:plugins:dsh` | 使用真实 DSH Cordis 检查存储、核心、编剧服务的生命周期及独立 scope 工具 |
| `pnpm start -- --port 3081 --no-open` | 在 Web 上启动 PaperMoon；参数分别通过 argv 传递 |
| `pnpm start:dsh -- --port 3081 --no-open` | 启动原版 Web，不加载产品插件 |
| `pnpm test:editor` | 在 Chromium 中通过临时 Web 进程验证编辑器和编剧管理 |
| `pnpm test:writer-sessions` | 用确定性适配器验证编剧接纳、原文请求和恢复 |
| `pnpm check` | 主库类型、lint、测试、文档与 Note 检查 |
| `pnpm check:docs` | 主库文档与检查器来源检查 |
| `pnpm check:notes` | 活跃 Note 与不可变归档检查 |
| `pnpm check:patches` | 重建源码并执行登记的 DSH 交付检查 |
| `pnpm test:smoke` | 启动临时 Web 进程验证构建产物，不调用模型 |

setup 脚本必须通过 `pnpm run setup` 调用，`pnpm setup` 是 pnpm 的保留命令。自动化脚本也使用前一种写法。

[PaperMoon 组合配置](../profiles/papermoon/cordis.patch.yml)通过官方 profile 叠加机制挂载存储、核心、编译器、编辑器、编剧管理和编剧会话插件。它是配置，不是源码补丁。启动不会重建插件；修改主库插件或 UI 源码后，运行 `pnpm build:plugins`。浏览器测试需要已构建的 DSH 产物及 Chromium，可用 `pnpm exec playwright install chromium` 安装浏览器。

## 编辑与升级

自定义插件保留在主库，源码定制保存在[补丁](../patches/README.zh.md)中。初始化会移除 DSH 内未跟踪且未忽略的文件，不会清理已忽略的文件。重新初始化前导出需要保留的源码修改。用户数据放在 DSH 子模块目录之外。

更新 DSH 时，选择官方提交，暂存新的 Gitlink，调整补丁及所需检查，然后执行初始化、构建、补丁检查和启动验证。主库检查器源码单独审查，不随 Gitlink 自动更新。两套依赖锁文件各自独立。

## 工具编写

工具说明、参数说明、结果说明和帮助均使用陈述句或祈使句，客观描述能力。参照 DSH 文件编辑工具的信息披露方式，只提供选择工具、调用工具和理解结果所需的信息。

工具说明写用途与效果，参数说明写输入、默认值及必要限制，结果说明解释返回值，帮助提供 API 规则和例子。

删去无关限制、重复解释和不影响调用的内部机制。持久化与重试细节写在工程文档中；调用方需要使用序号或标识时，再在工具文案中解释。不加入创作要求、强制检查流程，也不要求模型向用户汇报内部状态。

## 故障处理

缺少构建产物时，启动器会提示先构建。更新已有产物也需要重新运行构建命令。补丁应用失败时，初始化会恢复 Gitlink 指定的源码并停止，修复补丁后再试。补丁验证会拒绝未知的检查脚本、未登记文件和源码差异。

初始化不会启动服务。Web 在当前终端中运行，收到中断或终止信号后停止。启动测试使用临时数据和随机分配的本机回环端口，结束时等待进程退出。[测试规范](testing.zh.md)说明交付证据。

编剧配置沿用 `PAPERMOON_DATA_DIR` 指定的产品数据目录，使用独立的 `writers.sqlite`。profile 不将剧本工具注册到全局。客户端插件共用 `tooling/repository/build-clients.ts` 的打包过程。

宿主打包保留 PaperMoon 包的外部导入，让 Worker 路径相对于所属模块的构建产物解析。浏览器打包和主库源码测试继续使用源码别名。

## 工作区登记格式

资源工作区使用 DSH 工作区域格式 3，拒绝旧登记数据。停止服务后，将旧 `workspace.json` 移出 DSH 存储目录，再启动并重新选择文件夹或剧本。默认路径为 `.papermoon/dsh/storages/workspace.json`；显式设置 `DSH_HOME` 会改变其上级目录。确认新列表无误后再处理备份。此操作不改写会话日志、剧本数据库或编剧数据库。

## 编译产物

编译插件的 directory 默认指向 `.papermoon/compiled-stories/`；提供 `PAPERMOON_DATA_DIR` 时，使用该目录下的产物子目录。每个按内容寻址的 JSON 文件都是独立派生结果，草稿变化和项目删除不会将其删除。本版不自动回收，也不记录失败尝试的历史。需要清理时，先停止服务，再仅删除配置指定的 compiled-stories 目录。清理后，重启预览需等待对应内容再次显式编译。保留创作数据库及其他产品数据。

编译不使用 Node 实验参数。构建后 Worker 检查会打印实际 Node 版本，CI 独立运行其选定的 Node 24 版本。源码测试与正式构建各自使用源码和产物模块路径。

## 冻结修订数据

剧本存储要求格式 3。版本 1 和 2 数据库会被拒绝，原文件保持不变。使用新存储前，将旧文件保存在配置的新数据库路径之外，不提供迁移或自动删除。业务 KV 仍为格式 1。编译产物与演绎初始化要求格式 2。旧编译文件、附件产物和演绎记录会保留，但不能继续使用，不迁移或原地重新编译。可以将源码恢复到草稿，再提交新修订版本以生成当前产物，然后新开演绎。compiled-stories 目录只保存独立草稿检查，不再需要这些预览时可删除；权威修订产物保存在 Story SQLite 中，已经开始的演绎另有日志副本。
