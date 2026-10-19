// Temporary integration runner. Requires the existing scheduled-cleanup secret,
// creates only disposable fixture users/projects, and removes all fixtures.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {savePaymentProofs,removePaymentAttachment,attachmentPath} from './payment-files.js'
const options={auth:{persistSession:false,autoRefreshToken:false}}
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message)}
const uuid=()=>crypto.randomUUID()
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Not found',{status:404})
 const url=Deno.env.get('SUPABASE_URL')!,admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options),token=req.headers.get('x-cleanup-token')
 const auth=await admin.rpc('finance_cleanup_authorized',{p_token:token||''})
 if(auth.error||auth.data!==true)return new Response('Unauthorized',{status:401})
 if(url!=='https://viulxubgtgruvvbxetsd.supabase.co')return new Response('Wrong project',{status:400})
 const userIds:string[]=[],projectIds:string[]=[],paths:string[]=[],passed:string[]=[]
 async function user(){const email=`finance-proof-${uuid()}@example.invalid`,password=uuid()+uuid();const{data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;userIds.push(data.user.id);const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;return {client,id:data.user.id,session:login.data.session}}
 async function checked(query:any){const r=await query;if(r.error)throw r.error;return r.data}
 try{
  const owner=await user(),other=await user(),client=owner.client
  const project=await checked(client.from('projects').insert({owner_id:owner.id,name:'Disposable payment proof verification',project_type:'custom',currency:'HKD'}).select().single());projectIds.push(project.id)
  const expense=await checked(client.from('expenses').insert({project_id:project.id,title:'Disposable receipt fixture',total_amount:10000}).select().single())
  const context=()=>({projectId:project.id,requestId:uuid(),paymentId:null,payload:{expense_id:expense.id,amount:100,paid_at:'2026-10-17',method:'FPS',notes:'Fixture only'}})
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6TOsAAAAASUVORK5CYII='),c=>c.charCodeAt(0))
  const item=(name:string,type='image/png')=>({id:uuid(),file:new File([type==='application/pdf'?new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'):png],name,{type}),saved:false})
  const empty=context();await savePaymentProofs(client,empty,[]);passed.push('payment_without_attachment')
  const single=context(),one=item('receipt.png');await savePaymentProofs(client,single,[one]);paths.push(attachmentPath(project.id,single.paymentId!,one));passed.push('payment_with_one_image')
  const multiple=context(),items=[item('fps.png'),item('payme.png'),item('bank.png'),item('receipt.pdf','application/pdf')];await savePaymentProofs(client,multiple,items);paths.push(...items.map(x=>attachmentPath(project.id,multiple.paymentId!,x)));passed.push('multiple_images_and_pdf')
  const repeated={...multiple,paymentId:null};await savePaymentProofs(client,repeated,items.map(x=>({...x,saved:false})));assert(repeated.paymentId===multiple.paymentId,'retry payment ID changed');const payRows=await checked(client.from('payments').select('*').eq('project_id',project.id));assert(payRows.length===3,'retry duplicated payment');assert(payRows.every((p:any)=>p.notes==='Fixture only'),'notes not saved');passed.push('retry_no_duplicate')
  const reloaded=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{...options,global:{headers:{Authorization:`Bearer ${owner.session!.access_token}`}}})
  const rows=await checked(reloaded.from('attachments').select('*').eq('project_id',project.id));assert(rows.length===5,'reload lost files');assert(rows.every((a:any)=>a.payment_id&&!a.expense_id&&!a.income_id),'one parent violated');passed.push('reload_retains_payment_links')
  const signed=await checked(reloaded.storage.from('finance-attachments').createSignedUrl(rows[0].storage_path,60));const image=await fetch(signed.signedUrl);assert(image.ok&&(await image.arrayBuffer()).byteLength>20,'preview failed');passed.push('signed_preview_download')
  const foreign=await other.client.from('attachments').select('*').eq('project_id',project.id);assert(!foreign.error&&foreign.data!.length===0,'outsider read files');const forbidden=await other.client.storage.from('finance-attachments').createSignedUrl(rows[0].storage_path,60);assert(!!forbidden.error,'outsider preview allowed');const outsideUpload=await other.client.storage.from('finance-attachments').upload(project.id+'/payments/'+single.paymentId+'/'+uuid()+'.png',png,{contentType:'image/png'});assert(!!outsideUpload.error,'outsider upload allowed');passed.push('project_isolation')
  const missingPath=project.id+'/payments/'+uuid()+'/'+uuid()+'.png',missing=await client.storage.from('finance-attachments').upload(missingPath,png,{contentType:'image/png'});assert(!!missing.error,'upload before payment allowed');passed.push('missing_payment_blocks_upload')
  const cross=await checked(client.from('projects').insert({owner_id:owner.id,name:'Disposable isolation fixture',project_type:'custom',currency:'HKD'}).select().single());projectIds.push(cross.id)
  const mismatch=await client.from('attachments').insert({id:uuid(),project_id:cross.id,payment_id:single.paymentId,storage_path:rows[0].storage_path,file_name:'forge.png',mime_type:'image/png'});assert(!!mismatch.error,'cross project attachment allowed');passed.push('parent_project_constraint')
  await removePaymentAttachment(client,rows[0]);assert((await checked(client.from('payments').select('id').eq('id',rows[0].payment_id))).length===1,'deleting attachment deleted payment');const gone=await client.storage.from('finance-attachments').download(rows[0].storage_path);assert(!!gone.error,'attachment file not removed');passed.push('delete_attachment_keeps_payment')
  await checked(client.from('payments').delete().eq('id',multiple.paymentId));const remaining=await checked(client.from('attachments').select('id').eq('payment_id',multiple.paymentId));assert(!remaining.length,'payment cascade retained attachment rows');const batch=await checked(admin.rpc('finance_cleanup_batch'));assert(items.every(x=>batch.some((q:any)=>q.path===attachmentPath(project.id,multiple.paymentId!,x))),'deleted payment files not queued');passed.push('payment_delete_cascades_and_queues_files')
  const worker=await fetch(url+'/functions/v1/delete-account',{method:'POST',headers:{'Content-Type':'application/json','x-cleanup-token':token!},body:JSON.stringify({action:'cleanup'})});assert(worker.ok,'scheduled cleanup worker failed');for(const x of items){const check=await client.storage.from('finance-attachments').download(attachmentPath(project.id,multiple.paymentId!,x));assert(!!check.error,'worker retained a deleted payment file')}passed.push('actual_worker_deletes_storage_files')
  return Response.json({success:true,passed})
 }catch(error){return Response.json({success:false,passed,error:(error as Error).message||String(error)},{status:500})}
 finally{
  // Paths are fixture-generated; never enumerate or remove real project files.
  if(paths.length)await admin.storage.from('finance-attachments').remove(paths)
  for(const id of userIds)await admin.auth.admin.deleteUser(id)
 }
})
