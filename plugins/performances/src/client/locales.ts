export const en = {
  node: 'Node', turnContent: 'Input and reply', browseHint: 'Browsing leaves the current worldline unchanged.',
  completed: 'Completed', interrupted: 'Interrupted', aborted: 'Cancelled', failed: 'Failed', truncated: 'Output limit', blocked: 'Blocked', nodeState: 'State at this node', switchHere: 'Switch to here', worldlines: 'Worldlines', rootNode: 'Initial context', currentNode: 'Current', onPath: 'Current path', inspectNode: 'Inspect node', locateCurrent: 'Locate current',
  branchHere: 'Continue from here', reroll: 'Reroll', editInput: 'Edit message', editInputHint: 'Submitting creates a new branch before this message. The original message and reply stay in history; attachments are retained.', submitEdit: 'Submit and regenerate', inputText: 'Message text', candidates: 'Historical results',
  generating: 'Generating. You can edit your next message; sending and switching are available after this turn is saved.', legacy: 'This performance remains available for reading. Start a new performance to use worldlines.',
  previousNodes: 'Previous nodes', noReply: 'No reply text', records: 'Execution and request records', loadMore: 'Load more nodes',
  state: 'Current state', actions: 'Action records', refresh: 'Refresh',
  start: 'Start performance', choose: 'Choose a script', search: 'Search projects and scripts', close: 'Close', cancel: 'Cancel',
  loading: 'Loading…', unavailable: 'Initialize this performance before sending.', source: 'Story source', missing: 'Source script deleted',
  revision: 'Revision', result: 'Frozen artifact', model: 'Model', reasoning: 'Reasoning effort', noArtifact: 'This revision has no compilation artifacts.',
  noRevision: 'This script has no revisions.', open: 'Open script', background: 'Story background', opening: 'Story opening', system: 'System prompt',
  copy: 'Copy', initialization: 'Performance initialization', number: 'Number', role: 'Role', content: 'Content',
}
export const zh: Record<keyof typeof en, string> = {
  node: '节点', turnContent: '输入与回复', browseHint: '浏览不改变当前世界线。',
  completed: '已完成', interrupted: '已中断', aborted: '已取消', failed: '失败', truncated: '输出达到上限', blocked: '已阻止', nodeState: '节点状态', switchHere: '切换到这里', worldlines: '世界线', rootNode: '起始上下文', currentNode: '当前位置', onPath: '当前路径', inspectNode: '查看节点', locateCurrent: '定位当前位置',
  branchHere: '从这里继续', reroll: '重 roll', editInput: '编辑消息', editInputHint: '提交后从这条消息之前生成新分支。原消息和回复保留在历史中，附件保持不变。', submitEdit: '提交并重新生成', inputText: '消息正文', candidates: '历史结果',
  generating: '正在生成。可以编辑下一条消息，本轮保存后才能发送或切换世界线。', legacy: '这个演绎仍可查阅。使用世界线功能需要新开演绎。',
  previousNodes: '前一页节点', noReply: '没有回复正文', records: '执行与请求记录', loadMore: '加载更多节点',
  state: '当前状态', actions: '动作记录', refresh: '刷新',
  start: '开始演绎', choose: '选择剧本', search: '搜索项目与剧本', close: '关闭', cancel: '取消',
  loading: '正在读取…', unavailable: '初始化演绎后才能发送。', source: '剧本来源', missing: '来源剧本已删除',
  revision: '修订版本', result: '冻结产物', model: '模型', reasoning: '推理档位', noArtifact: '这个修订版本没有编译产物。',
  noRevision: '这个剧本还没有修订版本。', open: '打开剧本', background: '剧本背景资料', opening: '剧本开场', system: '系统提示词',
  copy: '复制', initialization: '演绎初始化资料', number: '编号', role: '角色', content: '正文',
}
export type T = (key: keyof typeof en) => string
