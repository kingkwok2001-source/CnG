import test from 'node:test'
import assert from 'node:assert/strict'
import {createPaymentDemoClient} from '../src/payment-demo-client.js'
const feature=await import('../src/money-entry.js').catch(()=>({}))
test('dismiss retries preserve the original operation without any evidence upload',async()=>{
 assert.equal(typeof feature.saveMoneyEntry,'function')
 let calls=0;const client={rpc:async(name,args)=>{assert.equal(args.p_kind,'dismiss');calls++;return calls===1?{error:new Error('offline')}:{data:{dismissed:true}}},storage:{from(){throw new Error('Unexpected upload')}}},context={projectId:'p'},args={p_project:'p',p_request:'request',p_kind:'dismiss',p_payload:{draft_id:'draft'}}
 await assert.rejects(feature.saveMoneyEntry(client,context,args,[]),/offline/)
 await feature.saveMoneyEntry(client,context,{...args,p_kind:'expense'},[])
 assert.equal(context.result.dismissed,true);assert.equal(calls,2)
})
test('incomplete creation response never skips proof saving on retry',async()=>{
 assert.equal(typeof feature.saveMoneyEntry,'function')
 const client=createPaymentDemoClient({empty:true}),rpc=client.rpc;let calls=0;client.rpc=async(name,args)=>++calls===1?{data:{}}:rpc(name,args)
 const context={projectId:'proof-demo'},args={p_project:'proof-demo',p_request:'money-request',p_kind:'expense',p_payload:{title:'證明',amount:12}},items=[{id:'proof',file:new File(['x'],'x.png',{type:'image/png'})}]
 await assert.rejects(feature.saveMoneyEntry(client,context,args,items),/回應/)
 assert.equal(context.result,undefined)
 await feature.saveMoneyEntry(client,context,args,items)
 assert.equal(calls,2);assert.equal(client.snapshot().files.length,1)
})
