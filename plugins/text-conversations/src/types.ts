/** Public, JSON-safe text conversation views. No chapter policy belongs here. */
export interface ModelChoice { provider: string; model: string; reasoningEffort?: string }
export interface ModelInfo {
  provider: string; id: string; name: string; ready: boolean
  reasoning?: { efforts: readonly { id: string; name: string }[]; defaultEffort?: string }
}
export interface EventRecord { seq: number; time: number; type: string; data: Record<string, unknown> }
export interface ConversationView {
  id: string; choice?: ModelChoice; events: readonly EventRecord[]; running: boolean
  /** First completed turn; later successes and failures leave this reference unchanged. */
  successfulTurn?: number
}
