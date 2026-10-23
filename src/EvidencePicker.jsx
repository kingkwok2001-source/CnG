import React,{useEffect,useRef,useState} from 'react'
import {Camera,FileText,Plus,X} from 'lucide-react'
import {preparePaymentFile,maxPaymentFiles} from './payment-files'
import {ProofViewer} from './PaymentProofs'
export default function EvidencePicker({items,onChange,disabled,onPreparing,client}){
 const[preparing,setPreparing]=useState(false),[error,setError]=useState(''),[viewer,setViewer]=useState(null),pick=useRef(null),camera=useRef(null),selected=useRef(items),mounted=useRef(true),lock=useRef(false)
 selected.current=items
 useEffect(()=>()=>{mounted.current=false;for(const item of selected.current)URL.revokeObjectURL(item.url)},[])
 async function choose(files){
  if(disabled||lock.current)return;lock.current=true;setPreparing(true);onPreparing(true);setError('')
  const list=Array.from(files||[]),room=maxPaymentFiles-selected.current.length,added=[],errors=[]
  if(list.length>room)errors.push(`每個項目最多 ${maxPaymentFiles} 個附件`)
  for(const file of list.slice(0,Math.max(0,room))){try{added.push(await preparePaymentFile(file))}catch(e){errors.push(e.message)}}
  if(mounted.current){onChange([...selected.current,...added]);setError(errors.join('；'));setPreparing(false);onPreparing(false)}else for(const item of added)URL.revokeObjectURL(item.url)
  lock.current=false
 }
 return <div className="proof-picker"><b>附件／入帳證明 <small>選填</small></b><div className="proof-picker-actions"><button type="button" className="ghost" disabled={disabled||preparing||items.length>=maxPaymentFiles} onClick={()=>pick.current.click()}><Plus/>加入多張圖片／PDF</button><button type="button" className="ghost camera-proof" disabled={disabled||preparing||items.length>=maxPaymentFiles} onClick={()=>camera.current.click()}><Camera/>拍照</button></div><input hidden ref={pick} type="file" aria-label="選擇多個入帳證明" accept="image/*,application/pdf,.pdf" multiple onChange={e=>{choose(e.target.files);e.target.value=''}}/><input hidden ref={camera} type="file" aria-label="拍攝入帳證明" accept="image/*" capture="environment" onChange={e=>{choose(e.target.files);e.target.value=''}}/><small className="proof-hint">同一條數可附多張相片或 PDF，每個最多 10MB，最多 10 個。確認入帳後先上載。</small>{preparing&&<p role="status">準備本機預覽…</p>}<div className="selected-proofs">{items.map(item=><div className="selected-proof" key={item.id}><button type="button" className="proof-thumb" aria-label={'預覽 '+item.file.name} onClick={()=>setViewer(item)}>{item.file.type.startsWith('image/')?<img src={item.url} alt=""/>:<FileText/>}</button>{!item.saved&&<button type="button" className="remove-proof" aria-label={'移除 '+item.file.name} disabled={disabled||preparing} onClick={()=>{URL.revokeObjectURL(item.url);onChange(items.filter(x=>x.id!==item.id))}}><X/></button>}<small>{item.file.name}</small>{item.status&&<small className={item.error?'proof-error':''}>{item.status}</small>}</div>)}</div>{error&&<p className="notice error" role="alert">{error}</p>}{viewer&&<ProofViewer file={viewer} client={client} close={()=>setViewer(null)}/>}</div>
}
