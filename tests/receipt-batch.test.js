import test from 'node:test'
import assert from 'node:assert/strict'
import {createPaymentDemoClient} from '../src/payment-demo-client.js'
const feature=await import('../src/receipt-batch.js').catch(()=>({}))
const receipt=(id,amount)=>({id,merchant:'商店 '+id,amount,date:'2026-10-23',method:'PayMe',items:[]})
test('multiple purchase amounts use exact cents and become one payload',()=>{
 assert.equal(typeof feature.receiptPayload,'function','multi-receipt payload is not implemented')
 assert.equal(feature.receiptTotal([receipt('a','0.10'),receipt('b','0.20')]),.3)
 const payload=feature.receiptPayload({title:'回禮',categoryId:'cat',expenseId:'',receipts:[receipt('a','120'),receipt('b','80'),receipt('c','150')]})
 assert.equal(payload.title,'回禮');assert.equal(payload.receipts.length,3);assert.equal(payload.receipts.reduce((n,r)=>n+r.amount,0),350)
 assert.equal(payload.receipts[1].merchant,'商店 b')
})
test('blank, nonpositive, nonfinite, overprecision and invalid dates fail before saving',()=>{
 assert.equal(typeof feature.receiptPayload,'function','multi-receipt validation is not implemented')
 for(const amount of ['',0,-1,'NaN','Infinity','1.005'])assert.throws(()=>feature.receiptPayload({title:'回禮',receipts:[receipt('a',amount)]}))
 assert.throws(()=>feature.receiptPayload({title:'回禮',receipts:[{...receipt('a',1),date:'2026-02-30'}]}))
 assert.throws(()=>feature.receiptPayload({title:'回禮',receipts:[receipt('a',1),receipt('a',2)]}))
})
test('receipt recognition never replaces manual values or a chosen date',()=>{
 assert.equal(typeof feature.receiptSuggestions,'function')
 const row={amount:'18',merchant:'手填商戶',method:'現金',date:'2025-12-01'}
 const suggestion=feature.receiptSuggestions(row,'Merchant: Another shop\nHK$120.00\nPayMe')
 assert.equal(suggestion.amount,undefined);assert.equal(suggestion.merchant,undefined);assert.equal(suggestion.method,undefined);assert.equal(suggestion.date,undefined)
 assert.equal(feature.receiptSuggestions({amount:'',merchant:'',method:''},'HK$120.00').amount,'120')
})
test('failed batch does not upload files',async()=>{
 assert.equal(typeof feature.saveReceiptBatch,'function','batch saving is not implemented')
 let uploaded=false
 await assert.rejects(feature.saveReceiptBatch({rpc:async()=>({error:new Error('DB failed')}),storage:{from(){uploaded=true}}},{projectId:'p',requestId:'batch-request-123456',payload:{}},[]),/DB failed/)
 assert.equal(uploaded,false)
})
test('each receipt proof belongs to its returned payment and partial retry never duplicates the batch',async()=>{
 const client=createPaymentDemoClient({empty:true}),originalRpc=client.rpc,originalStorage=client.storage.from
 let writes=0,fail=true;client.rpc=async(...args)=>{writes++;return originalRpc(...args)}
 client.storage.from=(...args)=>{const bucket=originalStorage(...args),upload=bucket.upload;return{...bucket,upload:async(...values)=>{if(fail){fail=false;return{error:new Error('offline')}}return upload(...values)}}}
 const rows=[receipt('first',120),receipt('second',80)]
 for(const row of rows)row.items=[{id:row.id,file:new File(['proof'],row.id+'.png',{type:'image/png'})}]
 const context={projectId:'proof-demo',requestId:'receipt-retry-test',payload:feature.receiptPayload({title:'回禮',receipts:rows})}
 await assert.rejects(feature.saveReceiptBatch(client,context,rows),/部分附件未完成/)
 assert.equal(client.snapshot().files.length,1)
 await feature.saveReceiptBatch(client,context,rows)
 const data=client.snapshot();assert.equal(writes,1);assert.equal(data.expenses.length,1);assert.equal(data.payments.length,2);assert.equal(data.files.length,2)
 for(const row of rows){const mapping=context.result.payments.find(x=>x.receipt_id===row.id);assert.equal(data.files.find(x=>x.id===row.id).payment_id,mapping.payment_id)}
})
