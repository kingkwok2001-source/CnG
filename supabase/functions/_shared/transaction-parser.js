export const paymentMethods=['現金','銀行轉帳','信用卡','Apple Pay','PayMe','支付寶','八達通','馬會','其他']
export const localToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Hong_Kong'}).format(new Date())
const spendLabel=/(?:消費(?:金額)?|付款(?:金額)?|已付|支付(?:金額)?|支出|扣款|purchase(?: amount)?|spent|paid|debit(?: amount)?|transaction amount)\s*[:：]?\s*$/i
const balanceLabel=/(?:餘額|結餘|可用額|balance|available)(?:\s*(?:為|is))?\s*[:：]?\s*$/i
export function parseTransaction(input){
 const text=String(input||''),lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
 const matches=[...text.matchAll(/(?:HK\s*\$|HKD|港幣|金額\s*[:：]?|Amount\s*[:：]?|\$)\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])/gi)].map(m=>({value:Number(m[1].replaceAll(',','')),prefix:text.slice(Math.max(0,m.index-60),m.index).split(/\r?\n/).pop()}))
 const labelled=matches.filter(m=>spendLabel.test(m.prefix)),candidates=matches.filter(m=>!balanceLabel.test(m.prefix))
 // Never choose an unlabelled amount from multiple amounts, a balance, a top-up or a refund.
 const chosen=labelled.length===1?labelled[0]:labelled.length===0&&candidates.length===1&&matches.length===1?candidates[0]:null
 const nonExpense=/(增值|充值|退款|退回|top[ -]?up|refund)/i.test(text)
 const amount=!nonExpense&&chosen?.value>0?chosen.value:''
 const match=text.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})/)
 const date=match?`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`:localToday()
 const method=paymentMethods.find(m=>text.toLowerCase().includes(m.toLowerCase()))||(/octopus/i.test(text)?'八達通':/alipay/i.test(text)?'支付寶':'')
 const merchant=lines.find(l=>/^(商戶|收款人|收款方|Merchant|To)\s*[:：]/i.test(l))?.replace(/^[^:：]+[:：]\s*/,'')||''
 return{title:merchant,amount,date,method,ambiguous:amount===''}
}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
