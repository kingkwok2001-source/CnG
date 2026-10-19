import React,{useContext,useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {ArrowLeft,Camera,ChevronRight,Download,FileText,Paperclip,Plus,Trash2,X} from 'lucide-react'
import {supabase} from './supabase'
import {paymentMethods,localToday,validDate} from './transaction-parser'
import {SheetCloseContext} from './SheetCloseContext'
import {attachmentBucket,maxPaymentFiles,preparePaymentFile,savePaymentProofs,removePaymentAttachment,removePayment} from './payment-files'
import './payment-proofs.css'
const money=(value,currency)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(Number(value))
const date=value=>value?new Intl.DateTimeFormat('zh-HK',{dateStyle:'medium'}).format(new Date(value.slice(0,10)+'T12:00:00')):'—'

function useSignedFile(client,file){
 const[url,setUrl]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let active=true;setUrl('');setError('');if(!file.storage_path)return;const load=()=>client.storage.from(attachmentBucket).createSignedUrl(file.storage_path,600).then(({data,error})=>{if(!active)return;if(error)setError('未能載入附件');else setUrl(data.signedUrl)}).catch(()=>{if(active)setError('未能載入附件')});load();const timer=setInterval(load,8*60*1000);return()=>{active=false;clearInterval(timer)}},[client,file.storage_path])
 return{url,error}
}
export function ProofViewer({file,client=supabase,close}){
 const remote=useSignedFile(client,file.url?{storage_path:''}:file),url=file.url||remote.url,isImage=(file.file?.type||file.mime_type||'').startsWith('image/'),box=useRef(null)
 useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';box.current?.focus();const handle=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}if(event.key==='Tab'){const nodes=box.current?.querySelectorAll('button,a[href],iframe');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}};window.addEventListener('keydown',handle,true);return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',handle,true);previous?.focus()}},[])
 return createPortal(<section className="proof-viewer" role="dialog" aria-modal="true" aria-label="付款證明全螢幕預覽" tabIndex={-1} ref={box}><div className="proof-viewer-toolbar"><span>{file.file?.name||file.file_name}</span>{url&&<a href={url} target="_blank" rel="noopener noreferrer" download={file.file?.name||file.file_name}><Download/>開啟／下載</a>}<button aria-label="關閉全螢幕預覽" onClick={close}><X/></button></div><div className="proof-viewer-content">{url?isImage?<img src={url} alt={file.file?.name||file.file_name}/>:<iframe title="PDF 付款證明" src={url}/>:<p>{remote.error||'載入中…'}</p>}</div></section>,document.body)
}
function ProofThumb({file,client,open}){const{url,error}=useSignedFile(client,file);return <button className="proof-thumb" aria-label={'預覽 '+file.file_name} onClick={open}>{file.mime_type?.startsWith('image/')&&url?<img src={url} alt="" loading="lazy"/>:<FileText/>}{error&&<span>重試預覽</span>}</button>}

