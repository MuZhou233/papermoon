import type { RequestRecord } from '../composition.ts'
interface Match {event:{type:string;seq:number;time:number;data:unknown};location:unknown}
interface Context {key:string;id:string;matches:readonly Match[]}
function record(event:Match['event']) {
  if(event.type!=='request/messages')return undefined
  const value=event.data as RequestRecord
  return value.metadata?.namespace==='papermoon.context'?value:undefined
}
export const compositionTrajectory = {
  kind:'papermoon-composition-record',target:'trajectory',
  match:(event:Match['event'])=>record(event)||(event.type==='session/configuration'&&(event.data as {key?:string}).key==='papermoon.context.error')?{id:String(event.seq),role:'start' as const}:null,
  start:()=>true,update:()=>true,
  buildViewNode(context:Context){const first=context.matches[0];if(!first)return null;return{key:context.key,id:context.id,kind:'papermoon-composition-record',target:'trajectory',anchorSeq:first.event.seq,location:first.location,visibility:'visible',independent:true,data:{kind:'node',node:{kind:'context',seq:first.event.seq,time:first.event.time,content:[{type:'text',text:JSON.stringify(first.event.data,null,2)}],source:{kind:'authored-context',producer:'papermoon.context'},provenance:{role:'inject',label:'PaperMoon'},form:'snapshot'}}}},
}
