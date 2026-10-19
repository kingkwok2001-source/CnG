import test from 'node:test'
import assert from 'node:assert/strict'
import {parseTransaction,validDate} from '../src/transaction-parser.js'
test('HK payment text suggests exact amount, merchant, local date and method',()=>{
 assert.deepEqual(parseTransaction('收款人：餐廳\nHK$1,280.50\n2026/10/11\nPayMe'),{title:'餐廳',amount:1280.5,date:'2026-10-11',method:'PayMe',ambiguous:false})
})
test('multiple balances never guess which amount is the expense',()=>{const r=parseTransaction('八達通\n增值 HK$500\n餘額 HK$700');assert.equal(r.amount,'');assert.equal(r.ambiguous,true)})
test('reject impossible dates rather than silently changing them',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-02-28'),true);assert.equal(validDate('not a date'),false)})
test('Octopus consumption chooses spending, never the new balance',()=>{const r=parseTransaction('Octopus\n消費：HK$8.00\n你的新餘額為HK$88.70');assert.equal(r.amount,8);assert.equal(r.method,'八達通');assert.equal(r.ambiguous,false)})
test('English notification ignores balance when purchase is labelled',()=>{assert.equal(parseTransaction('Purchase: HK$128.50\nBalance: HK$900').amount,128.5)})
test('balance-only, refund, topup, negative or competing purchases need review',()=>{for(const s of ['餘額：HK$800','退款 HK$80','增值 HK$100','HK$-8.00','消費 HK$8\n付款 HK$9'])assert.equal(parseTransaction(s).amount,'',s)})
