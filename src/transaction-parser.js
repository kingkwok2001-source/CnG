export const paymentMethods=['現金','銀行轉帳','信用卡','Apple Pay','PayMe','支付寶','八達通','馬會','其他']
export const localToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Hong_Kong'}).format(new Date())
export function parseTransaction(text){
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
 const amountMatches=[...text.matchAll(/(?:HK\s*\$|HKD|港幣|金額\s*[:：]?|Amount\s*[:：]?|\$)\s*([\d,]+(?:\.\d{1,2})?)/gi)]
 const amount=amountMatches.length===1?Number(amountMatches[0][1].replaceAll(',','')):''
 const match=text.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})/)
 const date=match?`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`:localToday()
 const method=paymentMethods.find(m=>text.toLowerCase().includes(m.toLowerCase()))||''
 const merchant=lines.find(l=>/^(商戶|收款人|收款方|Merchant|To)\s*[:：]/i.test(l))?.replace(/^[^:：]+[:：]\s*/,'')||''
 return{title:merchant,amount,date,method,ambiguous:amountMatches.length!==1}
}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
