import React from 'react'
import {CheckCircle2,AlertCircle} from 'lucide-react'
import {parseTransaction,validDate} from './transaction-parser'
export const notificationExample='Octopus\n消費：HK$8.00\n你的新餘額為HK$88.70'
export default function CapturePreview({text,currency='HKD'}){
 const parsed=parseTransaction(text)
 return <section className="capture-result" aria-label="辨認結果預覽"><div className="capture-result-title">{parsed.ambiguous?<AlertCircle/>:<CheckCircle2/>}<b>辨認結果 · 尚未入帳</b></div><strong>{parsed.amount!==''?new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(parsed.amount):'金額待核對'}</strong><dl><div><dt>項目</dt><dd>{parsed.title||'商戶待填寫'}</dd></div><div><dt>日期</dt><dd>{validDate(parsed.date)?parsed.date:'日期待核對'}</dd></div><div><dt>付款方式</dt><dd>{parsed.method||'待選擇'}</dd></div></dl><p>{parsed.ambiguous?'未能確定消費金額，加入待確認後請自行核對。增值請用「錢包及轉帳」。':'確認時仍可修改。消費同餘額會分開，餘額唔會當支出。'}</p>{currency!=='HKD'&&<p>原文金額未作匯率換算，請按帳本貨幣核對。</p>}</section>
}
