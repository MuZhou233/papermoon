# PaperMoon

[English](README.md) | 中文

PaperMoon 是面向 AI 互动叙事的 DSH 发行版，为 LLM 驱动的文字冒险游戏与角色扮演提供交互前端。

## 当前进度

[人工编辑器](plugins/story-editor/README.zh.md)提供剧本总览、程序与多语言文案编辑、不可变修订版本、比较、复制和恢复。编辑器通过[逻辑核心](plugins/story-core/README.zh.md)使用独立的[存储模块](plugins/story-storage/README.zh.md)。[编剧管理](plugins/writers/README.zh.md)可以编辑系统提示词和起始消息，并查看内置剧本工具。[编剧会话](plugins/writer-sessions/README.zh.md)将这些配置和工具接入剧本工作区，保留普通 DSH 对话。编译功能尚未提供。

## 启动

在仓库根目录使用 Node 24 和 pnpm 11.7.0：

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start -- --no-open
```

使用 `pnpm run setup`，不要使用 pnpm 内置的 `pnpm setup` shell 配置命令。初始化会丢弃 DSH 子模块中尚未导出为补丁的源码修改，保留 Git 已忽略的配置和主仓库数据。构建需要单独执行，启动命令不会安装依赖、构建或重置源码。

DSH 运行数据默认位于 `.papermoon/dsh` 和 `.papermoon/agents`。显式设置 `DSH_HOME` 和 `DSH_AGENTS_HOME` 可覆盖路径。剧本和编剧配置默认分别存于 `.papermoon/story.sqlite` 和 `.papermoon/writers.sqlite`，`PAPERMOON_DATA_DIR` 可覆盖它们的父目录。凭据由 DSH 按原有环境和配置机制解析；根目录 `.env` 被 Git 忽略。默认会话工作区是 PaperMoon 根目录。

## 维护

插件与工具由主库维护，`dsh/` Git 子模块固定上游版本。

[开发指南](docs/development.zh.md)说明命令与故障处理，[架构](docs/architecture.zh.md)说明各部分由哪个仓库维护，[测试规范](docs/testing.zh.md)列出所需检查。[补丁维护](patches/README.zh.md)说明如何定制 DSH，[Agent Notes](.agents/notes/README.zh.md)记录主仓库的决定及其理由。
