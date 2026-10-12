import React,{useState} from 'react'
import {localToday} from './transaction-parser'
const money=(n,c)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency:c,maximumFractionDigits:2}).format(n||0)
export function PlanningSettings({p,save}){
 const[budget,setBudget]=useState(p.budget??''),[date,setDate]=useState(p.event_date||''),[deposit,setDeposit]=useState(p.monthly_deposit||''),[limit,setLimit]=useState(p.monthly_limit||''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
 async function submit(e){e.preventDefault();if(busy)return;if([budget,deposit,limit].some(v=>!Number.isFinite(Number(v))||Number(v)<0)){setMsg('請填有效金額，唔可以小於零');return}setBusy(true);try{await save({budget:budget===''?null:Number(budget),event_date:date||null,monthly_deposit:Number(deposit)||0,monthly_limit:Number(limit)||0});setMsg('預算及資金設定已儲存')}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 return <><h3 className="section-title">預算、日期及每月資金</h3><form className="card form" onSubmit={submit}><label>總預算（{p.currency}）<input inputMode="decimal" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="未設定"/></label><label>目標／活動日期<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="two-fields"><label>每月存入<input inputMode="decimal" value={deposit} onChange={e=>setDeposit(e.target.value)} placeholder="例如：30000"/></label><label>每月可用於此帳本上限<input inputMode="decimal" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="例如：12000"/></label></div><p className="muted">預算及預測唔會當成實際收入或付款。其他帳號及裝置會同步設定。</p>{msg&&<p className="notice" role="status">{msg}</p>}<button className="primary" disabled={busy}>{busy?'儲存中…':'儲存預算及資金設定'}</button></form></>
}
export function FundingSummary({p,t}){
 const monthly=Math.min(Number(p.monthly_deposit||0),Number(p.monthly_limit||0));let months=0
 if(p.event_date){const start=localToday().split('-').map(Number),end=p.event_date.split('-').map(Number);months=Math.max(0,(end[0]-start[0])*12+end[1]-start[1])}
 if(!p.budget&&!monthly&&!p.event_date)return null
 return <div className="card funding-summary"><h3>預算及資金預測</h3><div className="funding-grid">{p.budget!=null&&<span>預算剩餘<b className={p.budget-t.total<0?'negative':''}>{money(p.budget-t.total,p.currency)}</b></span>}{monthly>0&&<span>每月可用<b>{money(monthly,p.currency)}</b></span>}{p.event_date&&<span>目標日期<b>{p.event_date}</b></span>}{monthly>0&&p.event_date&&<span>未來 {months} 個月預計可用<b>{money(monthly*months,p.currency)}</b></span>}</div>{monthly>0&&p.event_date&&<p className="muted">以由下月至目標月份，每月存入及可用上限較低者估算；相對尚欠金額仍差 {money(Math.max(0,t.due-monthly*months),p.currency)}。未包含你現有存款，唔代表已付款。</p>}</div>
}
