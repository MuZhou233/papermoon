/** Read-only, snapshot-bound projections of complete worldline executions. */
import { digest } from '@papermoon/playbook-compiler/runtime'
import type { LogRecord, RequestMessage } from '../../playbook-workspaces/src/host.ts'
import type { FrozenPerformance } from './model.ts'
import { openingMessages } from './model.ts'
import { contextRecord, CONTEXT_ERROR, type ContextOrigin } from './composition.ts'
import { pathTo, recordsFor, pathRanges, worldlineState, type WorldNode } from './worldlines.ts'

export type InspectionMode = 'original' | 'rewritten'
export interface InspectionCursor { nodeId: string; mode: InspectionMode; through: number; offset: number; identity: string }
/** A node is one admitted input and its complete execution, including all tool steps. */
export function executionPosition(events: readonly LogRecord[], nodes: ReadonlyMap<string, WorldNode>, node: WorldNode) {
  const floor = pathTo(nodes, node.id).length - 1
  const own = recordsFor(events, node.ranges)
  const starts = own.filter(event => event.type === 'turn/start')
  const turns = new Set(own.flatMap(event => ['turn/start','turn/end','step/start','assistant/message','assistant/attempt','request/messages'].includes(event.type) && typeof (event.data as {turn?:number}).turn === 'number' ? [(event.data as {turn:number}).turn] : []))
  if (starts.length > 1 || turns.size > 1 || (turns.size && starts.length !== 1)) throw new Error('worldline execution has conflicting DSH turn associations')
  return { floor, turn: starts.length ? (starts[0]!.data as {turn:number}).turn : null }
}
export function inspectExecution(events: readonly LogRecord[], fixed: FrozenPerformance, nodeId: string, requested: InspectionMode, resolve: (seq: number) => RequestMessage[], cursor?: InspectionCursor, limit = 200) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('invalid inspection page')
  if (cursor && (cursor.nodeId!==nodeId || cursor.mode!==requested)) throw new Error('inspection cursor does not match its snapshot')
  const through = cursor?.through ?? (events.at(-1)?.seq ?? -1)
  if (through > (events.at(-1)?.seq ?? -1)) throw new Error('inspection snapshot is unavailable')
  const snapshot = events.filter(event => event.seq! <= through), tree = worldlineState(snapshot, fixed)
  const pending = tree.pending?.id === nodeId ? tree.pending : undefined
  const node: WorldNode | undefined = tree.nodes.get(nodeId) ?? (pending ? {
    id: pending.id, parent: pending.parent, ordinal: tree.nodes.size, input: pending.input,
    ranges: [{start:pending.start,end:through}], stateHead:'',outcome:'running',requests:[],response:'',sealedAt:0,
  } : undefined)
  if (!node) throw new Error('worldline inspection position is unavailable')
  const nodes = new Map(tree.nodes); nodes.set(node.id,node)
  const path = pathTo(nodes,nodeId), positions = new Map(path.map(item => [item.id,executionPosition(snapshot,nodes,item)]))
  if (requested === 'rewritten' && (!fixed.artifact.composition || node.parent === null)) throw new Error('rewritten context is unavailable at this position')
  const mode = requested, own = recordsFor(snapshot,node.ranges)
  const selected = mode === 'original' ? recordsFor(snapshot,pathRanges(nodes,nodeId)) : own
  const requests = selected.flatMap(event => {
    const record = contextRecord(event)
    if (!record) return []
    const owner = path.find(item => item.id === record.metadata.runId)
    if (!owner || positions.get(owner.id)!.turn !== record.turn) throw new Error('request has a conflicting worldline owner')
    return [{seq:event.seq!,nodeId:owner.id,turn:record.turn,step:record.step}]
  })
  const baseEvent = own.find(event => { const value=contextRecord(event);return value && value.base===undefined })
  const base = baseEvent && contextRecord(baseEvent)
  const error = own.findLast(event => event.type==='session/configuration' && (event.data as {key?:string}).key===CONTEXT_ERROR)
  const openingIds = new Set(openingMessages(fixed).map(entry=>entry.message.id))
  const context: {id:string;message:RequestMessage;origin:ContextOrigin}[] = []
  if (mode==='rewritten' && baseEvent && base) {
    if (base.metadata.runId!==nodeId || base.metadata.parentId!==node.parent || base.metadata.artifactId!==fixed.artifact.id) throw new Error('context does not belong to inspected execution')
    const messages=resolve(baseEvent.seq!)
    if (messages.length!==base.metadata.origins.length) throw new Error('context reference count does not match')
    messages.forEach((message,index)=>{
      const origin=base.metadata.origins[index]!
      if (origin.hash && digest(message)!==origin.hash) throw new Error('context source checksum does not match')
      context.push({id:nodeId+':context:'+index,message,origin})
    })
  } else if (mode==='original') {
    context.push({id:'opening:system',message:{id:'opening:system',role:'system',content:[{type:'text',text:fixed.artifact.context.systemPrompt}],source:{kind:'plugin',plugin:'papermoon.performance'}},origin:{kind:'opening',name:fixed.artifact.context.systemPromptName}})
    for (const entry of openingMessages(fixed)) context.push({id:entry.message.id,message:entry.message,origin:{kind:'opening',name:entry.name}})
  }
  // Initial messages have a presentation area even before the first real input is accepted.
  const records=selected.filter(event=>{
    const data=event.data as {message?:RequestMessage}
    if (data.message && openingIds.has(data.message.id)) return false
    if (mode==='rewritten' && baseEvent && event.seq!<=baseEvent.seq!) return ['turn/start','step/start','request/header'].includes(event.type)
    return true
  })
  const identity=digest({nodeId,mode,through,seqs:records.map(event=>event.seq),base:base?.metadata.checksum??null})
  const offset=cursor?.offset??0
  if (cursor && (cursor.nodeId!==nodeId || cursor.mode!==mode || cursor.identity!==identity || !Number.isSafeInteger(offset) || offset<0 || offset>records.length)) throw new Error('inspection cursor does not match its snapshot')
  const end=records.length-offset, start=Math.max(0,end-limit)
  const next=start>0?{nodeId,mode,through,offset:offset+limit,identity}:undefined
  return {identity,nodeId,mode,through,pending:!!pending,node,position:positions.get(nodeId)!,path:path.map(item=>({id:item.id,...positions.get(item.id)!})),
    context:offset===0?context:[],events:records.slice(start,end),requests:offset===0?requests:[],next,
    error:error?(error.data as {value:unknown}).value:null,
  }
}
