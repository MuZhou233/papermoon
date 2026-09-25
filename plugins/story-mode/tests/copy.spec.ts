import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { en, zh } from '../src/locales.ts'
import { exampleEvents, prompt } from '../src/example.ts'

it('uses only the confirmed requirement text in each locale, including plugin metadata', () => {
  for (const [language, dictionary] of Object.entries({ en, zh })) {
    const suffix = language === 'en' ? '.md' : '.zh.md'
    const documents = [join('docs/story-mode', 'README' + suffix), ...readdirSync('docs/story-mode/00').filter(name => language === 'en' ? name.endsWith('.md') && !name.endsWith('.zh.md') : name.endsWith('.zh.md')).map(name => join('docs/story-mode/00', name))]
    const text = documents.map(path => readFileSync(path, 'utf8')).join('\n')
    for (const [key, value] of Object.entries(dictionary)) expect(text, `${language}:${key}`).toContain(value)
    const metadata = JSON.parse(readFileSync(`plugins/story-mode/locale/${language}.json`, 'utf8')).meta
    expect(metadata.title).toBe(dictionary.title)
    expect(metadata.description).toBe(dictionary.intro)
    expect(text).toContain(prompt)
    for (const event of exampleEvents.filter(event => event.type === 'assistant/message' || event.type === 'user/message')) {
      const message = event.type === 'user/message' ? event.data : event.data.message as { content: { text: string }[] }
      for (const block of message.content as { text: string }[]) expect(text).toContain(block.text)
    }
  }
})
