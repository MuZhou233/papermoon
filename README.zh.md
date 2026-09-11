# PaperMoon

[English](README.md) | 中文

PaperMoon 是面向 AI 互动叙事的 DSH 发行版，为 LLM 驱动的文字冒险游戏与角色扮演提供交互前端。

## 当前进度

目前已建立维护框架和原版 DSH Web 启动入口，尚未加入产品专用功能。

## 启动

在仓库根目录使用 Node 24 和 pnpm 11.7.0：

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start -- --no-open
```

使用 `pnpm run setup`，不要使用 pnpm 内置的 `pnpm setup` shell 配置命令。初始化会丢弃 DSH 子模块中尚未导出为补丁的源码修改，保留 Git 已忽略的配置和主仓库数据。构建需要单独执行，启动命令不会安装依赖、构建或重置源码。

运行数据默认位于 `.papermoon/dsh` 和 `.papermoon/agents`。显式设置 `DSH_HOME` 和 `DSH_AGENTS_HOME` 可覆盖路径。凭据由 DSH 按原有环境和配置机制解析；根目录 `.env` 被 Git 忽略。默认会话工作区是 PaperMoon 根目录。

## 维护

插件与工具由主库维护，`dsh/` Git 子模块固定上游版本。

[开发指南](docs/development.zh.md)说明命令与故障处理，[架构](docs/architecture.zh.md)说明各部分由哪个仓库维护，[测试规范](docs/testing.zh.md)列出所需检查。[补丁维护](patches/README.zh.md)说明如何定制 DSH，[Agent Notes](.agents/notes/README.zh.md)记录主仓库的决定及其理由。
