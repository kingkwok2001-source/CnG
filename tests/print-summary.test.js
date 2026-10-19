import test from 'node:test'
import assert from 'node:assert/strict'
import {summaryHtml} from '../src/print-summary.js'
const project={name:'<C&G>',currency:'HKD',income_enabled:false},expenses=[{title:'場地',total_amount:1000,paid_amount:300,outstanding_amount:700,categories:{name:'場地及餐飲'}}],incomes=[{amount:99}]
test('expense-only PDF excludes income and preserves total, paid and outstanding',()=>{const html=summaryHtml(project,expenses,incomes);assert.ok(!html.includes('總收入'));assert.ok(html.includes('repeat(3,1fr)'));for(const n of ['HK$1,000','HK$300','HK$700'])assert.ok(html.includes(n));assert.ok(html.includes('&lt;C&amp;G&gt;'));assert.ok(!html.includes('<script>'))})
test('income-enabled print includes income without reducing unpaid expense',()=>{const html=summaryHtml({...project,income_enabled:true},expenses,incomes,{autoPrint:true});assert.ok(html.includes('總收入'));assert.ok(html.includes('HK$99'));assert.ok(html.includes('HK$700'));assert.ok(html.includes('repeat(4,1fr)'));assert.ok(html.includes('<script>setTimeout(()=>window.print(),300)</script>'));assert.ok(!html.includes('<\\/script>'))})
