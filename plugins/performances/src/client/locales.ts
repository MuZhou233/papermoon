export const en = {
  state: 'Current state', actions: 'Action records', refresh: 'Refresh',
  start: 'Start performance', choose: 'Choose a script', search: 'Search projects and scripts', close: 'Close', cancel: 'Cancel',
  loading: 'Loading…', unavailable: 'Initialize this performance before sending.', source: 'Story source', missing: 'Source script deleted',
  revision: 'Revision', result: 'Frozen artifact', model: 'Model', reasoning: 'Reasoning effort', noArtifact: 'This revision has no compilation artifacts.',
  noRevision: 'This script has no revisions.', open: 'Open script', background: 'Story background', opening: 'Story opening', system: 'System prompt',
  copy: 'Copy', initialization: 'Performance initialization', number: 'Number', role: 'Role', content: 'Content',
}
export const zh: Record<keyof typeof en, string> = {
  state: '当前状态', actions: '动作记录', refresh: '刷新',
  start: '开始演绎', choose: '选择剧本', search: '搜索项目与剧本', close: '关闭', cancel: '取消',
  loading: '正在读取…', unavailable: '初始化演绎后才能发送。', source: '剧本来源', missing: '来源剧本已删除',
  revision: '修订版本', result: '冻结产物', model: '模型', reasoning: '推理档位', noArtifact: '这个修订版本没有编译产物。',
  noRevision: '这个剧本还没有修订版本。', open: '打开剧本', background: '剧本背景资料', opening: '剧本开场', system: '系统提示词',
  copy: '复制', initialization: '演绎初始化资料', number: '编号', role: '角色', content: '正文',
}
export type T = (key: keyof typeof en) => string
