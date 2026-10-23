import {validDate,parseTransaction} from './transaction-parser.js'
import {savePaymentProofs} from './payment-files.js'
export function receiptCents(value){
 const text=String(value??'').trim()
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error('請為每張單輸入有效金額，最多兩位小數')
 const [whole,fraction='']=text.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(cents)||cents<=0||cents>99999999900)throw new Error('每張單嘅金額必須大於零')
 return cents
}
export function receiptTotal(receipts){return receipts.reduce((sum,row)=>{try{return sum+receiptCents(row.amount)}catch{return sum}},0)/100}
export function receiptSuggestions(row,text){
 const result=parseTransaction(text)
 return{...(!String(row.amount||'').trim()&&result.amount!==''?{amount:String(result.amount)}:{}),...(!row.merchant?.trim()&&result.title?{merchant:result.title}:{}),...(!row.method&&result.method?{method:result.method}:{}),rawText:text,status:result.ambiguous?'未能確定金額，請手動核對。':'已辨認，只填入空白欄位；請核對金額再儲存。'}
}
export function receiptPayload({title,categoryId,expenseId,receipts}){
 if(!expenseId&&!title?.trim())throw new Error('請輸入合併項目名稱')
 if(!receipts?.length||receipts.length>20)throw new Error('每次可加入 1–20 張單')
 const ids=new Set(),rows=receipts.map((row,i)=>{if(!row.id||ids.has(row.id))throw new Error('購買單 ID 重複');ids.add(row.id);if(!validDate(row.date))throw new Error(`第 ${i+1} 張單嘅日期無效`);return{id:row.id,merchant:row.merchant?.trim().slice(0,160)||'',amount:receiptCents(row.amount)/100,date:row.date,method:row.method||null}})
 if(receiptTotal(receipts)>999999999)throw new Error('合計金額過大')
 return{title:title?.trim()||'',category_id:categoryId||null,expense_id:expenseId||null,receipts:rows}
}
export async function saveReceiptBatch(client,context,receipts,onProgress=()=>{}){
 if(!context.result){const{data,error}=await client.rpc('finance_receipts_write',{p_project:context.projectId,p_request:context.requestId,p_payload:context.payload});if(error)throw error;if(!data?.expense_id||data.payments?.length!==context.payload.receipts.length)throw new Error('回應未完成，請用同一表格重試');context.result=data;onProgress()}
 const failed=[]
 for(const row of receipts){if(!row.items?.length)continue;const mapping=context.result.payments.find(x=>x.receipt_id===row.id);if(!mapping?.payment_id)throw new Error('購買單付款對應資料遺失');try{await savePaymentProofs(client,{projectId:context.projectId,paymentId:mapping.payment_id},row.items,onProgress)}catch(e){failed.push(`${row.merchant||'購買單'}：${e.message}`)}}
 if(failed.length)throw new Error('合併項目及付款已儲存，部分附件未完成。重試唔會重複入帳。 '+failed.join('；'))
 return context.result
}
