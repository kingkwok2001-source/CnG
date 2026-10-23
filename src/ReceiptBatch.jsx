import React,{useContext,useEffect,useRef,useState} from 'react'
import {Camera,FileText,Plus,Trash2,X} from 'lucide-react'
import {supabase} from './supabase'
import {localToday,paymentMethods} from './transaction-parser'
import {preparePaymentFile,maxPaymentFiles} from './payment-files'
import {ProofViewer} from './PaymentProofs'
import {receiptPayload,receiptTotal,receiptSuggestions,saveReceiptBatch} from './receipt-batch'
import {SheetCloseContext} from './SheetCloseContext'
import './receipt-batch.css'
const blankReceipt=()=>({id:crypto.randomUUID(),merchant:'',amount:'',date:localToday(),method:'',items:[]})
const money=(amount,currency)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(amount)
export default function ReceiptBatch({p,cats=[],expenses=[],expense=null,client=supabase,done}){
 const[rows,setRows]=useState(()=>[blankReceipt()]),[title,setTitle]=useState(''),[expenseId,setExpenseId]=useState(expense?.id||''),[category,setCategory]=useState(cats[0]?.id||''),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[reading,setReading]=useState(''),[error,setError]=useState(''),[viewer,setViewer]=useState(null),[,render]=useState(0)
 const context=useRef({projectId:p.id,requestId:crypto.randomUUID()}),selected=useRef(rows),lock=useRef(false),mounted=useRef(true),worker=useRef(null),batchInput=useRef(null),rowInput=useRef(null),cameraInput=useRef(null),target=useRef(null),guard=useContext(SheetCloseContext)
 selected.current=rows
 const existing=expense||expenses.find(x=>x.id===expenseId),total=receiptTotal(rows),locked=busy||!!reading||!!context.current.started
 useEffect(()=>()=>{mounted.current=false;worker.current?.terminate();for(const row of selected.current)for(const item of row.items)URL.revokeObjectURL(item.url)},[])
 useEffect(()=>{if(!guard)return;const check=()=>{if(lock.current||preparing||reading)return false;const pending=selected.current.some(r=>r.amount||r.merchant||r.items.length);return !pending||confirm(context.current.result?'合併項目已儲存。關閉會放棄尚未上載嘅附件，繼續？':'未儲存嘅購買單會被移除，確定離開？')};guard.current=check;return()=>{if(guard.current===check)guard.current=null}},[guard,preparing,reading])
 const patch=(id,values)=>setRows(old=>old.map(row=>row.id===id?{...row,...values}:row))
 function removeRow(row){for(const item of row.items)URL.revokeObjectURL(item.url);setRows(old=>old.length===1?[blankReceipt()]:old.filter(x=>x.id!==row.id))}
 function removeFile(row,item){URL.revokeObjectURL(item.url);patch(row.id,{items:row.items.filter(x=>x.id!==item.id)})}
 async function choose(files,rowId=null){
  if(lock.current||preparing||reading)return;setPreparing(true);setError('')
  const count=selected.current.reduce((n,r)=>n+r.items.length,0),room=Math.max(0,20-count),list=Array.from(files||[]),items=[],errors=[]
  const row=selected.current.find(r=>r.id===rowId),limit=rowId?Math.min(room,maxPaymentFiles-(row?.items.length||0)):Math.min(room,20-selected.current.filter(r=>r.items.length||r.amount||r.merchant).length)
  if(list.length>limit)errors.push('每批最多 20 張單／20 個檔案，每張單最多 10 個附件')
  for(const file of list.slice(0,Math.max(0,limit))){try{items.push(await preparePaymentFile(file))}catch(e){errors.push(e.message)}}
  if(!mounted.current){for(const item of items)URL.revokeObjectURL(item.url);return}
  if(rowId)patch(rowId,{items:[...(row?.items||[]),...items]})
  else setRows(old=>{const next=[...old];for(const item of items){const index=next.findIndex(r=>!r.amount&&!r.merchant&&!r.items.length);if(index>=0)next[index]={...next[index],items:[item]};else next.push({...blankReceipt(),items:[item]})}return next})
  setPreparing(false);setError(errors.join('；'))
 }
 async function recognize(row){
  const item=row.items.find(x=>x.file.type.startsWith('image/'));if(!item||lock.current||reading||preparing)return
  setReading(row.id);setError('');patch(row.id,{status:'準備辨認…'})
  try{if(!worker.current){const{createWorker}=await import('tesseract.js');worker.current=await createWorker(['eng','chi_tra'])}if(!mounted.current){await worker.current.terminate();worker.current=null;return};const{data}=await worker.current.recognize(item.file);if(!mounted.current)return;patch(row.id,receiptSuggestions(selected.current.find(x=>x.id===row.id)||row,data.text))}
  catch{if(mounted.current)patch(row.id,{status:'辨認失敗，可以直接填金額。'})}finally{if(mounted.current)setReading('')}
 }
 async function submit(event){
  event.preventDefault();if(lock.current||preparing||reading)return
  if(!context.current.payload){try{context.current.payload=receiptPayload({title,categoryId:category,expenseId,receipts:rows})}catch(e){setError(e.message);return}}
  lock.current=true;context.current.started=true;setBusy(true);setError('')
  try{await saveReceiptBatch(client,context.current,rows,()=>{if(mounted.current)render(x=>x+1)});await done(context.current.result)}
  catch(e){setError(e.message||'未能儲存，請用同一表格重試')}
  finally{lock.current=false;if(mounted.current)setBusy(false)}
 }
 return <form className="form receipt-batch" onSubmit={submit}><div className="receipt-intro"><small>MULTIPLE RECEIPTS</small><h2>{expense?'加入購買單':'多張單合併一個項目'}</h2><p>唔同舖頭買同一項目？每張單填一個金額，自動加總。呢度每張單會記成一筆已付款。</p></div>
  {expense?<div className="receipt-target"><small>加入目前項目</small><b>{expense.title}</b></div>:<><label>加入邊個項目？<select disabled={locked} value={expenseId} onChange={e=>setExpenseId(e.target.value)}><option value="">＋ 建立一個合併項目</option>{expenses.map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select></label>{!expenseId&&<><label>項目名稱<input disabled={locked} value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="例如：回禮用品"/></label><label>分類<select disabled={locked} value={category} onChange={e=>setCategory(e.target.value)}><option value="">其他</option>{cats.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label></>}</>}
  <button className="ghost receipt-select-many" type="button" disabled={locked||preparing||!!reading} onClick={()=>batchInput.current.click()}><Camera/>一次選多張單</button><input ref={batchInput} hidden type="file" accept="image/*,application/pdf,.pdf" multiple aria-label="選擇多張購買單" onChange={e=>{choose(e.target.files);e.target.value=''}}/>
  <input ref={rowInput} hidden type="file" accept="image/*,application/pdf,.pdf" multiple aria-label="加入此單附件" onChange={e=>{choose(e.target.files,target.current);e.target.value=''}}/><input ref={cameraInput} hidden type="file" accept="image/*" capture="environment" aria-label="拍攝購買單" onChange={e=>{choose(e.target.files,target.current);e.target.value=''}}/>
  <div className="receipt-rows">{rows.map((row,index)=><section className="receipt-row" key={row.id} aria-label={`第 ${index+1} 張單`}><div className="receipt-row-title"><b>第 {index+1} 張單</b><button type="button" aria-label={`移除第 ${index+1} 張單`} disabled={locked||preparing||!!reading} onClick={()=>removeRow(row)}><Trash2/></button></div><div className="receipt-fields"><label>商戶（選填）<input disabled={locked} value={row.merchant} maxLength={160} onChange={e=>patch(row.id,{merchant:e.target.value})} placeholder="例如：商店 A"/></label><label>金額（{p.currency}）<input disabled={locked} inputMode="decimal" value={row.amount} onChange={e=>patch(row.id,{amount:e.target.value})} placeholder="0.00"/></label></div><details className="receipt-extra"><summary>{row.date} · {row.method||'付款方式選填'}</summary><div className="two-fields"><label>日期<input disabled={locked} type="date" value={row.date} onChange={e=>patch(row.id,{date:e.target.value})}/></label><label>付款方式<select disabled={locked} value={row.method} onChange={e=>patch(row.id,{method:e.target.value})}><option value="">選擇方式</option>{paymentMethods.map(m=><option key={m}>{m}</option>)}</select></label></div></details><div className="receipt-file-actions"><button type="button" className="ghost" disabled={locked||preparing||!!reading} onClick={()=>{target.current=row.id;rowInput.current.click()}}><Plus/>附圖／PDF</button><button type="button" className="ghost" disabled={locked||preparing||!!reading} onClick={()=>{target.current=row.id;cameraInput.current.click()}}><Camera/>拍照</button>{row.items.some(x=>x.file.type.startsWith('image/'))&&<button type="button" className="ghost" disabled={locked||preparing||!!reading} onClick={()=>recognize(row)}>辨認金額</button>}</div><div className="receipt-files">{row.items.map(item=><div key={item.id}><button type="button" className="proof-thumb" aria-label={'預覽 '+item.file.name} onClick={()=>setViewer(item)}>{item.file.type.startsWith('image/')?<img src={item.url} alt=""/>:<FileText/>}</button><small>{item.status||item.file.name}</small>{!item.saved&&<button type="button" className="receipt-remove-file" aria-label={'移除附件 '+item.file.name} disabled={locked||preparing||!!reading} onClick={()=>removeFile(row,item)}><X/></button>}</div>)}</div>{row.status&&<p className="proof-hint" role="status">{row.status}</p>}{row.rawText&&<details><summary>辨認原文</summary><pre className="raw-text">{row.rawText}</pre></details>}</section>)}</div>
  <button type="button" className="ghost receipt-add" disabled={locked||preparing||!!reading||rows.length>=20} onClick={()=>setRows(old=>[...old,blankReceipt()])}><Plus/>再加一張單</button><div className="receipt-total" aria-live="polite"><span>{rows.length} 張單 · 本次合計</span><strong>{money(total,p.currency)}</strong>{existing&&<small>項目總額：{money(Number(existing.total_amount)||0,p.currency)} → {money((Number(existing.total_amount)||0)+total,p.currency)}</small>}</div>{existing&&<p className="proof-hint">呢批購買單會追加到項目總額及已付金額。支付原有尚欠款請用「新增付款」。</p>}<small className="proof-hint">附件選填，每個最多 10MB；只喺確認儲存後上載。圖片辨認可逐張用，結果請核對。</small>{preparing&&<p role="status">準備本機預覽…</p>}{error&&<p className="notice error" role="alert">{error}</p>}<button type="submit" className="primary" disabled={busy||preparing||!!reading}>{busy?'儲存中…':context.current.result?'繼續上載附件':expenseId?'確認加入同一項目':'合併入帳'}</button>{viewer&&<ProofViewer file={viewer} client={client} close={()=>setViewer(null)}/>}</form>
}
