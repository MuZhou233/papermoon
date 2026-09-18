/** Minimal public host faces; the logical model does not depend on DSH packages. */
import type { ToolHost } from '../../story-tools/src/plugin.ts'
export interface LogRecord { seq?: number; time?: number; type: string; data: unknown; sourceEventSeqs?: readonly number[] }
export interface SessionLog { header: { agentPreset?: string }; snapshotEvents(): readonly LogRecord[] }
export interface InitialMessage { index: number; groupId: string; name?: string; message: { id: string; role: 'user' | 'assistant'; content: { type: 'text'; text: string }[]; source: { kind: 'plugin'; plugin: string } } }
export type Dispose = () => void
export interface InputMessage { id: string; role: 'user'; content: readonly unknown[]; source: { kind: string; admission?: Readonly<Record<string, unknown>>; [key: string]: unknown } }
export interface Agent {
  id: string
  status: string
  ctx: ToolHost & {
    on(name: 'agent/request-messages', listener: (payload: { agent: Agent; turn: number; step: number; signal: AbortSignal }, next: () => Promise<number | undefined>) => Promise<number | undefined>): Dispose
    on(name: 'agent/pre-step', listener: (payload: { agent: Agent; signal: AbortSignal }, next: () => Promise<Decision>) => Promise<Decision>): Dispose
    systemPrompt: {
      context(context: { name: string; order: number; text: string }): Dispose
      section(section: { name: string; order: number; text: string }): Dispose
      variable(name: string, provider: () => string): Dispose
    }
    tools: ToolHost['tools'] & { presentAs(mode: 'native'): Dispose }
  }
  session: SessionLog & { deriveRequestMessages(seq?: number): RequestMessage[]; append(type: string, data: unknown, intent?: { surfaceOp: 'append' | { op: 'replace'; startSeq: number; endSeq: number }; sourceEventSeqs?: number[] }): unknown }
  inbox: { clear(): void; nextTurn: readonly unknown[]; nextStep: readonly unknown[] }
  followup(message: InputMessage): void
  whenIdle(): Promise<void>
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>
}
export type Decision = { kind: 'enter'; messages: InputMessage[]; initialMessages?: InitialMessage[] } | { kind: 'reject'; [key: string]: unknown }
export interface Workspace { id: string; title: string; setTitle(title: string): Promise<void>; target?: { provider: string; key: string }; path: string; sessionIds: readonly string[]; attachSession(id: string): Promise<void>; detachSession(id: string): Promise<void> }
export interface Host {
  get(key: string): unknown
  provide(key: string, value: unknown): Dispose
  effect(body: () => Iterable<Dispose, void>, label?: string): unknown
  on(name: 'session/event', listener: (session: Agent['session'], event: LogRecord) => void): Dispose
  on(name: 'agent/created', listener: (payload: { agent: Agent }) => void): Dispose
  on(name: 'agent-preset/selected', listener: (sessionId: string, preset: string) => void): Dispose
  on(name: 'agent-preset/changed', listener: (agent: Agent, preset: string) => Promise<void>): Dispose
  on(name: 'agent-preset/selecting', listener: (agent: Agent, preset: string) => Promise<void>): Dispose
  on(name: 'session/created-for-client', listener: (agent: Agent, workspace?: Workspace) => Promise<void>): Dispose
  on(name: 'session/prompt-accepted', listener: (agent: Agent, message: InputMessage) => Promise<void>): Dispose
  on(name: 'session/prompt-admission', listener: (agent: Agent, message: InputMessage, next: () => Promise<InputMessage | null>) => Promise<InputMessage | null>): Dispose
  agents: { get(id: string): Agent | undefined; list(): Agent[] }
  agentPresets: { select(agent: Agent, preset: string): Promise<string> }
  sessionController: {
    submitUserInput(request: { sessionId: string; requestId: string; mode: 'queue'; content: readonly unknown[]; historyVersion: number; clientTimeZone?: string; admission: Readonly<Record<string, unknown>> }): Promise<unknown>
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

/** Minimal immutable model message consumed by the request selection adapter. */
export interface RequestMessage { readonly id: string; readonly role: 'system' | 'user' | 'assistant'; readonly content: readonly unknown[]; readonly source: Readonly<Record<string, unknown>> }
export type RequestPart = { eventSeq: number } | { message: RequestMessage; name?: string }
