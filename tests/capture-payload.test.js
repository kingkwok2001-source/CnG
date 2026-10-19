import test from 'node:test'
import assert from 'node:assert/strict'
import {capturePayload} from '../supabase/functions/capture-transaction/payload.js'
const request_id='890a2177-886d-447d-a6b6-c1cdecc27590'
test('shortcut text becomes a pending draft payload with a stable receipt id',()=>{assert.deepEqual(capturePayload({text:'Octopus\n消費：HK$8.00\n餘額：HK$88.70',date:'2026-10-19',request_id}),{amount:8,date:'2026-10-19',title:'待確認付款',method:'八達通',request_id})})
test('ambiguous text, invalid dates and missing text retry ids are rejected',()=>{for(const p of [{text:'HK$8 HK$88',request_id},{amount:8,date:'2026-02-30',request_id},{text:'消費 HK$8'}])assert.throws(()=>capturePayload(p))})
test('structured Wallet data remains compatible with existing shortcuts',()=>{assert.equal(capturePayload({amount:'12.50',title:'餐廳',method:'Apple Pay'}).amount,12.5)})
