/** Immutable turn nodes and selections reconstructed from the complete execution log. */
import { randomUUID } from 'node:crypto'
import { digest, canonical } from '@papermoon/playbook-compiler/runtime'
import type { Agent, InputMessage, LogRecord } from '../../playbook-workspaces/src/host.ts'
import type { FrozenPerformance } from './model.ts'
import { projectActions, type PerformanceActions } from './actions.ts'
export const WORLDLINE = 'papermoon.worldline'
export interface Range { start: number; end: number }
export interface Run { id: string; parent: string; operationId: string; input: InputMessage; rerollOf?: string; editedFrom?: string }
export interface WorldNode {
  id: string; parent: string | null; ordinal: number; ranges: Range[]; input?: InputMessage; rerollOf?: string; editedFrom?: string
  outcome: string; stateHead: string; requests: number[]; response: string; sealedAt: number
}
interface Fact {
  namespace: typeof WORLDLINE; artifact: string; operationId: string; identity: string
  kind: 'root' | 'begin' | 'seal' | 'select'; node?: WorldNode; run?: Run; selected: string; checksum: string
}
export class WorldlineError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'WorldlineError' }
}
function fail(message: string): never { throw new WorldlineError('worldline-corrupt', message) }
function data(event: LogRecord) { return event.data as { version: number; ranges: Range[]; metadata: Fact } }
export function pathTo(nodes: ReadonlyMap<string, WorldNode>, id: string): WorldNode[] {
  const result: WorldNode[] = [], seen = new Set<string>()
  let current: string | null = id
  while (current !== null) {
    if (seen.has(current)) fail('worldline ancestry contains a cycle')
    seen.add(current)
    const node = nodes.get(current); if (!node) fail('worldline node is missing')
    result.unshift(node); current = node.parent
  }
  return result
}
export function pathRanges(nodes: ReadonlyMap<string, WorldNode>, id: string): Range[] { return pathTo(nodes, id).flatMap(node => node.ranges) }
/** Read one immutable node path, retaining raw coordinates and excluding jump operations. */
export function recordsFor(events: readonly LogRecord[], ranges: readonly Range[]): LogRecord[] {
  return events.filter(event => event.seq !== undefined && event.type !== 'history/selected' && ranges.some(range => event.seq! >= range.start && event.seq! <= range.end))
}
const foldCache = new WeakMap<readonly LogRecord[], { length: number; checksum: string; value: ReturnType<typeof foldWorldlines> }>()
export function worldlineState(events: readonly LogRecord[], fixed: FrozenPerformance) {
  const cached = foldCache.get(events)
  if (cached?.length === events.length && cached.checksum === fixed.checksum) return cached.value
  const value = foldWorldlines(events, fixed)
  foldCache.set(events, { length: events.length, checksum: fixed.checksum, value })
  return value
}
function foldWorldlines(events: readonly LogRecord[], fixed: FrozenPerformance) {
  const nodes = new Map<string, WorldNode>(), operations = new Map<string, { identity: string; selected: string; kind: Fact['kind'] }>()
  const remembered = new Map<string, string>()
  const states = new Map<string, ReturnType<typeof projectActions>>()
  let selected = '', version = 0, pending: (Run & { start: number }) | undefined
  for (const event of events) {
    if (event.type !== 'history/selected') continue
    const record = data(event), fact = record.metadata
    if (fact?.namespace !== WORLDLINE) fail('performance contains an unowned history selection')
    const { checksum, ...payload } = fact
    if (fact.artifact !== fixed.checksum || digest(payload) !== checksum || event.seq === undefined || record.version !== version + 1) fail('worldline selection is damaged')
    if (fact.kind === 'root' || fact.kind === 'seal') {
      const node = fact.node
      if (!node || nodes.has(node.id) || node.ordinal !== nodes.size || (fact.kind === 'root' ? nodes.size !== 0 || node.parent !== null : !pending || node.id !== pending.id || node.parent !== pending.parent)) fail('worldline node identity is inconsistent')
      if (node.ranges.some(range => !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start || range.end >= event.seq!)) fail('worldline node contains invalid execution references')
      nodes.set(node.id, node)
      const projected = projectActions(recordsFor(events, node.ranges), fixed, node.parent === null ? undefined : states.get(node.parent))
      states.set(node.id, projected)
      if (projected.head !== node.stateHead) fail('worldline state does not match its committed actions')
      pending = undefined
    } else if (fact.kind === 'begin') {
      if (pending || !fact.run || !nodes.has(fact.run.parent) || fact.run.parent !== fact.selected) fail('worldline execution parent is invalid')
      pending = { ...fact.run, start: event.seq + 1 }
    } else if (fact.kind !== 'select' || pending) fail('worldline selection occurred during generation')
    if (!nodes.has(fact.selected) || canonical(pathRanges(nodes, fact.selected)) !== canonical(record.ranges)) fail('selected history differs from node ancestry')
    selected = fact.selected; version = record.version
    for (const ancestor of pathTo(nodes, selected)) remembered.set(ancestor.id, selected)
    const previous = operations.get(fact.operationId)
    if (previous && previous.identity !== fact.identity) fail('worldline operation identity changed')
    operations.set(fact.operationId, { identity: fact.identity, selected, kind: fact.kind })
  }
  return { nodes, operations, remembered, selected, version, pending }
}
export function activeRecords(events: readonly LogRecord[], fixed: FrozenPerformance) {
  const state = worldlineState(events, fixed)
  const ranges = pathRanges(state.nodes, state.selected)
  if (state.pending && events.length > state.pending.start) ranges.push({ start: state.pending.start, end: events.length - 1 })
  return recordsFor(events, ranges)
}
export type WorldOperation = { operationId: string; expectedVersion: number; nodeId: string; clientTimeZone?: string } & (
  { kind: 'select' | 'candidate' | 'reroll' } | { kind: 'edit'; text: string }
)
/** Serializes durable selection operations with Agent admission and completion. */
export class Worldlines {
  private blocked?: Error
  private settling?: Promise<void>
  private disposed = false
  private readonly operations = new Map<string, { identity: string; task: Promise<{ selected: string }> }>()
  constructor(private readonly agent: Agent, private readonly fixed: FrozenPerformance,
    private readonly flush: () => Promise<boolean>, private readonly actions: PerformanceActions,
    private readonly submit: (content: readonly unknown[], operation: WorldOperation) => Promise<unknown>) {}
  state() { return worldlineState(this.agent.session.snapshotEvents(), this.fixed) }
  private check() { if (this.disposed) throw new WorldlineError('worldline-closed', 'worldline is closed'); if (this.blocked) throw this.blocked }
  private async durable() {
    try { if (!await this.flush()) throw new Error('session has no durability provider') }
    catch (error) { this.blocked = new WorldlineError('worldline-save-failed', 'worldline persistence is unconfirmed: ' + String(error)); throw this.blocked }
  }
  private async append(fact: Omit<Fact, 'checksum' | 'namespace' | 'artifact'>, ranges: Range[]) {
    this.check()
    const state = this.state(), payload = { ...fact, namespace: WORLDLINE, artifact: this.fixed.checksum }
    this.agent.session.append('history/selected', { version: state.version + 1, ranges, metadata: { ...payload, checksum: digest(payload) } })
    await this.durable()
  }
  async initialize() {
    if (this.state().nodes.size) return
    const end = this.agent.session.snapshotEvents().length - 1
    const node: WorldNode = { id: randomUUID(), parent: null, ordinal: 0, ranges: end < 0 ? [] : [{ start: 0, end }], outcome: 'initialized', stateHead: this.fixed.checksum, requests: [], response: '', sealedAt: Date.now() }
    await this.append({ kind: 'root', node, selected: node.id, operationId: 'initialize', identity: this.fixed.checksum }, node.ranges)
  }
  private idle() {
    this.check()
    if (this.agent.status !== 'idle' || this.agent.inbox.nextTurn.length || this.agent.inbox.nextStep.length || this.state().pending)
      throw new WorldlineError('worldline-busy', 'wait for the current execution to be sealed')
  }
  private expected(version: unknown) {
    if (version !== this.state().version) throw new WorldlineError('worldline-conflict', 'worldline selection changed; refresh before retrying')
  }
  async admit(message: InputMessage, persist = true): Promise<InputMessage | null> {
    this.check()
    const state = this.state()
    if (!state.nodes.has(state.selected)) fail('worldline initialization is missing')
    const operation = message.source.admission?.[WORLDLINE] as WorldOperation | undefined
    const operationId = typeof message.source.rpcId === 'string' ? message.source.rpcId : message.id
    const prior = state.operations.get(operationId), identity = canonical(operation ?? message.content)
    if (prior) {
      if (prior.identity !== identity) throw new WorldlineError('worldline-conflict', 'operation ID was used with different input')
      return null
    }
    this.idle(); this.expected(message.source.admission?.historyVersion)
    let parent = state.selected
    const origin: { rerollOf?: string; editedFrom?: string } = {}
    if (operation) {
      const target = state.nodes.get(operation.nodeId)
      if (!target?.parent || !target.input || !['reroll', 'edit'].includes(operation.kind)) throw new WorldlineError('worldline-root', 'input requires a completed non-root node')
      parent = target.parent
      if (operation.kind === 'reroll') origin.rerollOf = target.id
      else origin.editedFrom = target.id
    }
    if (!persist) return message
    const run: Run = { id: randomUUID(), parent, operationId, input: structuredClone(message), ...origin }
    await this.append({ kind: 'begin', run, selected: run.parent, operationId, identity }, pathRanges(state.nodes, run.parent))
    return message
  }
  validateInput(messages: readonly InputMessage[]) {
    const pending = this.state().pending
    if (!pending || messages.some(message => message.source.kind === 'user' && message.id !== pending.input.id)) throw new WorldlineError('worldline-input', 'performance input requires worldline admission')
  }
  async operate(request: WorldOperation) {
    this.check()
    const identity = canonical(request), pending = this.operations.get(request.operationId)
    if (pending) {
      if (pending.identity !== identity) throw new WorldlineError('worldline-conflict', 'operation ID was used with different parameters')
      return pending.task
    }
    const task = this.performOperation(request)
    this.operations.set(request.operationId, { identity, task })
    try { return await task } finally { this.operations.delete(request.operationId) }
  }
  private async performOperation(request: WorldOperation) {
    this.check()
    const before = this.state(), identity = canonical(request), prior = before.operations.get(request.operationId)
    if (prior) {
      if (prior.identity !== identity) throw new WorldlineError('worldline-conflict', 'operation ID was used with different parameters')
      return { selected: prior.selected }
    }
    if (request.kind === 'reroll' || request.kind === 'edit') {
      const target = before.nodes.get(request.nodeId)
      if (!target?.parent || !target.input) throw new WorldlineError('worldline-root', 'the initial node cannot be rerolled or edited')
      let content = structuredClone(target.input.content)
      if (request.kind === 'edit') {
        let inserted = false
        content = content.flatMap(part => {
          if (part && typeof part === 'object' && 'type' in part && part.type === 'text') {
            if (inserted) return []
            inserted = true
            return [{ type: 'text', text: request.text }]
          }
          return [part]
        })
        if (!inserted) content = [{ type: 'text', text: request.text }, ...content]
      }
      await this.submit(content, request)
      return { selected: this.state().selected }
    }
    return this.agent.runMaintenance(async signal => {
      signal.throwIfAborted(); this.idle(); this.expected(request.expectedVersion)
      const state = this.state(), target = state.nodes.get(request.nodeId)
      if (!target) throw new WorldlineError('worldline-not-found', 'worldline node does not exist')
      const selected = request.kind === 'candidate' ? state.remembered.get(target.id) ?? target.id : target.id
      await this.append({ kind: 'select', selected, operationId: request.operationId, identity }, pathRanges(state.nodes, selected))
      return { selected }
    })
  }

