import test from 'node:test'
import assert from 'node:assert/strict'
import {parseTransaction,validDate} from '../src/transaction-parser.js'
test('HK payment text suggests exact amount, merchant, local date and method',()=>{
 assert.deepEqual(parseTransaction('收款人：餐廳\nHK$1,280.50\n2026/10/11\nPayMe'),{title:'餐廳',amount:1280.5,date:'2026-10-11',method:'PayMe',ambiguous:false})
})
test('multiple balances never guess which amount is the expense',()=>{const r=parseTransaction('八達通\n增值 HK$500\n餘額 HK$700');assert.equal(r.amount,'');assert.equal(r.ambiguous,true)})
test('reject impossible dates rather than silently changing them',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-02-28'),true);assert.equal(validDate('not a date'),false)})
