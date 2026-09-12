export const en = {
  close: 'Close', script: 'Choose script', writer: 'Choose writer', search: 'Search projects and scripts',
  manage: 'Manage writers', missing: 'This script has been deleted. History is still available.',
  required: 'Choose a writer before sending.', loading: 'Loading writer configuration…',
  frozen: 'Fixed after the first accepted message', context: 'Initial context',
  copy: 'Copy', number: 'Number', role: 'Role', content: 'Content', error: 'Unable to load writer configuration',
  empty: 'No scripts found', refresh: 'Refresh',
}
export const zh: Record<keyof typeof en, string> = {
  close: '关闭', script: '选择剧本', writer: '选择编剧', search: '搜索项目与剧本',
  manage: '编剧管理', missing: '剧本已删除，仍可查看对话历史。', required: '选择编剧后才能发送。',
  loading: '正在读取编剧配置…', frozen: '首条消息接纳后已固定', context: '起始上下文',
  copy: '复制', number: '编号', role: '角色', content: '正文', error: '无法读取编剧配置', empty: '没有找到剧本', refresh: '刷新',
}
export type T = (key: keyof typeof en) => string