  /** Seal only after the Agent has released all execution and tool work. */
  settle(): Promise<void> {
    if (this.settling) return this.settling
    const task = this.agent.whenIdle().then(() => this.agent.runMaintenance(async () => {
      this.check()
      const state = this.state(), run = state.pending
      if (!run) return
      if (this.agent.inbox.nextTurn.length || this.agent.inbox.nextStep.length) {
        const queued = [...this.agent.inbox.nextTurn, ...this.agent.inbox.nextStep] as InputMessage[]
        if (queued.some(input => input.id !== run.input.id)) fail('pending execution contains unrelated queued input')
        this.agent.inbox.clear()
      }
      const accepted = this.agent.session.snapshotEvents().some(event => (event.seq ?? -1) >= run.start
        && (event.type === 'user/message' ? (event.data as InputMessage).id === run.input.id
          : event.type === 'context/message' && (event.data as { message: InputMessage }).message.id === run.input.id))
      if (!accepted) this.agent.session.append('context/message', {
        groupId: WORLDLINE + ':' + run.id, index: 0,
        message: run.input,
      }, { surfaceOp: 'append' })
      await this.actions.recover(run.start, true)
      await this.durable()
      const events = this.agent.session.snapshotEvents(), records = events.filter(event => (event.seq ?? -1) >= run.start)
      const ending = records.findLast(event => event.type === 'turn/end')?.data as { reason?: { kind: string } } | undefined
      const result = projectActions(activeRecords(events, this.fixed), this.fixed)
      const node: WorldNode = { id: run.id, parent: run.parent, ordinal: state.nodes.size, input: run.input,
        ...(run.rerollOf ? { rerollOf: run.rerollOf } : {}), ...(run.editedFrom ? { editedFrom: run.editedFrom } : {}), ranges: events.length > run.start ? [{ start: run.start, end: events.length - 1 }] : [],
        stateHead: result.head, outcome: ending?.reason?.kind ?? 'interrupted', sealedAt: Date.now(),
        requests: records.filter(event => event.type === 'assistant/message' || event.type === 'assistant/attempt').map(event => event.seq!),
        response: records.filter(event => event.type === 'assistant/message').flatMap(event => ((event.data as { message: { content: { type: string; text?: string }[] } }).message.content).flatMap(block => block.type === 'text' ? [block.text ?? ''] : [])).join('\n').slice(0, 500) }
      const nodes = new Map(state.nodes); nodes.set(node.id, node)
      await this.append({ kind: 'seal', node, selected: node.id, operationId: run.operationId, identity: state.operations.get(run.operationId)!.identity }, pathRanges(nodes, node.id))
    }))
    this.settling = task
    void task.catch(error => { this.blocked = error instanceof Error ? error : new Error(String(error)) }).finally(() => { if (this.settling === task) this.settling = undefined })
    return task
  }
  async ready() { if (this.state().pending && this.agent.status === 'idle' && !this.settling) this.settle(); if (this.settling) await this.settling; this.check() }
  dispose() { this.disposed = true }
}
