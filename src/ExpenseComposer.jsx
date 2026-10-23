import React,{useContext,useEffect,useRef,useState} from 'react'
import {supabase} from './supabase'
import {paymentMethods,localToday,validDate} from './transaction-parser'
import {receiptCents} from './receipt-batch'
import {saveExpenseProofs} from './expense-files'
import EvidencePicker from './EvidencePicker'
import {SheetCloseContext} from './SheetCloseContext'
export default function ExpenseComposer({p,cats,record,done,client=supabase}){
 const[title,setTitle]=useState(record?.title||''),[amount,setAmount]=useState(record?.total_amount||''),[category,setCategory]=useState(record?.category_id||cats[0]?.id||''),[paid,setPaid]=useState(''),[method,setMethod]=useState('現金'),[date,setDate]=useState(record?.expense_date||localToday()),[due,setDue]=useState(record?.due_date||''),[person,setPerson]=useState(record?.responsible_person||''),[notes,setNotes]=useState(record?.notes||''),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState(''),[,render]=useState(0)
 const context=useRef({projectId:p.id,requestId:crypto.randomUUID()}),saving=useRef(false),selected=useRef(items),mounted=useRef(true),guard=useContext(SheetCloseContext)
 selected.current=items
 useEffect(()=>()=>{mounted.current=false},[])
 useEffect(()=>{if(!guard)return;const check=()=>!saving.current&&!preparing&&(!selected.current.some(x=>!x.saved)||confirm(context.current.expenseId?'支出已儲存，關閉會放棄未上載附件，繼續？':'未送出嘅入帳證明會被移除，確定離開？'));guard.current=check;return()=>{if(guard.current===check)guard.current=null}},[guard,preparing])
 const locked=busy||!!context.current.started
 async function save(event){
  event.preventDefault();if(saving.current||preparing)return
  if(!context.current.values){try{const cents=receiptCents(amount),paidCents=String(paid).trim()?Number(paid)===0?0:receiptCents(paid):0;if(!title.trim()||paidCents>cents||!validDate(date)||(due&&!validDate(due)))throw new Error('請核對項目、金額及日期；已付不可大過總額');context.current.values={project_id:p.id,title:title.trim(),total_amount:cents/100,category_id:category||null,expense_date:date,due_date:due||null,responsible_person:person||null,notes:notes||null};context.current.payload={...context.current.values,paid:paidCents/100,method}}catch(e){setError(e.message);return}}
  saving.current=true;context.current.started=true;setBusy(true);setError('')
  try{
   if(!context.current.expenseId){if(record){const result=await client.from('expenses').update(context.current.values).eq('project_id',p.id).eq('id',record.id).select().single();if(result.error)throw result.error;context.current.expenseId=result.data.id}else{const{data,error}=await client.rpc('finance_write',{p_project:p.id,p_request:context.current.requestId,p_kind:'expense',p_payload:context.current.payload});if(error)throw error;if(!data?.expense_id)throw new Error('未取得支出編號，請用同一表格重試');context.current.expenseId=data.expense_id}}
   await saveExpenseProofs(client,context.current,items,()=>{if(mounted.current)render(x=>x+1)});await done()
  }catch(e){if(mounted.current)setError((context.current.expenseId?'支出已儲存，重試唔會重複入帳。 ':'')+(e.message||'未能儲存，請重試'))}
  finally{saving.current=false;if(mounted.current)setBusy(false)}
 }
 return <><h2>{record?'修改支出':'新增支出'}</h2><form className="form" onSubmit={save}><label>項目 *<input disabled={locked} autoFocus value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="例如：回禮用品"/></label><label>金額 *<input disabled={locked} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={p.currency+' 0'}/></label><label>分類<select disabled={locked} value={category} onChange={e=>setCategory(e.target.value)}><option value="">其他</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{!record&&<label>已付款金額（選填）<input disabled={locked} inputMode="decimal" value={paid} onChange={e=>setPaid(e.target.value)} placeholder="0"/></label>}{!record&&Number(paid)>0&&<label>付款方式<select disabled={locked} value={method} onChange={e=>setMethod(e.target.value)}>{paymentMethods.map(m=><option key={m}>{m}</option>)}</select></label>}<div className="two-fields"><label>日期<input disabled={locked} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>到期日<input disabled={locked} type="date" value={due} onChange={e=>setDue(e.target.value)}/></label></div><label>負責人<input disabled={locked} value={person} onChange={e=>setPerson(e.target.value)} placeholder="例如：Carl"/></label><label>備註<textarea disabled={locked} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="付款安排、供應商資料等"/></label><EvidencePicker items={items} onChange={setItems} disabled={busy} onPreparing={setPreparing} client={client}/>{error&&<p className="notice error" role="alert">{error}</p>}<button className="primary" type="submit" disabled={busy||preparing}>{busy?'儲存中…':context.current.expenseId?'繼續儲存附件':'完成'}</button></form></>
}
