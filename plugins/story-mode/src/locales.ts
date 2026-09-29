/** Interface text is shared by the guide, save manager and chapter review. */
export const en = {
  openGuideHint: 'Save created. Open the right sidebar here to view Story Guide.',
  newlyUnlocked: 'Newly unlocked', openingEditor: 'Opening editor', systemEditor: 'System prompt editor', modelSelection: 'Model selection', effortPerformance: 'Reasoning effort and performance',
  chapterProgress: 'Chapter progress', currentTask: 'Current task', chapterContent: 'Chapter content', records: 'Conversation records', yourSaves: 'Your saves', number: 'Number', type: 'Type', content: 'Content',
  title: 'Story Mode', guide: 'Story Guide', newSave: 'New save', name: 'Save name', storyline: 'Storyline', project: 'Project', create: 'Create save', continue: 'Continue', review: 'Review chapter', next: 'Continue', start: 'Start performance', retry: 'Retry chapter save', completed: 'Chapter completed', continueChat: 'Continue conversation', nextChapter: 'Enter Chapter Two', unavailable: 'Chapter Two is not yet available. You can continue the conversation.', progressUpdated: 'Progress updated', showWhere: 'Show me where', dismiss: 'Dismiss hint', back: 'Return to current progress', loading: 'Loading…', model: 'Model', effort: 'Reasoning effort', noEffort: 'This model has no adjustable reasoning effort.', settings: 'Model settings', saveFirst: 'Save the current content before continuing.', noSaves: 'Create a save to begin.', readOnly: 'Chapter review', choose: 'Choose a model', edit: 'Open Playbook', saved: 'Saved', step: 'Step', saveModel: 'Use this model', example: 'Example', analysis: 'Analysis', selectionRequired: 'Select an available configured model.',
}
export type Key = keyof typeof en
export type T = (key: Key) => string
export const zh: Record<Key, string> = {
  openGuideHint: '存档已创建。点击这里展开右侧栏，查看故事引导。',
  newlyUnlocked: '新解锁', openingEditor: '开场白编辑', systemEditor: '系统提示词编辑', modelSelection: '模型选择', effortPerformance: '思考强度与演绎',
  chapterProgress: '本章进度', currentTask: '当前操作', chapterContent: '章节内容', records: '会话记录', yourSaves: '你的存档', number: '序号', type: '类型', content: '正文',
  title: '故事模式', guide: '故事引导', newSave: '新建存档', name: '存档名称', storyline: '故事线', project: '项目', create: '创建存档', continue: '继续', review: '回顾章节', next: '继续', start: '开始演绎', retry: '重试保存章节', completed: '本章已完成', continueChat: '继续对话', nextChapter: '进入第二章', unavailable: '第二章尚未开放，你可以继续对话。', progressUpdated: '进度已更新', showWhere: '定位操作', dismiss: '关闭提示', back: '返回当前进度', loading: '加载中…', model: '模型', effort: '思考强度', noEffort: '此模型没有可调的思考强度。', settings: '模型设置', saveFirst: '请先保存当前内容，再继续。', noSaves: '新建一份存档，开始故事。', readOnly: '章节回顾', choose: '选择模型', edit: '打开 Playbook', saved: '已保存', step: '步骤', saveModel: '使用此模型', example: '示例', analysis: '分析', selectionRequired: '请先选择一个已配置的模型，再继续。',
}
