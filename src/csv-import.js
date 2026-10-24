import {validDate} from './transaction-parser.js'

export function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false,closed=false
 function field(){row.push(cell.trim());cell='';closed=false}
 function line(){field();if(row.some(Boolean))rows.push(row);row=[]}
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c===','){field();continue}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue}
  if(closed){if(c===' '||c==='\t')continue;throw new Error('引號後有多餘文字，請檢查 CSV 格式')}
  if(c==='"'){if(cell.trim())throw new Error('欄位中間有未跳脫引號');cell='';quoted=true}else cell+=c
 }
 if(quoted)throw new Error('引號未封口，請檢查 CSV 格式')
 line();return rows
}
function money(text,blankZero=false){
 const raw=String(text??'').trim();if(!raw&&blankZero)return 0
 const value=raw.replace(/^(?:HKD\s*\$?|HK\$|\$)\s*/i,'')
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))return NaN
 const [whole,fraction='']=value.replaceAll(',','').split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 return Number.isSafeInteger(cents)&&cents<=99999999900?cents/100:NaN
}
export function parseExpenseCsv(text){
 const fail=message=>({rows:[],errors:[message]});let parsed
 try{parsed=parseCsv(text.replace(/^\ufeff/,''))}catch(e){return fail(e.message)}
 if(parsed.length<2)return fail('檔案沒有資料，請加入至少一筆帳目')
 if(parsed.length>1001)return fail('每批最多 1,000 筆，請分開檔案')
 const headers=parsed[0],required=['日期','分類','項目','總金額','已付'],missing=required.filter(x=>!headers.includes(x))
 if(missing.length)return fail(`缺少欄位：${missing.join('、')}`)
 if(new Set(headers).size!==headers.length||headers.some(h=>!h))return fail('欄名重複或空白，請使用標準範本')
 const index=Object.fromEntries(headers.map((h,i)=>[h,i])),errors=[],rows=[]
 for(const [n,r] of parsed.slice(1).entries()){
  const line=n+2
  if(r.length!==headers.length){errors.push(`第 ${line} 行：欄位數量與標題不同`);continue}
  const value=key=>r[index[key]]||'',item={line,date:value('日期'),category:value('分類')||'其他',title:value('項目'),total:money(value('總金額')),paid:money(value('已付'),true),dueDate:value('到期日'),person:value('負責人'),notes:value('備註')}
  if(!validDate(item.date))errors.push(`第 ${line} 行：日期請用有效 YYYY-MM-DD`)
  if(item.dueDate&&!validDate(item.dueDate))errors.push(`第 ${line} 行：到期日無效`)
  if(!item.title)errors.push(`第 ${line} 行：缺少項目`)
  if(!Number.isFinite(item.total)||item.total<=0)errors.push(`第 ${line} 行：總金額無效（最多兩位小數）`)
  if(!Number.isFinite(item.paid)||item.paid<0||item.paid>item.total)errors.push(`第 ${line} 行：已付金額無效（最多兩位小數，不可大過總額）`)
  rows.push(item)
 }
 return {rows,errors}
}
