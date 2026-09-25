import { TextConversations, type TextHost } from './service.ts'
export { TextConversations, TextConversation } from './service.ts'
export const name = 'papermoon-text-conversations'
export const inject = ['llm', 'settings', 'credentials', 'sessions', 'sessionController', 'agentDefaultModel']
export function apply(ctx: TextHost & { provide(name: string, value: unknown): unknown }): void {
  ctx.provide('textConversations', new TextConversations(ctx))
}
