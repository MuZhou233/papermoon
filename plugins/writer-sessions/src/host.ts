/** Minimal public host faces; the logical model does not depend on DSH packages. */
import type { StoryRepository } from '@papermoon/story-core/repository'
import type { WriterRepository } from '../../writers/src/repository.ts'
import type { ToolHost } from '../../story-tools/src/plugin.ts'
import type { SessionLog, LogRecord, initialContext } from './model.ts'
export type Dispose = () => void
export interface InputMessage { id: string; role: 'user'; content: readonly unknown[]; source: { kind: string; admission?: Readonly<Record<string, unknown>>; [key: string]: unknown } }
export interface Agent {
  id: string
  status: string
  ctx: ToolHost & {
    on(name: 'agent/pre-step', listener: (payload: { agent: Agent; signal: AbortSignal }, next: () => Promise<Decision>) => Promise<Decision>): Dispose
    systemPrompt: {
      context(context: { name: string; order: number; text: string }): Dispose
      section(section: { name: string; order: number; text: string }): Dispose
      variable(name: string, provider: () => string): Dispose
    }
    tools: ToolHost['tools'] & { presentAs(mode: 'native'): Dispose }
  }
  session: SessionLog & { append(type: string, data: unknown): unknown }
  inbox: { nextTurn: readonly unknown[]; nextStep: readonly unknown[] }
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>
}
export type Decision = { kind: 'enter'; messages: InputMessage[]; initialMessages?: ReturnType<typeof initialContext> } | { kind: 'reject'; [key: string]: unknown }
export interface Workspace { id: string; title: string; setTitle(title: string): Promise<void>; target?: { provider: string; key: string }; path: string; sessionIds: readonly string[]; attachSession(id: string): Promise<void>; detachSession(id: string): Promise<void> }
export interface Host {
  get(key: string): unknown
  provide(key: string, value: unknown): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
  on(name: 'agent/created', listener: (payload: { agent: Agent }) => void): Dispose
  on(name: 'agent-preset/selected', listener: (sessionId: string, preset: string) => void): Dispose
  on(name: 'agent-preset/changed', listener: (agent: Agent, preset: string) => Promise<void>): Dispose
  on(name: 'agent-preset/selecting', listener: (agent: Agent, preset: string) => Promise<void>): Dispose
  on(name: 'session/created-for-client', listener: (agent: Agent, workspace?: Workspace) => Promise<void>): Dispose
  on(name: 'session/prompt-admission', listener: (agent: Agent, message: InputMessage, next: () => Promise<InputMessage>) => Promise<InputMessage>): Dispose
  agents: { get(id: string): Agent | undefined; list(): Agent[] }
  agentPresets: { select(agent: Agent, preset: string): Promise<string> }
  sessionController: {
    resolveAgent(id: string): Promise<{ agent: Agent } | { error: unknown }>
    inspect(id: string): Promise<{ events: readonly LogRecord[]; meta: SessionLog['header'] }>
  }
  workspaceRegistry: {
    list(): Workspace[]
    createResource(target: { provider: string; key: string }): Promise<Workspace>
    registerResourceProvider(name: string, provider: { resolve(key: string): Promise<{ title: string; cwd: string } | undefined>; accepts(key: string, sessionId: string): Promise<boolean> }): Dispose
  }
  connection: { fetch: { register(route: { path: string; methods: readonly 'POST'[]; requestBody: 'buffered'; fetch(request: Request): Promise<Response> }): Dispose } }
}
export interface Services { core: StoryRepository; writers: WriterRepository }
