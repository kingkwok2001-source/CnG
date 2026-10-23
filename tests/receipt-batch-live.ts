// Temporary integration runner. Requires the existing scheduled-cleanup secret,
// creates only disposable fixture users/projects, and removes all fixtures.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {saveReceiptBatch,receiptPayload} from './receipt-batch.js'
import {attachmentPath,removePaymentAttachment} from './payment-files.js'
import {saveExpenseProofs} from './expense-files.js'
const options={auth:{persistSession:false,autoRefreshToken:false}}
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message)}
const uuid=()=>crypto.randomUUID()
Deno.serve(async(req:Request)=>{
 if(Date.now()>Date.parse('2026-10-23T23:59:00Z'))return new Response('Expired',{status:410})
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
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6TOsAAAAASUVORK5CYII='),c=>c.charCodeAt(0))
  const item=(name:string,type='image/png')=>({id:uuid(),file:new File([type==='application/pdf'?new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'):png],name,{type}),saved:false})
  const rows=[{id:uuid(),merchant:'Synthetic A',amount:'120',date:'2026-10-23',method:'FPS',items:[item('a.png'),item('a.pdf','application/pdf')]},{id:uuid(),merchant:'Synthetic B',amount:'80',date:'2026-10-22',method:'現金',items:[item('b.png')]},{id:uuid(),merchant:'Synthetic C',amount:'150',date:'2026-10-23',method:'PayMe',items:[]}]
  const context={projectId:project.id,requestId:uuid(),payload:receiptPayload({title:'Synthetic grouped purchases',receipts:rows})}
  const result=await saveReceiptBatch(client,context,rows)
  for(const row of rows){const mapping=result.payments.find((p:any)=>p.receipt_id===row.id);for(const file of row.items)paths.push(attachmentPath(project.id,mapping.payment_id,file))}
  const expenses=await checked(client.from('expenses').select('*').eq('project_id',project.id)),payments=await checked(client.from('payments').select('*').eq('project_id',project.id)),files=await checked(client.from('attachments').select('*').eq('project_id',project.id))
  assert(expenses.length===1&&Number(expenses[0].total_amount)===350&&payments.length===3,'Grouped record totals incorrect');passed.push('one_expense_three_merchant_payments')
  assert(files.length===3,'Proof count wrong');for(const row of rows){const mapping=result.payments.find((p:any)=>p.receipt_id===row.id);for(const file of row.items)assert(files.some((f:any)=>f.id===file.id&&f.payment_id===mapping.payment_id&&!f.expense_id&&!f.income_id),'Receipt proof mapped to wrong payment')};passed.push('images_and_pdf_mapped_to_each_receipt')
  const retry={...context,result:undefined};await saveReceiptBatch(client,retry,rows.map(row=>({...row,items:row.items.map(x=>({...x,saved:false}))})));assert((await checked(client.from('payments').select('id').eq('project_id',project.id))).length===3,'Retry duplicated payment');assert((await checked(client.from('attachments').select('id').eq('project_id',project.id))).length===3,'Retry duplicated proof');passed.push('unknown_response_retry_no_duplicates')
  const append=[{id:uuid(),amount:'0.10',date:'2026-10-23',items:[]},{id:uuid(),amount:'0.20',date:'2026-10-23',items:[]}];await saveReceiptBatch(client,{projectId:project.id,requestId:uuid(),payload:receiptPayload({expenseId:result.expense_id,receipts:append})},append)
  const sum=await checked(client.from('expenses').select('*').eq('id',result.expense_id).single());assert(Number(sum.total_amount)===350.30,'Append precision wrong');passed.push('append_existing_item_exact_cents')
  const reloaded=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{...options,global:{headers:{Authorization:`Bearer ${owner.session!.access_token}`}}});const again=await checked(reloaded.from('attachments').select('*').eq('project_id',project.id));assert(again.length===3,'Reload lost attachments');const signed=await checked(reloaded.storage.from('finance-attachments').createSignedUrl(again[0].storage_path,60));assert((await fetch(signed.signedUrl)).ok,'Preview failed');passed.push('reload_and_signed_download')
  const outside=await other.client.rpc('finance_receipts_write',{p_project:project.id,p_request:uuid(),p_payload:context.payload});assert(!!outside.error,'Outsider write allowed');const denied=await other.client.storage.from('finance-attachments').createSignedUrl(again[0].storage_path,60);assert(!!denied.error,'Outsider read allowed');passed.push('project_isolation')
  await removePaymentAttachment(client,again[0]);assert((await checked(client.from('payments').select('id').eq('id',again[0].payment_id))).length===1,'Proof removal deleted payment');passed.push('delete_proof_keeps_payment')
  const evidence=[item('expense-one.png'),item('expense-two.png')];await saveExpenseProofs(client,{projectId:project.id,expenseId:result.expense_id},evidence);for(const file of evidence)paths.push(project.id+'/'+result.expense_id+'/'+file.id+'.png');const expenseFiles=await checked(client.from('attachments').select('*').eq('expense_id',result.expense_id));assert(expenseFiles.length===2&&expenseFiles.every((x:any)=>!x.payment_id&&!x.income_id),'Expense multi-image evidence wrong');const evidenceAgain=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{...options,global:{headers:{Authorization:`Bearer ${owner.session!.access_token}`}}});assert((await checked(evidenceAgain.from('attachments').select('id').eq('expense_id',result.expense_id))).length===2,'Reload lost expense evidence');passed.push('multiple_expense_evidence_persists_on_reload')
  return Response.json({success:true,passed})
 }catch(error){return Response.json({success:false,passed,error:(error as Error).message||String(error)},{status:500})}
 finally{
  // Paths are fixture-generated; never enumerate or remove real project files.
  if(paths.length)await admin.storage.from('finance-attachments').remove(paths)
  for(const id of userIds)await admin.auth.admin.deleteUser(id)
 }
})
