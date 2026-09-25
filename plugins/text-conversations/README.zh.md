# 文本对话

[English](README.md) | 中文

此扩展通过 DSH Agent 提供不带工具、由插件持有的对话。它不包含章节定义或进度规则，关闭故事模式后仍然可用。

## 宿主服务

`textConversations.models()` 读取模型元数据和已配置凭据的可用状态，不发送推理请求。`validate()` 检查所选路由，并在模型不提供 effort 时移除该参数。它不会选择最低 effort。

`open(owner, input)` 通过消费者插件自身的 Agent registry 创建或恢复 DSH Agent，使其生命周期归该插件管理。调用方维护会话 ID、原样使用的系统提示词、所选模型和持久引用。作用域内的完整提示词屏蔽继承的运行时上下文，空工具允许列表确保请求不带工具。选择只影响这个 Agent。调用方须串行处理自己的操作，并在不再使用时释放返回的句柄；DSH 在所属插件卸载时也会停止并等待 Agent 退出。

会话没有工作区根目录。普通 DSH 会话控制器不会列出、搜索或从冷存储接管这些会话，由所属插件通过本服务恢复。可选的 `native` 规则显式开放运行中的 Agent，供原生历史和输入／模型控件访问，支持提交前校验和宿主强制只读。私有会话的模型选择不更新全局默认值。创建时可选的 `seed` 提供预置 Session 记录，不调用模型。DSH 继续负责会话编码、持久化和中断回合恢复。请求边界记录使用 DSH 现有协议，按发送时的历史位置检查请求，不复制或改写消息。

## 原生导航

本扩展不提供客户端页面。消费者通过 `uiWorkspace.openSession({ kind: 'session', sessionId })` 打开已开放的会话，沿用默认对话页面、顶栏、标签和 Session 绑定。可选的 `title` 在 Session 日志中固定初始标题；原生顶栏无需普通列表项即可读取。

消费者通过 `uiConversation.pages.constrain(sessionId, policy)` 临时约束纯文本或只读展示，并随自身生命周期释放。非只读时，原生模型和 effort 控件保持自由选择；Host 仍负责校验请求。通用文本执行与各消费者的页面规则由此分开。

没有有效的当前选择时，原生调用方可以省略 `choice`。创建时不会记录替代选择，后续选择由原生模型控件负责。`defaultSelection()` 读取已有全局选择，不校验或修改它。`view().choice` 返回 Session 最新的模型选择或请求配置，没有局部选择时读取当前默认值。`view().successfulTurn` 指向首次完成的回合，使后续请求不会移动消费者引用的首次成功位置；它不表示最近一次请求成功。

## 验证

`node plugins/text-conversations/integration/runtime.mjs` 使用托管检出中的 DSH 构建产物、确定性适配器和临时持久化目录，检查实际请求、历史检查、effort、隔离、取消和恢复。
