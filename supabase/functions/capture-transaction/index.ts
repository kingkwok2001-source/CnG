import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4"
import {capturePayload} from './payload.js'
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://cng-finance.vercel.app","Access-Control-Allow-Headers":"authorization,content-type,apikey","Access-Control-Allow-Methods":"POST,OPTIONS"}
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers})
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers})
 if(req.method!=='POST')return reply(405,{error:'POST required'})
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||''
 if(!/^[a-f0-9]{64}$/.test(token))return reply(401,{error:'Invalid shortcut key'})
 try{
  const raw=await req.text();if(raw.length>4000)return reply(413,{error:'Payload too large'})
  let payload
  try{payload=capturePayload(JSON.parse(raw))}catch(e){return reply(400,{error:e instanceof Error?e.message:'Invalid JSON'})}
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const{data,error}=await admin.rpc('finance_shortcut_ingest',{p_token:token,p_payload:payload})
  if(error)return reply(/Invalid shortcut key/.test(error.message)?401:/Daily limit/.test(error.message)?429:400,{error:'未能加入，請檢查金鑰、金額、日期及每日限額'})
  return reply(201,{success:true,draft_id:data,message:'已加入待確認交易，尚未入帳'})
 }catch{return reply(400,{error:'Invalid JSON'})}
})
