import { applyOperations, createContent } from '../src/index.ts'
export const station = () => applyOperations(createContent({ defaultLanguage: 'zh-CN', metadata: { kind: 'station' } }), [
  { kind: 'create-file', path: 'entry.mjs', source: 'export const greet = t("greeting")\n// unfinished:', metadata: { role: 'entry' } },
  { kind: 'create-file', path: 'rules/clock.ts', source: 'export const duration = 3' },
  { kind: 'add-language', language: 'en', metadata: { label: 'English' } },
  { kind: 'create-text', key: 'greeting', description: 'First greeting', metadata: { speaker: 'host' } },
  { kind: 'set-translation', key: 'greeting', language: 'zh-CN', text: '你好，{name}。', metadata: { reviewed: true } },
  { kind: 'set-translation', key: 'greeting', language: 'en', text: 'Hello, {name}.' },
  { kind: 'create-text', key: 'alarm', description: 'A deliberately incomplete translation' },
  { kind: 'set-translation', key: 'alarm', language: 'zh-CN', text: '' },
])
export const workshop = () => applyOperations(createContent({ defaultLanguage: 'fr' }), [
  { kind: 'create-file', path: 'atelier.rule', source: 'unfinished rule' },
  { kind: 'create-text', key: 'tools/hammer', description: 'inventory label' },
  { kind: 'set-translation', key: 'tools/hammer', language: 'fr', text: 'Marteau' },
])
