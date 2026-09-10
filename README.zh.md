# PaperMoon

[English](README.md) | 中文

PaperMoon 围绕固定版本的 DSH Git 子模块独立维护插件与工具。启动入口打开原版 DSH Web 应用；补丁清单为空，未安装产品插件。

## 启动

在仓库根目录使用 Node 24 和 pnpm 11.7.0：

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm build
pnpm start -- --no-open
```

使用 `pnpm run setup`，不要使用 pnpm 内置的 `pnpm setup` shell 配置命令。初始化会丢弃受管子模块内未导出的源码修改，保留已忽略的配置和主仓库数据。构建单独执行；启动不会安装、构建或重置源码。

运行数据默认位于 `.papermoon/dsh` 和 `.papermoon/agents`。显式设置 `DSH_HOME` 和 `DSH_AGENTS_HOME` 可覆盖路径。凭据由 DSH 按原有环境和配置机制解析；根目录 `.env` 被 Git 忽略。默认会话工作区是 PaperMoon 根目录。

## 维护

[开发指南](docs/development.zh.md)说明命令与故障处理。[架构](docs/architecture.zh.md)划分归属。[测试规范](docs/testing.zh.md)定义验证证据。[补丁维护](patches/README.zh.md)说明 DSH 定制；[Agent Notes](.agents/notes/README.zh.md)保存主库决策。
