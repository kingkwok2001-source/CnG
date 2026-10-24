import test from 'node:test'
import assert from 'node:assert/strict'
import {parseExpenseCsv} from '../src/csv-import.js'
const head='日期,分類,項目,總金額,已付,到期日,負責人,備註\r\n'
const row='2026-10-24,其他,測試,120.50,20.50,,Carl,備註'
test('CSV preserves BOM, quoted comma/newline and escaped quotes',()=>{
 const r=parseExpenseCsv('\ufeff'+head+'2026-10-24,其他,"禮物, A",120.50,20.50,,Carl,"第一行\r\n第二行 ""引號"""')
 assert.deepEqual(r.errors,[]);assert.equal(r.rows[0].title,'禮物, A');assert.equal(r.rows[0].notes,'第一行\r\n第二行 "引號"')
})
test('malformed quote cannot silently merge or rewrite transactions',()=>{
 for(const text of [head+row+'"',head+'2026-10-24,其他,"missing close,120,0,,,',head+'2026-10-24,其他,"title"junk,120,0,,,'])assert.ok(parseExpenseCsv(text).errors.length,text)
})
test('duplicate headers and misaligned rows are rejected',()=>{
 assert.ok(parseExpenseCsv('日期,分類,項目,總金額,已付,總金額\n2026-10-24,其他,A,120,0,999').errors.length)
 assert.ok(parseExpenseCsv(head+row+',extra').errors.length)
})
test('invalid money or due date is rejected before any RPC',()=>{
 for(const amount of ['1.001','1e3','Infinity','HKD','12,34','9999999999'])assert.ok(parseExpenseCsv(head+`2026-10-24,其他,A,"${amount}",0,,,`).errors.length,amount)
 assert.ok(parseExpenseCsv(head+'2026-10-24,其他,A,120,0,2026-02-30,,').errors.length)
 assert.ok(parseExpenseCsv(head+'2026-10-24,其他,A,120,121,,,').errors.length)
})
test('a valid 1000 row batch passes; 1001 rows and header-only files fail',()=>{
 assert.equal(parseExpenseCsv(head+Array(1000).fill(row).join('\r\n')).errors.length,0)
 assert.ok(parseExpenseCsv(head+Array(1001).fill(row).join('\r\n')).errors.length)
 assert.ok(parseExpenseCsv(head).errors.length)
})
test('currency notation and grouped thousands retain exact cents',()=>{
 const r=parseExpenseCsv(head+'2026-10-24,其他,A,"HK$1,200.50",$20.50,,,');assert.deepEqual(r.errors,[]);assert.equal(r.rows[0].total,1200.5);assert.equal(r.rows[0].paid,20.5)
})
