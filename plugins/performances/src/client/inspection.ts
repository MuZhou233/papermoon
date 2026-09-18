/** Inspection navigation is local; only the explicit runtime operation selects history. */
import type { Performances } from '../service.ts'
import type { InspectionMode } from '../inspection.ts'
import type { Runtime, Observable } from './runtime.ts'
import type { T } from './locales.ts'
export interface ViewNavigation { openView?: (view: string, focus: string) => void; viewRequest?: {view:string;focus:string} | null; completeViewRequest?: () => void }
export type InspectionPage = Awaited<ReturnType<Performances['inspection']>>
export type TreePage = Awaited<ReturnType<Performances['tree']>>
interface Preferences { nodeId?: string; mode?: InspectionMode; collapsed: boolean; offset: number }
export interface InspectionData {
  key: string; events: readonly {type:'event';event:InspectionPage['events'][number]}[]
  context?: readonly {id:string;message:InspectionPage['context'][number]['message'];label?:string;sourceSeq?:number;sourceTarget?:string}[]
  focusRecordId?: string; contextLabel?: string; turnLabels?: Record<number,string>; loading?:boolean; error?:string
  hasMore?:boolean;loadMore?:()=>Promise<boolean>;liveAfter?:number
  openSource?:(target:string)=>void;readRequest?:(turn:number,step:number)=>Promise<unknown>
}
function preferences(id:string):Preferences {
  try {const value=JSON.parse(localStorage.getItem('papermoon.inspection:'+id)??'null');if(value?.version===1)return {nodeId:typeof value.nodeId==='string'?value.nodeId:undefined,mode:value.mode==='original'||value.mode==='rewritten'?value.mode:undefined,collapsed:value.collapsed===true,offset:Number.isSafeInteger(value.offset)&&value.offset>=0?value.offset:0}} catch { /* Invalid local navigation preferences do not change durable history. */ }
  return {collapsed:false,offset:0}
}
export class Inspection {
  private opened=new Set<string>()
  private listeners=new Set<()=>void>()
  private projectionListeners=new Set<()=>void>()
  private projectionValue:InspectionData|null=null
  private off?:()=>void;private stop:()=>void
  private generation=0;private morePending=false;private pageGeneration=0;private signature='';private lastView:unknown
  private state:{sessionId?:string;preferences:Preferences;page?:TreePage;detail?:InspectionPage;loading:boolean;focusVersion?:number;focusContext?:boolean;error?:string}={preferences:{collapsed:false,offset:0},loading:false}
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  readonly getSnapshot=()=>this.state
  readonly projection:Observable<InspectionData|null>={getSnapshot:()=>this.projectionValue,subscribe:listener=>{this.projectionListeners.add(listener);return()=>{this.projectionListeners.delete(listener)}}}
  constructor(readonly runtime:Runtime,readonly t:T){this.stop=runtime.subscribe(this.observe);this.observe()}
  private publish(patch:Partial<typeof this.state>){this.state={...this.state,...patch};for(const listener of this.listeners)listener()}
  private setProjection(value:InspectionData|null){this.projectionValue=value;for(const listener of this.projectionListeners)listener()}
  private remember(){const {sessionId,preferences}=this.state;if(sessionId)localStorage.setItem('papermoon.inspection:'+sessionId,JSON.stringify({version:1,...preferences}))}
  mode():InspectionMode {
    const {view}=this.runtime.getSnapshot(),{preferences}=this.state
    const root=this.state.detail!==undefined&&this.state.detail.node.id===preferences.nodeId&&this.state.detail.node.parent===null || view?.worldline?.nodes.find(node=>node.id===preferences.nodeId)?.parent===null
    return !view?.fixed?.artifact.composition || root ? 'original' : preferences.mode??'rewritten'
  }
  observe=()=>{
    const {sessionId,view}=this.runtime.getSnapshot()
    if(!view?.worldline || view.worldline.legacy || !sessionId){if(this.state.sessionId){this.off?.();this.off=undefined;this.generation++;this.pageGeneration++;this.publish({sessionId:undefined,page:undefined,detail:undefined});this.setProjection(null)}return}
    if(sessionId!==this.state.sessionId){this.off?.();this.generation++;this.pageGeneration++;this.publish({sessionId,preferences:preferences(sessionId),page:undefined,detail:undefined});this.setProjection(null);this.off=this.runtime.host.trajectoryInspection.register(sessionId,this.projection);this.signature=''}
    if(!this.state.preferences.nodeId){this.state.preferences.nodeId=view.worldline.selected}
    const signature=JSON.stringify([sessionId,view.worldline.version,view.worldline.count,view.worldline.pending?.id])
    if(signature!==this.signature){this.signature=signature;void this.loadTree();if(!this.state.detail||this.state.detail.pending)void this.load()} else if(view!==this.lastView && view.worldline.pending?.id===this.state.preferences.nodeId){void this.load()}
    this.lastView=view
  }
  activate(){const {sessionId}=this.state;if(!sessionId||this.opened.has(sessionId))return;this.opened.add(sessionId);const saved=preferences(sessionId),tree=this.runtime.getSnapshot().view?.worldline;if(!saved.nodeId&&tree?.selected){const node=tree.nodes.find(n=>n.id===tree.selected);this.select(tree.selected,node?.ordinal)}}
  select(nodeId:string,ordinal?:number,focusContext=false){this.publish({focusContext,focusVersion:(this.state.focusVersion??0)+1,preferences:{...this.state.preferences,nodeId,...(ordinal===undefined?{}:{offset:Math.floor(ordinal/100)*100})},detail:undefined,error:undefined});this.remember();void this.load();void this.loadTree()}
  selectMode(mode:InspectionMode){this.publish({preferences:{...this.state.preferences,mode}});this.remember();void this.load()}
  collapse(collapsed:boolean){this.publish({preferences:{...this.state.preferences,collapsed}});this.remember()}
  page(offset:number){this.publish({preferences:{...this.state.preferences,offset}});this.remember();void this.loadTree()}
  async loadTree(){
    const generation=++this.pageGeneration,{sessionId,preferences}=this.state;if(!sessionId)return
    try{const page=await this.runtime.call<TreePage>('tree',{sessionId,offset:preferences.offset,limit:100});if(generation===this.pageGeneration)this.publish({page})}
    catch(error){if(generation===this.pageGeneration)this.publish({error:String(error)})}
  }
  private show(detail:InspectionPage){
    const {sessionId}=this.state
    const offset=Math.floor(detail.node.ordinal/100)*100
    const moved=!this.state.detail && offset!==this.state.preferences.offset && !this.state.page?.items.some(item=>item.id===detail.nodeId)
    this.publish({detail,loading:false,error:undefined,...(moved?{preferences:{...this.state.preferences,offset}}:{})})
    if(moved){this.remember();void this.loadTree()}
    const label=(nodeId?:string)=>{const p=detail.path.find(n=>n.id===nodeId);return p ? p.floor===0?this.t('rootNode'):this.t('floor').replace('{floor}',String(p.floor))+(p.turn===null?'':' · '+this.t('turn')+' '+p.turn):''}
    this.setProjection({key:detail.nodeId+':'+detail.mode,events:detail.events.map(event=>({type:'event',event})),focusRecordId:this.state.focusContext?detail.context[0]?.id:undefined,contextLabel:this.t(detail.mode==='rewritten'?'rewrittenContext':'rootNode'),
      context:detail.context.map(item=>({id:item.id,message:item.message,sourceSeq:item.origin.eventSeq,sourceTarget:item.origin.nodeId,label:[item.origin.name,this.t(item.origin.kind),label(item.origin.nodeId),item.origin.eventSeq===undefined?'':'#'+item.origin.eventSeq].filter(Boolean).join(' · ')})),
      turnLabels:Object.fromEntries(detail.path.filter(n=>n.turn!==null).map(n=>[n.turn!,this.t('floor').replace('{floor}',String(n.floor))])),
      error:detail.error?JSON.stringify(detail.error):undefined,hasMore:!!detail.next,loadMore:()=>this.more(),
      ...(detail.pending ? {liveAfter:detail.through}:{}),openSource:id=>this.select(id),
      readRequest:async(turn,step)=>{const request=detail.requests.find(r=>r.turn===turn&&r.step===step);if(!request)throw new Error('request record is unavailable');return this.runtime.call('request',{sessionId,seq:request.seq})},
    })
  }
  async load(){
    const generation=++this.generation,{sessionId,preferences}=this.state;if(!sessionId||!preferences.nodeId)return
    const mode=this.mode();this.publish({loading:true,error:undefined})
    if(this.projectionValue?.key!==preferences.nodeId+':'+mode || !this.state.detail)this.setProjection({key:preferences.nodeId+':'+mode,events:[],loading:true})
    try{const detail=await this.runtime.call<InspectionPage>('inspection',{sessionId,nodeId:preferences.nodeId,mode});if(generation===this.generation)this.show(detail)}
    catch(error){if(generation===this.generation){this.publish({loading:false,error:String(error)});this.setProjection({key:preferences.nodeId+':'+mode,events:[],error:String(error)})}}
  }
  async more(){
    const {sessionId,detail}=this.state,generation=this.generation;if(!sessionId||!detail?.next||this.morePending)return false
    this.morePending=true
    try {
    const page=await this.runtime.call<InspectionPage>('inspection',{sessionId,nodeId:detail.nodeId,mode:detail.mode,cursor:detail.next})
    if(generation!==this.generation)return false
    this.show({...page,context:detail.context,requests:detail.requests,events:[...page.events,...detail.events]});return true
    } finally {this.morePending=false}
  }
  dispose(){this.stop();this.off?.();this.generation++;this.pageGeneration++}
}
