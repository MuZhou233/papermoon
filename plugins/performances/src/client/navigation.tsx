import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@papermoon/ui'
import type { Inspection, ViewNavigation } from './inspection.ts'
import type { T } from './locales.ts'
function NavigationIcon({ locate = false }: { locate?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {locate ? <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></> : <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-11-3 3 3 3"/></>}
  </svg>
}
function outcomeLabel(outcome:string,t:T){
  switch(outcome){
    case 'initialized':return t('rootNode')
    case 'error':return t('failed')
    case 'max-tokens':return t('truncated')
    case 'completed':case 'aborted':case 'interrupted':case 'blocked':return t(outcome)
    default:return outcome
  }
}
export function WorldlineNavigation({inspection,t,viewRequest,completeViewRequest}:{inspection:Inspection;t:T}&ViewNavigation){
  const state=useSyncExternalStore(inspection.subscribe,inspection.getSnapshot)
  const {view}=useSyncExternalStore(inspection.runtime.subscribe,inspection.runtime.getSnapshot)
  const list=useRef<HTMLDivElement>(null),body=useRef<HTMLDivElement>(null),panelId=useId(),tree=view?.worldline
  useEffect(()=>{if(body.current)body.current.inert=state.preferences.collapsed},[state.preferences.collapsed])
  useEffect(()=>{const node=list.current?.querySelector('.ppm-inspected');node?.scrollIntoView({block:'nearest'})},[state.preferences.nodeId,state.focusVersion,state.page?.items[0]?.id])
  useEffect(()=>{inspection.activate()},[inspection,state.sessionId])
  useEffect(()=>{if(viewRequest?.view==='trajectory' && viewRequest.focus.startsWith('worldline:')){inspection.select(viewRequest.focus.slice(10),undefined,true);completeViewRequest?.()}},[viewRequest,completeViewRequest,inspection])
  if(!state.sessionId||!tree)return null
  const {page,preferences}=state,items=page?.items??[],row=80,gap=14,width=(Math.max(0,...items.map(n=>n.lane))+1)*gap+12
  const x=(lane:number)=>8+lane*gap
  return <aside className="ppm-navigation pm-theme" data-collapsed={preferences.collapsed} aria-label={t('worldlines')}>
    <header className="ppm-navigation-header">
      <Button className="ppm-nav-icon" size="sm" variant="ghost" aria-controls={panelId} aria-expanded={!preferences.collapsed} title={t(preferences.collapsed?'expandWorldlines':'collapseWorldlines')} aria-label={t(preferences.collapsed?'expandWorldlines':'collapseWorldlines')} onClick={()=>inspection.collapse(!preferences.collapsed)}><NavigationIcon/></Button>
      <strong>{t('worldlines')}</strong>
      <Button className="ppm-nav-icon ppm-locate" size="sm" variant="ghost" tabIndex={preferences.collapsed?-1:undefined} aria-hidden={preferences.collapsed} title={t('locateCurrent')} aria-label={t('locateCurrent')} onClick={()=>{const node=tree.nodes.find(n=>n.id===tree.selected);if(node)inspection.select(node.id,node.ordinal)}}><NavigationIcon locate/></Button>
    </header>
    <div ref={body} id={panelId} className="ppm-navigation-body" aria-hidden={preferences.collapsed}>
      {tree.pending&&<button className="ppm-running" type="button" aria-pressed={preferences.nodeId===tree.pending.id} onClick={()=>inspection.select(tree.pending!.id)}>{t('runningTurn')}</button>}
      <div ref={list} className="ppm-navigation-scroll"><div className="ppm-navigation-tree" style={{minWidth:width+160,minHeight:items.length*row}}>
        <svg width={width} height={items.length*row} aria-hidden="true">{items.map(n=><g key={n.id} className={tree.path.includes(n.id)?'ppm-on-path':''}>{n.parentOrdinal!==null&&<path data-world-edge={n.id} data-parent-node={n.parent} data-lane={n.lane} d={n.parentOrdinal<preferences.offset?`M ${x(n.lane)} 0 V ${(n.ordinal-preferences.offset)*row+20}`:`M ${x(n.parentLane!)} ${(n.parentOrdinal-preferences.offset)*row+20} C ${x(n.parentLane!)} ${(n.parentOrdinal-preferences.offset)*row+38} ${x(n.lane)} ${(n.parentOrdinal-preferences.offset)*row+20} ${x(n.lane)} ${(n.parentOrdinal-preferences.offset)*row+38} V ${(n.ordinal-preferences.offset)*row+20}`} fill="none" stroke="currentColor" strokeWidth="1.5"/>}<circle cx={x(n.lane)} cy={(n.ordinal-preferences.offset)*row+20} r={tree.selected===n.id?4:3} fill="currentColor"/></g>)}</svg>
        <ol style={{marginLeft:width}}>{items.map(n=><li key={n.id}><button type="button" data-node-id={n.id} className={preferences.nodeId===n.id?'ppm-inspected':''} aria-pressed={preferences.nodeId===n.id} aria-current={tree.selected===n.id?'true':undefined} onClick={()=>inspection.select(n.id)} onKeyDown={event=>{const keys=['ArrowDown','ArrowUp','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();const buttons=list.current?.querySelectorAll<HTMLButtonElement>('li>button');const index=event.key==='Home'?0:event.key==='End'?items.length-1:n.ordinal-preferences.offset+(event.key==='ArrowDown'?1:-1);buttons?.[index]?.focus()}}>
          <span className="ppm-node-heading"><b>{n.floor===0?t('rootNode'):t('floor').replace('{floor}',String(n.floor))}</b>{n.turn!==null&&<small>{t('turn')} {n.turn}</small>}{tree.selected===n.id&&<span className="ppm-current-badge">{t('currentNode')}</span>}</span>
          <span className="ppm-node-summary">{n.input?.content.map(b=>b.text).join('')||t('opening')}</span><span className="ppm-node-status">{n.floor>0&&n.turn===null?t('beforeExecution'):outcomeLabel(n.outcome,t)}{preferences.nodeId===n.id&&<span className="ppm-viewing-label">{t('viewing')}</span>}</span>
        </button></li>)}</ol>
      </div></div>
      <footer>{preferences.offset>0&&<Button size="sm" onClick={()=>inspection.page(Math.max(0,preferences.offset-100))}>{t('previousNodes')}</Button>}{page&&preferences.offset+items.length<page.total&&<Button size="sm" onClick={()=>inspection.page(preferences.offset+100)}>{t('loadMore')}</Button>}</footer>
    </div>
  </aside>
}
export function InspectionToolbar({inspection,t}:{inspection:Inspection;t:T}){
  const state=useSyncExternalStore(inspection.subscribe,inspection.getSnapshot),{view}=useSyncExternalStore(inspection.runtime.subscribe,inspection.runtime.getSnapshot)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),detail=state.detail
  if(!state.sessionId)return null
  const allowed=!!view?.fixed?.artifact.composition&&!!detail&&detail.node.parent!==null
  const select=async()=>{if(!detail)return;setBusy(true);setError('');try{await inspection.runtime.operation('select',detail.nodeId)}catch(e){setError(String(e))}finally{setBusy(false)}}
  return <div className="ppm-inspection-toolbar pm-theme">
    <div className="ppm-context-switch" role="group" aria-label={t('contextMode')}>{(['original','rewritten'] as const).map(mode=><button type="button" key={mode} aria-pressed={inspection.mode()===mode} disabled={mode==='rewritten'&&!allowed} onClick={()=>inspection.selectMode(mode)}>{t(mode==='original'?'originalContext':'rewrittenContext')}</button>)}</div>
    {detail&&<span className="ppm-position">{detail.position.floor===0?t('rootNode'):t('floor').replace('{floor}',String(detail.position.floor))}{detail.position.turn===null?'':' · '+t('turn')+' '+detail.position.turn}</span>}
    <Button className="ppm-switch-here" size="sm" variant="primary" disabled={!detail||busy||!!view?.worldline?.pending||detail.nodeId===view?.worldline?.selected} onClick={()=>void select()}>{t('switchHere')}</Button>
    {(error||state.error)&&<p role="alert">{error||state.error}</p>}
  </div>
}
