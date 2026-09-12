# PaperMoon UI

[English](README.md) | 中文

这个库维护 PaperMoon 的 React 控件与编辑器视图。功能页面导入 @papermoon/ui，不导入 DSH 组件实现。组件接收属性和回调，不访问存储、会话或 Cordis 服务。

## 来源与主题

选用的 Button、Input、Menu、Modal 实现及所需样式来自 [provenance.json](provenance.json) 记录的官方 DSH 提交。每份复制文件都记录原始路径和源码哈希，并保留[上游许可](DSH-LICENSE)。本地修改在这里维护，初始化或升级 DSH 不会自动刷新这些副本。新增图标、控件和编辑器绑定由 PaperMoon 维护。

主题适配器将 DSH CSS 变量映射为 PaperMoon 变量。控件继承周围字体，支持已有的明暗主题。下拉选择使用复制的自定义菜单。单行输入框在外层边框上显示悬停和焦点状态，尺寸保持不变，内部不再叠加焦点轮廓。弹框限制焦点范围，关闭后将焦点交还原先的元素。调用方提供本地化标签，业务内容按用户原文显示。

## 编辑

CodeEditor 封装 CodeMirror 6，提供行号、高亮、查找、撤销和只读展示。它报告文本变化，不负责保存或修订身份。文件切换时，已挂载但暂时隐藏的编辑器保留编辑状态。JavaScript、TypeScript、JSON 和 Markdown 使用语法高亮，其他文件按纯文本显示。高亮不代表编译。

CodeDiff 展示只读的前后内容，比较控件不合并或恢复内容。文案目录使用普通多行文本框，不套用代码编辑控件。这些流程由[剧本编辑器](../../plugins/story-editor/README.zh.md)负责。

## 维护

主库检查在不读取 DSH 的情况下校验组件归属和来源记录。浏览器场景验证实际构建产物、键盘控件、只读内容和响应式布局。依赖与源码副本遵循 PaperMoon 的[维护规则](../../AGENTS.md)。
