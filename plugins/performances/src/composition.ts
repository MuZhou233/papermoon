/** Per-worldline input assembly; continued requests cite the fixed base and actual execution. */
import { canonical, digest } from '@papermoon/story-compiler/runtime'
import type { StoryRuntime } from '@papermoon/story-compiler/execution'
import type { CompositionInput, CompositionPlan, JsonValue, Diagnostic } from '@papermoon/story-compiler/types'
import type { Agent, LogRecord, RequestMessage, RequestPart } from '../../story-workspaces/src/host.ts'
import { projectActions } from './actions.ts'
import { openingMessages, type FrozenPerformance } from './model.ts'
import { pathTo, pathRanges, recordsFor, worldlineState, activeRecords } from './worldlines.ts'
export const CONTEXT_NAMESPACE = 'papermoon.context'
export const CONTEXT_ERROR = 'papermoon.context.error'
export interface ContextOrigin { kind: 'history' | 'opening' | 'input' | 'authored' | 'continuation' | 'plugin'; ref?: string; nodeId?: string; eventSeq?: number; name?: string; hash?: string }
export interface ContextMetadata {
  namespace: typeof CONTEXT_NAMESPACE; version: 1; runId: string; parentId: string; artifactId: string; inputId: string; stateHead: string
  origins: ContextOrigin[]; plan?: CompositionPlan; checksum: string
}
export interface RequestRecord { version: 1; turn: number; step: number; base?: number; messages: RequestPart[]; metadata: ContextMetadata }
export class ContextError extends Error { constructor(readonly code: string, message: string, readonly diagnostics?: Diagnostic[]) { super(message); this.name = 'ContextError' } }
function fail(message: string): never { throw new ContextError('context-record-invalid', message) }
export function eventMessage(event: LogRecord): RequestMessage | undefined {
  const data = event.data as { message?: RequestMessage }
  const message = event.type === 'user/message' ? event.data as RequestMessage : ['context/message','assistant/message','tool/result','system/message'].includes(event.type) ? data.message : undefined
  return message && (event.type === 'user/message' || message.content.length > 0) ? message : undefined
}
function blocks(events: readonly LogRecord[], nodeId: string, excluded: ReadonlySet<string>) {
  const messages = events.filter(event => { const m = eventMessage(event); return m && m.role !== 'system' && !excluded.has(m.id) })
  const consumed = new Set<number>(), result: { id: string; role: 'user' | 'assistant'; seqs: number[]; nodeId: string }[] = []
  for (const event of messages) {
    if (event.seq === undefined) fail('history message has no sequence')
    if (consumed.has(event.seq) || event.type === 'tool/result') continue
    const message = eventMessage(event)!, seqs = [event.seq]
    const calls = message.content.filter((b): b is {type: 'tool-call'; id: string} => !!b && typeof b === 'object' && (b as {type?: string}).type === 'tool-call')
    const receipts: number[] = []
    for (const call of calls) {
      const coordinates = event.data as {turn: number; step: number}
      const receipt = messages.findLast(candidate => candidate.type === 'tool/result' && candidate.seq! > event.seq! &&
        (candidate.data as {turn: number; step: number}).turn === coordinates.turn && (candidate.data as {step: number}).step === coordinates.step && eventMessage(candidate)?.source.callId === call.id)
      if (!receipt || receipt.seq === undefined) fail('history tool block has an incomplete result')
      receipts.push(receipt.seq); consumed.add(receipt.seq)
      for (const replaced of messages.filter(candidate => candidate.type === 'tool/result' && (candidate.data as {turn: number; step: number}).turn === coordinates.turn && (candidate.data as {step: number}).step === coordinates.step && eventMessage(candidate)?.source.callId === call.id)) consumed.add(replaced.seq!)
    }
    seqs.push(...receipts.sort((a,b) => a-b))
    result.push({ id: 'history:' + event.seq, role: message.role as 'user' | 'assistant', seqs, nodeId })
  }
  for (const event of messages) if (event.type === 'tool/result' && !consumed.has(event.seq!)) fail('history tool result has no paired assistant')
  return result
}
/** Build the small script input and retain source bodies only in the host. */
export function compositionSources(events: readonly LogRecord[], fixed: FrozenPerformance) {
  const tree = worldlineState(events, fixed), run = tree.pending
  if (!run) fail('composition requires an admitted worldline execution')
  const openings = openingMessages(fixed), excluded = new Set(openings.map(entry => entry.message.id))
  const references = new Map<string, { parts: RequestPart[]; origins: ContextOrigin[] }>()
  for (const entry of openings) {
    const event = events.find(event => eventMessage(event)?.id === entry.message.id)
    if (event?.seq === undefined) fail('opening message has not been admitted')
    references.set(entry.message.id, { parts: [{ eventSeq: event.seq }], origins: [{kind:'opening',ref:entry.message.id,eventSeq:event.seq,...(entry.name === undefined ? {} : {name:entry.name})}] })
  }
  const history = pathTo(tree.nodes, run.parent).filter(node => node.parent !== null).map(node => {
    const entries = blocks(recordsFor(events, node.ranges), node.id, excluded)
    for (const block of entries) references.set(block.id, { parts: block.seqs.map(eventSeq => ({eventSeq})), origins: block.seqs.map(eventSeq => ({kind:'history',ref:block.id,nodeId:node.id,eventSeq})) })
    return { id: node.id, outcome: node.outcome, blocks: entries.map(({id,role}) => ({id,role})) }
  })
  const actualInput = events.findLast(event => event.seq! >= run.start && eventMessage(event)?.id === run.input.id)
  if (actualInput?.seq === undefined) fail('current input has not been admitted')
  references.set(run.input.id, { parts: [{ eventSeq: actualInput.seq }], origins: [{kind:'input',ref:run.input.id,eventSeq:actualInput.seq,nodeId:run.id}] })
  const state = projectActions(recordsFor(events, pathRanges(tree.nodes, run.parent)), fixed)
  const input: CompositionInput = {
    opening: { systemPrompt: fixed.artifact.context.systemPrompt, ...(fixed.artifact.context.systemPromptName === undefined ? {} : {systemPromptName: fixed.artifact.context.systemPromptName}), messages: openings.map(entry => ({id:entry.message.id,role:entry.message.role,...(entry.name === undefined ? {} : {name:entry.name})})) },
    history, input: { id: run.input.id, content: run.input.content as readonly JsonValue[] }, state: state.state,
  }
  return { input, references, run, stateHead: state.head }
}
export function contextRecord(event: LogRecord): RequestRecord | undefined {
  if (event.type !== 'request/messages') return undefined
  const value = event.data as RequestRecord
  if (value.metadata?.namespace !== CONTEXT_NAMESPACE) return undefined
  const { checksum, ...metadata } = value.metadata
  if (value.version !== 1 || metadata.version !== 1 || !Array.isArray(value.messages) || !Array.isArray(metadata.origins) || metadata.origins.length !== value.messages.length || digest({base:value.base ?? null,messages:value.messages,metadata}) !== checksum) fail('request composition checksum does not match')
  return value
}
/** Owns first-round composition and blocks further requests after uncertain persistence. */
export class PerformanceContext {
  private blocked = false
  constructor(private readonly agent: Agent, private readonly fixed: FrozenPerformance, private readonly execution: StoryRuntime, private readonly flush: () => Promise<boolean>) {}
  assertAvailable() { if (this.blocked) throw new ContextError('context-save-failed', 'context persistence is unconfirmed; reopen the session before continuing') }
  async request(turn: number, step: number, signal: AbortSignal): Promise<number> {
    if (this.blocked) throw new ContextError('context-save-failed', 'context persistence is unconfirmed; reopen the session before continuing')
    let events = this.agent.session.snapshotEvents()
    const tree = worldlineState(events, this.fixed), run = tree.pending
    if (!run) fail('request requires an admitted execution')
    const existing = events.find(event => { const value = contextRecord(event); return value?.metadata.runId === run.id && value.base === undefined })
    let parts: RequestPart[], origins: ContextOrigin[], plan: CompositionPlan | undefined, stateHead: string
    try {
      signal.throwIfAborted()
      if (existing) {
        const base = contextRecord(existing)!
        if (base.metadata.artifactId !== this.fixed.artifact.id || base.metadata.parentId !== run.parent || base.metadata.inputId !== run.input.id) fail('context base differs from its worldline')
        stateHead = base.metadata.stateHead
        const tail = events.filter(event => event.seq! > existing.seq! && eventMessage(event))
        parts = tail.map(event => ({eventSeq:event.seq!})); origins = tail.map(event => ({kind:'continuation',eventSeq:event.seq!}))
      } else {
        const source = compositionSources(events, this.fixed)
        const result = await this.execution.compose(this.fixed.artifact, source.input, signal)
        if (!result.ok) throw new ContextError(result.diagnostics[0]!.code, result.diagnostics.map(d => (d.location?.field ? d.location.field + ': ' : '') + d.message).join('\n'), result.diagnostics)
        events = this.agent.session.snapshotEvents()
        plan = result.plan; stateHead = source.stateHead; parts = []; origins = []
        const hostSystem = [...activeRecords(events,this.fixed)].reverse().find(event => event.type === 'system/message')
        const hostText = hostSystem ? eventMessage(hostSystem)?.content.map(b => (b as {text?: string}).text ?? '').join('') ?? '' : ''
        const system = [plan.systemPrompt, hostText].filter(Boolean).join('\n\n')
        if (system) { parts.push({message:{id:run.id + ':system',role:'system',content:[{type:'text',text:system}],source:{kind:'plugin',plugin:CONTEXT_NAMESPACE}},...(plan.systemPromptName === undefined ? {} : {name:plan.systemPromptName})}); origins.push({kind:'authored',name:plan.systemPromptName ?? 'system'}) }
        for (const [index,item] of plan.messages.entries()) {
          if ('ref' in item) { const ref = source.references.get(item.ref)!; parts.push(...ref.parts); origins.push(...ref.origins) }
          else { parts.push({message:{id:run.id + ':prompt:' + index,role:item.role,content:[{type:'text',text:item.content}],source:{kind:'plugin',plugin:CONTEXT_NAMESPACE}},...(item.name === undefined ? {} : {name:item.name})}); origins.push({kind:'authored',...(item.name === undefined ? {} : {name:item.name})}) }
        }
        const included = new Set(parts.flatMap(part => 'eventSeq' in part ? [part.eventSeq] : []))
        for (const event of events) {
          const message = eventMessage(event)
          if (event.seq! < run.start || !message || message.role === 'system' || included.has(event.seq!) || openingMessages(this.fixed).some(entry => entry.message.id === message.id)) continue
          parts.push({eventSeq:event.seq!}); origins.push({kind:'plugin',eventSeq:event.seq!})
        }
      }
      signal.throwIfAborted()
      origins = origins.map((origin,index) => ({...origin,hash:digest('message' in parts[index]! ? (parts[index] as {message:RequestMessage}).message : eventMessage(events[(parts[index] as {eventSeq:number}).eventSeq]!)!)}))
      const metadata = {namespace:CONTEXT_NAMESPACE as typeof CONTEXT_NAMESPACE,version:1 as const,runId:run.id,parentId:run.parent,artifactId:this.fixed.artifact.id,inputId:run.input.id,stateHead,origins,...(plan ? {plan} : {})}
      const base = existing?.seq
      const data: RequestRecord = {version:1,turn,step,...(base === undefined ? {} : {base}),messages:parts,metadata:{...metadata,checksum:digest({base:base ?? null,messages:parts,metadata})}}
      const expanded = [...(existing ? this.agent.session.deriveRequestMessages(existing.seq) : []), ...parts.map(part => 'message' in part ? part.message : eventMessage(events[part.eventSeq]!)!)]
      if (Buffer.byteLength(canonical(expanded)) > this.fixed.artifact.options.limits.outputBytes || Buffer.byteLength(canonical(data)) > this.fixed.artifact.options.limits.inputBytes) throw new ContextError('output-limit', 'assembled context exceeds configured byte limits')
      const seq = this.agent.session.snapshotEvents().length
      this.agent.session.append('request/messages', data)
      try { if (!await this.flush()) throw new Error('session has no durability provider') }
      catch (error) { this.blocked = true; throw new ContextError('context-save-failed', 'context persistence is unconfirmed: ' + String(error)) }
      return seq
    } catch (error) {
      if (!this.blocked) {
        this.agent.session.append('session/configuration', {key:CONTEXT_ERROR,value:{version:1,runId:run.id,parentId:run.parent,...(error instanceof ContextError ? {code:error.code,...(error.diagnostics ? {diagnostics:error.diagnostics}:{})} : {}),message:error instanceof Error ? error.message : String(error)}})
        try { if (!await this.flush()) this.blocked = true } catch { this.blocked = true } // The original request error remains the caller's failure.
      }
      throw error
    }
  }
}