export function PaymentComposer({project,expense,client=supabase,done}){
 const[amount,setAmount]=useState(''),[paidAt,setPaidAt]=useState(localToday()),[method,setMethod]=useState(''),[notes,setNotes]=useState(''),[items,setItems]=useState([]),[viewer,setViewer]=useState(null),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState(''),[,render]=useState(0)
 const context=useRef({projectId:project.id,requestId:crypto.randomUUID(),paymentId:null}),saving=useRef(false),selected=useRef(items),pick=useRef(null),camera=useRef(null),guard=useContext(SheetCloseContext),mounted=useRef(true)
 selected.current=items
 useEffect(()=>()=>{mounted.current=false;for(const item of selected.current)URL.revokeObjectURL(item.url)},[])
 useEffect(()=>{if(!guard)return;guard.current=()=>{if(saving.current||preparing)return false;const pending=selected.current.some(x=>!x.saved);return !pending||confirm(context.current.paymentId?'付款已儲存，部分附件未完成。關閉會放棄未上載附件，是否繼續？':'未送出嘅付款證明會被移除，確定關閉？')};return()=>{guard.current=null}},[guard,preparing])
 const progress=()=>{if(mounted.current)render(x=>x+1)}
 async function choose(files){
  if(preparing||saving.current)return;setPreparing(true);setError('')
  const list=Array.from(files||[]),room=maxPaymentFiles-selected.current.length,newItems=[],errors=[]
  if(list.length>room)errors.push(`每筆付款最多 ${maxPaymentFiles} 個附件`)
  for(const file of list.slice(0,room)){try{newItems.push(await preparePaymentFile(file))}catch(e){errors.push(e.message)}}
  if(mounted.current){setItems(old=>[...old,...newItems]);setPreparing(false);setError(errors.join('；'))}else for(const item of newItems)URL.revokeObjectURL(item.url)
 }
 async function submit(event){
  event.preventDefault();if(saving.current||preparing)return
  if(!context.current.paymentId&&(!Number.isFinite(Number(amount))||Number(amount)<=0||!validDate(paidAt))){setError('請輸入有效付款金額及日期');return}
  saving.current=true;setBusy(true);setError('')
  if(!context.current.payload)context.current.payload={expense_id:expense.id,amount:Number(amount),paid_at:paidAt,method:method||null,notes:notes.trim()||null}
  try{await savePaymentProofs(client,context.current,items,progress);await done()}
  catch(e){setError((context.current.paymentId&&!e.message.startsWith('付款已儲存')?'付款已儲存，附件未完成。重試唔會重複記帳。 ':'')+e.message);if(!context.current.paymentId)setError(e.message)}
  finally{saving.current=false;if(mounted.current)setBusy(false)}
 }
 const locked=busy||!!context.current.paymentId
 return <form className="form compact payment-composer" onSubmit={submit}><h3>新增付款</h3><label>金額<input disabled={locked} inputMode="decimal" value={amount} onChange={e=>{context.current.payload=null;setAmount(e.target.value)}} placeholder={money(expense.outstanding_amount,project.currency)}/></label><div className="two-fields"><label>日期<input disabled={locked} type="date" value={paidAt} onChange={e=>{context.current.payload=null;setPaidAt(e.target.value)}}/></label><label>方式<select disabled={locked} value={method} onChange={e=>{context.current.payload=null;setMethod(e.target.value)}}><option value="">選擇方式</option>{paymentMethods.map(m=><option key={m}>{m}</option>)}</select></label></div><label>備註（選填）<input disabled={locked} value={notes} onChange={e=>{context.current.payload=null;setNotes(e.target.value)}} placeholder="例如：第二期訂金"/></label><div className="proof-picker"><b>附件／付款證明 <small>選填</small></b><div className="proof-picker-actions"><button type="button" className="ghost" disabled={busy||preparing||items.length>=maxPaymentFiles} onClick={()=>pick.current.click()}><Plus/>加入付款證明</button><button type="button" className="ghost camera-proof" disabled={busy||preparing||items.length>=maxPaymentFiles} onClick={()=>camera.current.click()}><Camera/>拍照</button></div><input hidden ref={pick} aria-label="選擇付款證明檔案" type="file" accept="image/*,application/pdf,.pdf" multiple onChange={e=>{choose(e.target.files);e.target.value=''}}/><input hidden ref={camera} aria-label="拍攝付款證明" type="file" accept="image/*" capture="environment" onChange={e=>{choose(e.target.files);e.target.value=''}}/><small className="proof-hint">相片或 PDF，每個最多 10MB，最多 10 個。按「新增付款」後先上載。</small>{preparing&&<p role="status">準備本機預覽…</p>}<div className="selected-proofs">{items.map(item=><div className="selected-proof" key={item.id}><button type="button" className="proof-thumb" aria-label={'預覽 '+item.file.name} onClick={()=>setViewer(item)}>{item.file.type.startsWith('image/')?<img src={item.url} alt=""/>:<FileText/>}</button>{!item.saved&&<button type="button" className="remove-proof" aria-label={'移除 '+item.file.name} disabled={busy} onClick={()=>{URL.revokeObjectURL(item.url);setItems(old=>old.filter(x=>x.id!==item.id))}}><X/></button>}<small>{item.file.name}</small>{item.status&&<small className={item.error?'proof-error':''}>{item.status}</small>}</div>)}</div></div>{error&&<div className="notice error" role="alert">{error}</div>}<button type="submit" className="primary" disabled={busy||preparing}>{busy?'儲存中…':'新增付款'}</button>{context.current.paymentId&&!busy&&<p className="proof-hint">付款已建立，按上方按鈕會繼續未完成附件。</p>}{viewer&&<ProofViewer file={viewer} client={client} close={()=>setViewer(null)}/>}</form>
}

