import {localToday,parseTransaction,validDate} from '../_shared/transaction-parser.js'
export function capturePayload(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('請提供 JSON 物件')
 const text=typeof input.text==='string'?input.text.slice(0,3000):'',parsed=parseTransaction(text)
 const amount=input.amount==null?parsed.amount:input.amount
 if(amount===''||typeof amount==='boolean'||!Number.isFinite(Number(amount))||Number(amount)<=0||Number(amount)>999999999)throw new Error('未能確定消費金額。請提供 amount；餘額、增值及退款唔會自動當支出。')
 const date=input.date||parsed.date||localToday()
 if(!validDate(date))throw new Error('日期必須係有效 YYYY-MM-DD')
 if(input.request_id&&!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(input.request_id))throw new Error('request_id 必須係 UUID，重試時沿用同一 UUID')
 if(text&&!input.request_id)throw new Error('文字傳入請提供 request_id UUID，重試時沿用同一 UUID')
 return {amount:Number(amount),date,title:String(input.title||parsed.title||'待確認付款').slice(0,160),method:String(input.method||parsed.method||(text?'其他':'Apple Pay')).slice(0,80),...(input.request_id?{request_id:input.request_id}:{})}
}
