/** Performance-local commits bind one logged call to its original value and complete state. */
import { canonical, digest } from '@papermoon/playbook-compiler/runtime'
import { PlaybookRuntime } from '@papermoon/playbook-compiler/execution'
import type { JsonObject, JsonValue } from '@papermoon/playbook-core'
import type { FunctionDeclaration } from '@papermoon/playbook-compiler/types'
import type { Agent, LogRecord } from '../../playbook-workspaces/src/host.ts'
import type { FrozenPerformance } from './model.ts'
import { ACTION_KEY } from './constants.ts'
import { activeRecords } from './worldlines.ts'
const DELIVERY_FAILURE_KEY = 'papermoon.performance.delivery-failure'
export interface Action {
  artifactId: string
  previous: string
  call: { sessionId: string; seq: number; id: string; name: string; args: JsonObject }
  state: JsonObject
  value: JsonValue
  checksum: string
}
export class PerformanceActionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'PerformanceActionError' }
}
export function renderValue(value: JsonValue) { return [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }] }
function record(event: LogRecord): Record<string, unknown> { return event.data as Record<string, unknown> }
function callArguments(event: LogRecord): unknown {
  const raw = record(event).arguments
  if (typeof raw !== 'string') throw new PerformanceActionError('corrupt-call', 'tool call arguments must be a JSON string')
  try { return JSON.parse(raw) } catch { throw new PerformanceActionError('corrupt-call', 'tool call arguments contain invalid JSON') }
}
/** Restore committed state without rerunning factories or functions. */
export function projectActions(events: readonly LogRecord[], fixed: FrozenPerformance, start?: { state: JsonObject; head: string }) {
  let state = start?.state ?? fixed.artifact.state.initial, head = start?.head ?? fixed.checksum
  const actions: { seq: number; action: Action }[] = [], calls = new Set<number>()
  for (const event of events) {
    if (event.type !== 'session/configuration' || record(event).key !== ACTION_KEY) continue
    const action = record(event).value as Action
    if (!action || typeof action !== 'object') throw new PerformanceActionError('corrupt-action', 'invalid action record')
    const { checksum, ...payload } = action
    const call = action.call
    if (action.artifactId !== fixed.artifact.id || action.previous !== head || digest(payload) !== checksum ||
      !call || !Number.isSafeInteger(call.seq) || call.seq < 0 || calls.has(call.seq) || typeof call.sessionId !== 'string' || typeof call.id !== 'string' ||
      !fixed.artifact.functions.some(fn => fn.name === call.name) || !action.state || typeof action.state !== 'object' || Array.isArray(action.state))
      throw new PerformanceActionError('corrupt-action', 'action record does not match its predecessor or frozen function')
    const original = events.find(e => e.seq === call.seq)
    if (!original || original.type !== 'tool/call' || record(original).callId !== call.id || record(original).name !== call.name || canonical(callArguments(original)) !== canonical(call.args) || event.seq === undefined || event.seq <= call.seq)
      throw new PerformanceActionError('corrupt-action', 'action has no matching earlier tool call')
    calls.add(call.seq); actions.push({ seq: event.seq, action }); state = action.state; head = checksum
  }
  return { state, head, actions }
}
export class PerformanceActions {
  private tail: Promise<unknown> = Promise.resolve()
  private readonly abort = new AbortController()
  private blocked = false
  constructor(private readonly agent: Agent, private readonly fixed: FrozenPerformance, private readonly runtime: PlaybookRuntime, private readonly flush: () => Promise<boolean>) {}
  private check() {
    if (this.abort.signal.aborted) throw new PerformanceActionError('closed', 'performance actions are closed')
    if (this.blocked) throw new PerformanceActionError('performance-save-failed', 'action persistence is unconfirmed; reopen the session before continuing')
  }
  private async durable(action?: Action) {
    try { if (!await this.flush()) throw new Error('session has no durability provider') }
    catch (error) {
      this.blocked = true
      // This marker precedes the host's error receipt, whose generic Error encoding omits plugin codes.
      if (action) this.agent.session.append('session/configuration', { key: DELIVERY_FAILURE_KEY, value: { action: action.checksum } })
      throw new PerformanceActionError('performance-save-failed', 'action persistence could not be confirmed: ' + (error instanceof Error ? error.message : String(error)))
    }
  }
  invoke(name: string, raw: unknown, callId: string, signal: AbortSignal): Promise<JsonValue> {
    const work = this.tail.then(async () => {
      this.check(); signal.throwIfAborted()
      const events = activeRecords(this.agent.session.snapshotEvents(), this.fixed)
      const call = [...events].reverse().find(event => event.type === 'tool/call' && record(event).callId === callId)
      if (call?.seq === undefined || record(call).name !== name || canonical(callArguments(call)) !== canonical(raw)) throw new PerformanceActionError('invalid-call', 'function execution requires its matching logged tool call')
      const before = projectActions(events, this.fixed), prior = before.actions.find(entry => entry.action.call.seq === call.seq)
      if (prior) { await this.durable(prior.action); return structuredClone(prior.action.value) }
      const combined = AbortSignal.any([signal, this.abort.signal])
      const result = await this.runtime.invoke(this.fixed.artifact, before.state, name, raw as JsonObject, combined)
      if (!result.ok) throw new PerformanceActionError(result.diagnostics[0]!.code, result.diagnostics.map(d => (d.location?.path ? d.location.path + (d.location.line ? ':' + d.location.line : '') + ': ' : '') + d.message).join('\n'))
      this.check(); combined.throwIfAborted()
      if (projectActions(activeRecords(this.agent.session.snapshotEvents(), this.fixed), this.fixed).head !== before.head) throw new PerformanceActionError('state-conflict', 'performance state changed before action commit')
      const payload = { artifactId: this.fixed.artifact.id, previous: before.head,
        call: { sessionId: this.agent.id, seq: call.seq, id: callId, name, args: raw as JsonObject }, state: result.state, value: result.value }
      const action: Action = { ...payload, checksum: digest(payload) }
      if (Buffer.byteLength(canonical(action)) > this.fixed.artifact.options.limits.outputBytes) throw new PerformanceActionError('output-limit', 'complete action record exceeds outputBytes')
      this.agent.session.append('session/configuration', { key: ACTION_KEY, value: action })
      await this.durable(action)
      return result.value
    })
    this.tail = work.catch(() => {}) // The invocation caller receives failures; later calls still check the persistence block.
    return work
  }
  /** Replace only interrupted/aborted receipts whose exact committed values survived. */
  async recover(fromSeq = 0, requireReceipts = false): Promise<void> {
    this.check()
    await this.tail
    this.check()
    const events = activeRecords(this.agent.session.snapshotEvents(), this.fixed), projection = projectActions(events, this.fixed)
    let changed = false
    for (const { action, seq } of projection.actions) {
      if (seq < fromSeq) continue
      const nextCall = events.find(event => event.type === 'tool/call' && record(event).callId === action.call.id && (event.seq ?? -1) > action.call.seq)
      const receipts = events.filter(event => (nextCall?.seq === undefined || (event.seq ?? -1) < nextCall.seq) && event.type === 'tool/result' && (record(event).message as { source?: { callId?: string } })?.source?.callId === action.call.id && (event.seq ?? -1) > action.call.seq)
      const receipt = receipts.at(-1)
      if (!receipt) {
        if (requireReceipts) throw new PerformanceActionError('missing-receipt', 'committed action has no durable tool result')
        continue // During execution the live tool body still owns its result.
      }
      const data = record(receipt), error = data.error as { code?: string } | undefined
      const deliveryFailed = events.some(event => event.type === 'session/configuration' && record(event).key === DELIVERY_FAILURE_KEY &&
        (record(event).value as { action?: string })?.action === action.checksum &&
        (event.seq ?? -1) > seq && (event.seq ?? Infinity) < (receipt.seq ?? -1))
      const isError = (data.message as { content?: { type: string; isError?: boolean }[] })?.content?.some(block => block.type === 'tool-result' && block.isError)
      if (!isError || (!deliveryFailed && !['TOOL_OUTCOME_UNKNOWN', 'ABORTED'].includes(error?.code ?? ''))) continue
      if (receipt.seq === undefined) throw new PerformanceActionError('corrupt-action', 'recovery receipt has no event sequence')
      const original = data.message as { id: string; content: readonly Record<string, unknown>[] }
      if (events.some(event => event.type === 'tool/result' && event.sourceEventSeqs?.includes(seq) && event.sourceEventSeqs.includes(receipt.seq!))) continue
      const { error: _error, ...retained } = data
      this.agent.session.append('tool/result', { ...retained,
        message: { ...original, content: [{ ...original.content[0], isError: false, content: renderValue(action.value) }] },
      }, { surfaceOp: { op: 'replace', startSeq: receipt.seq, endSeq: receipt.seq }, sourceEventSeqs: [receipt.seq, seq, action.call.seq] })
      changed = true
    }
    if (changed) await this.durable()
  }
  tools() {
    return this.fixed.artifact.functions.map((fn: FunctionDeclaration) => ({ name: fn.name, description: fn.description, parameters: fn.parameters,
      output: { schema: fn.output, render: (_args: unknown, value: JsonValue) => renderValue(value) },
      execute: (args: unknown, exec: { callId: string; signal: AbortSignal }) => this.invoke(fn.name, args, exec.callId, exec.signal),
    }))
  }
  dispose() { this.abort.abort() }
  async close() { this.dispose(); await this.tail }
}
