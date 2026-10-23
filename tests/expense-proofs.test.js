import test from 'node:test'
import assert from 'node:assert/strict'
import {createPaymentDemoClient} from '../src/payment-demo-client.js'
const feature=await import('../src/expense-files.js').catch(()=>({}))
test('one expense retains several evidence files and a lost response retries without duplicates',async()=>{
 assert.equal(typeof feature.saveExpenseProofs,'function')
 const client=createPaymentDemoClient({empty:true})
 await client.from('expenses').insert({id:'expense',project_id:'proof-demo'})
 const items=['one','two','three'].map(id=>({id,file:new File(['proof'],id+'.png',{type:'image/png'})}))
 await feature.saveExpenseProofs(client,{projectId:'proof-demo',expenseId:'expense'},items)
 const files=client.snapshot().files;assert.equal(files.length,3);assert.ok(files.every(x=>x.expense_id==='expense'&&!x.payment_id&&!x.income_id))
 await feature.saveExpenseProofs(client,{projectId:'proof-demo',expenseId:'expense'},items.map(x=>({...x,saved:false})))
 assert.equal(client.snapshot().files.length,3)
})
test('missing expense prevents any evidence file upload',async()=>{
 assert.equal(typeof feature.saveExpenseProofs,'function')
 const client=createPaymentDemoClient({empty:true});let uploaded=false;client.storage.from=()=>{uploaded=true}
 await assert.rejects(feature.saveExpenseProofs(client,{projectId:'proof-demo',expenseId:'absent'},[{id:'one',file:new File(['x'],'x.png',{type:'image/png'})}]),/不存在/)
 assert.equal(uploaded,false)
})
