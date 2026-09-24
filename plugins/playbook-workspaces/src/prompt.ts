/** Replace inherited host identity contributions while leaving explicit plugin additions intact. */
import type { Agent, Dispose } from './host.ts'
export function configureLiteralPrompt(agent: Agent, name: string, value: () => string): Dispose[] {
  const prompt = agent.ctx.systemPrompt, disposers: Dispose[] = []
  for (const section of ['harness:identity', 'deployment:persona-prefix', 'deployment:persona-suffix', 'harness:source', 'app:web-surface', 'ui:deliverable-file-references'])
    disposers.push(prompt.section({ name: section, order: 0, text: '' }))
  for (const context of ['sandbox:policy', 'approval:policy']) disposers.push(prompt.context({ name: context, order: 0, text: '' }))
  disposers.push(prompt.variable(name, value), prompt.section({ name, order: 0, text: '{{' + name + '}}' }))
  return disposers
}
