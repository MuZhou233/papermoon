import { expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { chapter } from '../src/content.ts'
test.each(['en', 'zh'] as const)('%s teaching and operation prompts match the active requirements verbatim', language => {
  const directory = new URL('../../../docs/story-mode/fogbound-earthshine/01/', import.meta.url)
  const files = readdirSync(directory).filter(file => /^0[1-5]-/.test(file) && (language === 'zh' ? file.endsWith('.zh.md') : file.endsWith('.md') && !file.endsWith('.zh.md'))).sort()
  expect(files).toHaveLength(5)
  for (const [index, file] of files.entries()) {
    const source = readFileSync(new URL(file, directory), 'utf8')
    const blocks = [...source.matchAll(/^> (.+)$/gm)].map(match => match[1]!)
    const content = chapter[language].sections[index]!
    for (const text of [...content.teaching, ...content.analysis, ...content.guidance]) expect(blocks).toContain(text)
    for (const step of content.steps) { expect(source).toContain(step.operation); expect(source).toContain(step.result) }
    expect(content.steps.length).toBeGreaterThanOrEqual(2)
    expect(blocks).toContain(content.hint)
    for (const text of content.states) expect(source).toContain(text)
    expect(content.teaching.length).toBeGreaterThanOrEqual(4)
  }
})

test('the complete system example retains all three roles and the shared opening text', () => {
  for (const language of ['en', 'zh'] as const) {
    const sections = chapter[language].sections
    expect(sections[2].examples.map(message => message.role)).toEqual(['system', 'user', 'assistant'])
    expect(sections[2].examples.slice(1)).toEqual(sections[1].examples)
    expect(sections[3].examples[0].text).toBe(sections[2].examples[0].text)
    expect(sections[3].examples[1].text).toBe(sections[2].examples[0].text)
  }
})