export function PaymentHistory({payments,files,project,expenseId,client=supabase,reload,onDetailChange}){
 const[opened,setOpened]=useState(null),[rows,setRows]=useState(files),[records,setRecords]=useState(payments),[message,setMessage]=useState('')
 useEffect(()=>{setRows(files);setRecords(payments)},[files,payments])
 const active=records.find(p=>p.id===opened),proofs=rows.filter(f=>f.payment_id===opened)
 useEffect(()=>{onDetailChange?.(!!active)},[active?.id])
 async function refresh(){const[attachments,payments]=await Promise.all([client.from('attachments').select('*').eq('project_id',project.id),client.from('payments').select('*').eq('project_id',project.id).eq('expense_id',expenseId)]);if(attachments.error||payments.error)throw attachments.error||payments.error;setRows(attachments.data||[]);setRecords(payments.data||[]);await reload()}
 if(active)return <PaymentDetail payment={active} files={proofs} project={project} client={client} back={()=>setOpened(null)} refresh={refresh} removed={()=>{setOpened(null);setMessage('付款已刪除；相關檔案會自動清理。')}}/>
 return <section className="proof-history"><h3>付款紀錄</h3>{message&&<p role="status">{message}</p>}{records.length?records.map(payment=>{const attached=rows.filter(f=>f.payment_id===payment.id);return <article className="proof-payment-card" key={payment.id}><button className="proof-payment-open" onClick={()=>setOpened(payment.id)}><span><b>{money(payment.amount,project.currency)}</b><small>{date(payment.paid_at)}</small><small>{payment.method||'未填付款方式'}</small>{attached.length>0&&<small className="proof-count"><Paperclip/>{attached.length} 個附件</small>}</span><ChevronRight/></button>{attached.length>0&&<div className="history-proofs">{attached.slice(0,3).map(file=><ProofThumb key={file.id} file={file} client={client} open={()=>setOpened(payment.id)}/>)}{attached.length>3&&<button className="proof-more" onClick={()=>setOpened(payment.id)}>+{attached.length-3}</button>}</div>}</article>}):<p className="muted">暫時未有付款紀錄</p>}</section>
}
function PaymentDetail({payment,files,project,client,back,refresh,removed}){
 const[viewer,setViewer]=useState(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
 async function del(file){if(busy||!confirm('刪除呢個付款證明？付款紀錄會保留。'))return;setBusy(true);setMsg('');try{const cleaned=await removePaymentAttachment(client,file);await refresh();setMsg(cleaned?'附件已刪除，付款紀錄已保留。':'附件記錄已刪除，檔案已排入背景清理。')}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 async function delPayment(){if(busy||!confirm('刪除呢筆付款及相關付款證明？'))return;setBusy(true);try{await removePayment(client,project.id,payment.id,files);await refresh();removed()}catch(e){setMsg(e.message);setBusy(false)}}
 return <section className="payment-proof-detail"><button className="ghost proof-back" disabled={busy} onClick={back}><ArrowLeft/>返回付款紀錄</button><h3>付款詳情</h3><div className="proof-payment-summary"><strong>{money(payment.amount,project.currency)}</strong><dl><div><dt>日期</dt><dd>{date(payment.paid_at)}</dd></div><div><dt>付款方式</dt><dd>{payment.method||'—'}</dd></div><div><dt>備註</dt><dd>{payment.notes||'—'}</dd></div></dl></div><h4>附件／付款證明 · {files.length}</h4><div className="proof-detail-files">{files.map(file=><div className="proof-file-card" key={file.id}><ProofThumb file={file} client={client} open={()=>setViewer(file)}/><button className="proof-file-name" onClick={()=>setViewer(file)}><b>{file.file_name}</b><small>預覽／全螢幕／開啟下載</small></button><button className="proof-delete-file" disabled={busy} aria-label={'刪除附件 '+file.file_name} onClick={()=>del(file)}><Trash2/></button></div>)}{!files.length&&<p className="muted">呢筆付款未有附件</p>}</div>{msg&&<p className="notice" role="status">{msg}</p>}<button className="danger full" disabled={busy} onClick={delPayment}><Trash2/>刪除付款及付款證明</button>{viewer&&<ProofViewer file={viewer} client={client} close={()=>setViewer(null)}/>}</section>
}
