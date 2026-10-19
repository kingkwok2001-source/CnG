export const attachmentBucket='finance-attachments'
export const maxFileSize=10*1024*1024
export const maxPaymentFiles=10
const mimeExtensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}
export function attachmentPath(projectId,paymentId,item){return `${projectId}/payments/${paymentId}/${item.id}.${mimeExtensions[item.file.type]||'jpg'}`}
export async function preparePaymentFile(original){
 if(original.size>maxFileSize)throw new Error(`${original.name} 超過 10MB`)
 let file=original
 if(!file.type&&/\.pdf$/i.test(file.name))file=new File([file],file.name,{type:'application/pdf'})
 if(!mimeExtensions[file.type]){
  if(!file.type.startsWith('image/')&&!/\.(heic|heif)$/i.test(file.name))throw new Error('請選擇相片或 PDF')
  const url=URL.createObjectURL(file)
  try{
   const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('呢張相未能轉換，請選擇 JPG／PNG 或截圖'));image.src=url})
   const scale=Math.min(1,2400/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height)
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob)throw new Error('相片轉換失敗')
   file=new File([blob],original.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'})
  }finally{URL.revokeObjectURL(url)}
 }
 return {id:crypto.randomUUID(),file,url:URL.createObjectURL(file),saved:false}
}

// A committed payment receipt is retained across file retries. There is never
// an upload before finance_write returns its payment_id.
export async function savePaymentProofs(client,context,items,onProgress=()=>{}){
 if(!context.paymentId){
  const{data,error}=await client.rpc('finance_write',{p_project:context.projectId,p_request:context.requestId,p_kind:'payment',p_payload:context.payload})
  if(error)throw error
  if(!data?.payment_id)throw new Error('付款回應缺少 ID，請重新整理確認付款紀錄')
  context.paymentId=data.payment_id;onProgress()
 }
 const parent=await client.from('payments').select('id').eq('project_id',context.projectId).eq('id',context.paymentId).maybeSingle()
 if(parent.error)throw parent.error
 if(!parent.data)throw new Error('呢筆付款已不存在，附件未有上載')
 const failures=[]
 for(const item of items){
  if(item.saved)continue
  const path=attachmentPath(context.projectId,context.paymentId,item),row={id:item.id,project_id:context.projectId,payment_id:context.paymentId,storage_path:path,file_name:item.file.name,mime_type:item.file.type}
  item.status='上載中';onProgress()
  try{
   const upload=await client.storage.from(attachmentBucket).upload(path,item.file,{contentType:item.file.type,upsert:false})
   if(upload.error&&String(upload.error.statusCode)!=='409'&&upload.error.status!==409)throw upload.error
   const registered=await client.from('attachments').insert(row)
   if(registered.error){
    // A lost response may hide a successful insert. Verify before compensating.
    const existing=await client.from('attachments').select('id,payment_id,storage_path').eq('id',item.id).maybeSingle()
    if(existing.error)throw existing.error
    if(!existing.data){await client.storage.from(attachmentBucket).remove([path]);throw registered.error}
    if(existing.data.payment_id!==context.paymentId||existing.data.storage_path!==path)throw new Error('附件資料不一致')
   }
   item.saved=true;item.status='已儲存';item.error=''
  }catch(error){item.status='未完成';item.error=error.message||'上載失敗';failures.push(item)}
  onProgress()
 }
 if(failures.length)throw new Error(`付款已儲存，${failures.length} 個附件未完成。按「新增付款」只會重試附件，唔會重複扣帳。`)
 return context.paymentId
}
export async function removePaymentAttachment(client,file){
 const{data,error}=await client.from('attachments').delete().eq('project_id',file.project_id).eq('id',file.id).select('id')
 if(error)throw error
 if(!data?.length)throw new Error('附件已不存在，或你冇權刪除。')
 // The delete trigger queues this exact path in the same DB transaction.
 // If the browser goes offline now, the existing worker still removes the file.
 try{const result=await client.storage.from(attachmentBucket).remove([file.storage_path]);return !result.error}catch{return false}
}
export async function removePayment(client,projectId,paymentId,files){
 const{data,error}=await client.from('payments').delete().eq('project_id',projectId).eq('id',paymentId).select('id')
 if(error)throw error
 if(!data?.length)throw new Error('付款已不存在，或你冇權刪除。')
 if(!files.length)return true
 try{const result=await client.storage.from(attachmentBucket).remove(files.map(f=>f.storage_path));return !result.error}catch{return false}
}
