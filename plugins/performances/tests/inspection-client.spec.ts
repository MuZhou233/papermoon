import { afterEach, expect, test, vi } from 'vitest'
import { Inspection, type InspectionPage } from '../src/client/inspection.ts'
import type { Runtime } from '../src/client/runtime.ts'

afterEach(() => vi.unstubAllGlobals())

test('late inspection responses cannot replace a newer selection or select runtime history', async () => {
  const saved = new Map<string,string>()
  vi.stubGlobal('localStorage', { getItem: (key:string)=>saved.get(key)??null, setItem: (key:string,value:string)=>saved.set(key,value) })
  const replies = new Map<string, ReturnType<typeof Promise.withResolvers<InspectionPage>>>()
  const off = vi.fn(), operation=vi.fn()
  const nodes=[{id:'root',parent:null,ordinal:0},{id:'a',parent:'root',ordinal:1},{id:'b',parent:'root',ordinal:2}]
  const state={sessionId:'session',view:{fixed:{artifact:{composition:{}}},worldline:{nodes,selected:'a',version:1,count:3}}}
  const runtime={getSnapshot:()=>state,subscribe:()=>off,operation,
    host:{trajectoryInspection:{register:()=>off}},
    call:async(method:string,payload:{nodeId:string})=>{
      if(method==='tree')return {items:nodes,total:3}
      const reply=Promise.withResolvers<InspectionPage>();replies.set(payload.nodeId,reply);return reply.promise
    },
  } as unknown as Runtime
  const inspection=new Inspection(runtime,key=>key)
  const complete=(id:string)=>replies.get(id)!.resolve({nodeId:id,mode:'rewritten',node:nodes.find(n=>n.id===id),position:{floor:1,turn:id==='a'?1:2},path:[],context:[],events:[],requests:[],through:30,pending:false,error:null} as unknown as InspectionPage)
  inspection.select('b')
  complete('b');await vi.waitFor(()=>expect(inspection.getSnapshot().detail?.nodeId).toBe('b'))
  complete('a');await Promise.resolve();await Promise.resolve()
  expect(inspection.projection.getSnapshot()?.key).toBe('b:rewritten')
  expect(state.view.worldline.selected).toBe('a');expect(operation).not.toHaveBeenCalled()
  expect(JSON.parse(saved.get('papermoon.inspection:session')!).nodeId).toBe('b')
  inspection.select('a');state.sessionId='';inspection.observe()
  expect(inspection.projection.getSnapshot()).toBeNull();expect(inspection.getSnapshot().sessionId).toBeUndefined()
  inspection.dispose();complete('a');await Promise.resolve();await Promise.resolve()
  expect(inspection.getSnapshot().detail).toBeUndefined();expect(off).toHaveBeenCalledTimes(2)
})
