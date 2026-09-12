# PaperMoon 插件

[English](README.md) | 中文

产品插件在此维护，遵循主仓库规则。[剧本存储插件](story-storage/README.zh.md)负责持久化，[逻辑核心](story-core/README.zh.md)定义创作内容和业务操作。[人工编辑器](story-editor/README.zh.md)维护浏览器操作和页面。主仓库 workspace 会识别本目录下一级子目录中的包。

通过 DSH 已有插件接口集成。接口使用要求不会引入 DSH 内部包布局或交付制度。必要的 DSH 源码修改保存在[补丁](../patches/README.zh.md)中，按子模块要求单独验证。新增插件时，在它的双语 README 中说明实际配置和用户可见行为。

[编剧管理](writers/README.zh.md)负责提示词配置与起始上下文预览。[剧本工具](story-tools/README.zh.md)负责可执行目录和 DSH scope 注册。两者均不启动模型对话。[编剧会话](writer-sessions/README.zh.md)将配置和工具接入剧本工作区，负责会话配置、上下文固定及读取策略。
