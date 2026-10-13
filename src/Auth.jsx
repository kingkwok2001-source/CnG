import React,{useEffect,useRef,useState} from 'react'
import {Eye,EyeOff} from 'lucide-react'
import {supabase} from './supabase'
import {authRedirect,authErrorMessage,emailValid} from './auth-state'
import './auth-improvements.css'

export default function Auth({initialMode='login',initialNotice='',onReset}){
 const [mode,setMode]=useState(initialMode),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[visible,setVisible]=useState(false),[msg,setMsg]=useState(initialNotice),[tone,setTone]=useState(initialNotice?'error':''),[busy,setBusy]=useState(false),[canResend,setCanResend]=useState(false),[google,setGoogle]=useState(false),[deadline,setDeadline]=useState(0),[clock,setClock]=useState(Date.now())
 const running=useRef(false),cooldown=Math.max(0,Math.ceil((deadline-clock)/1000)),cooldownKey='finance-auth-email:'+email.toLowerCase()
 useEffect(()=>{let active=true;const controller=new AbortController();fetch(import.meta.env.VITE_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:controller.signal}).then(r=>r.ok?r.json():null).then(s=>{if(active)setGoogle(s?.external?.google===true)}).catch(()=>{});return()=>{active=false;controller.abort()}},[])
 useEffect(()=>{try{setDeadline(Number(sessionStorage.getItem(cooldownKey))||0)}catch{setDeadline(0)}setClock(Date.now())},[cooldownKey])
 useEffect(()=>{if(deadline<=Date.now())return;const timer=setInterval(()=>{const now=Date.now();setClock(now);if(now>=deadline)clearInterval(timer)},1000);return()=>clearInterval(timer)},[deadline])
 function startCooldown(){const next=Date.now()+60000;setClock(Date.now());setDeadline(next);try{sessionStorage.setItem(cooldownKey,String(next))}catch{}}
 function switchMode(next){if(running.current)return;setMode(next);setMsg('');setTone('');setPassword('');setConfirmation('');setVisible(false);setCanResend(false)}
 async function action(task,{sendsEmail=false}={}){
  if(running.current)return;if(sendsEmail&&cooldown>0)return
  running.current=true;setBusy(true);setTone('');setMsg('處理中…')
  try{await task();if(sendsEmail)startCooldown()}
  catch(error){setTone('error');setMsg(authErrorMessage(error));if(error?.code==='email_not_confirmed')setCanResend(true);if(error?.status===429||/rate_limit/.test(error?.code||''))startCooldown()}
  finally{running.current=false;setBusy(false)}
 }
 function requireEmail(){if(emailValid(email))return true;setTone('error');setMsg('請輸入完整電郵地址，例如 name@gmail.com');return false}
 async function submit(event){
  event.preventDefault();if(running.current)return
  if(mode!=='reset'&&!requireEmail())return
  if(mode==='forgot')return action(async()=>{const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authRedirect});if(error)throw error;setTone('success');setMsg('已提交重設要求。如呢個電郵已註冊，請開啟最新嘅重設電郵。')},{sendsEmail:true})
  if(mode==='verify')return resend()
  if(password.length<6){setTone('error');setMsg('密碼最少要 6 位');return}
  if((mode==='signup'||mode==='reset')&&password!==confirmation){setTone('error');setMsg('兩次輸入嘅密碼唔一致');return}
  if(mode==='reset')return action(async()=>{const{error}=await supabase.auth.updateUser({password});if(error)throw error;history.replaceState(null,'',location.pathname);setTone('success');setMsg('密碼已更新');onReset?.()})
  const signup=mode==='signup'
  return action(async()=>{const{data,error}=await (signup?supabase.auth.signUp({email,password,options:{emailRedirectTo:authRedirect}}):supabase.auth.signInWithPassword({email,password}));if(error)throw error;setTone('success');setCanResend(false);if(signup&&!data.session){setMode('verify');setPassword('');setConfirmation('')}setMsg(signup?(data.session?'帳號已建立，正在登入。':'已提交登記要求，請到電郵完成驗證。如已登記過，可直接登入或重設密碼。'):'登入成功')},{sendsEmail:signup})
 }
 async function resend(){if(!requireEmail())return;await action(async()=>{const{error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:authRedirect}});if(error)throw error;setTone('success');setMsg('已提交重寄要求。請檢查收件匣及垃圾郵件，並開啟最新嗰封確認信。')},{sendsEmail:true})}
 const titles={login:'歡迎回來',signup:'建立帳號',forgot:'忘記密碼',reset:'設定新密碼',verify:'驗證電郵'},subtitles={login:'登入後繼續管理你嘅帳本',signup:'建立後請到電郵完成驗證',forgot:'輸入註冊電郵，再開啟最新嘅重設連結',reset:'設定後會返回你嘅帳本',verify:'輸入登記電郵，再寄一封確認信'},labels={login:'登入',signup:'建立帳號',forgot:'寄出重設電郵',reset:'更新密碼',verify:'重新寄驗證電郵'},sending=mode==='signup'||mode==='forgot'||mode==='verify'
 return <main className="auth"><div className="brand"><div className="mark">PF</div><small>YOUR MONEY, MADE CLEAR</small><h1>每一筆，都清楚掌握。</h1><p>總額、已付、尚欠，一眼睇晒。</p></div><div className="auth-form"><div className="auth-heading"><div><h2>{titles[mode]}</h2><p>{subtitles[mode]}</p></div>{(mode==='forgot'||mode==='reset'||mode==='verify')&&<button className="auth-back" disabled={busy} onClick={()=>{if(mode==='reset'){history.replaceState(null,'',location.pathname);onReset?.()}switchMode('login')}}>返回登入</button>}</div>{(mode==='login'||mode==='signup')&&<div className="auth-tabs" role="tablist">{[['login','登入'],['signup','建立帳號']].map(([value,label])=><button key={value} role="tab" aria-selected={mode===value} disabled={busy} className={mode===value?'on':''} onClick={()=>switchMode(value)}>{label}</button>)}</div>}
  <form className="form" noValidate onSubmit={submit}>{mode!=='reset'&&<label>電郵<input type="email" disabled={busy} value={email} onChange={e=>setEmail(e.target.value.trim())} inputMode="email" autoComplete="email" placeholder="name@gmail.com"/></label>}{mode!=='forgot'&&mode!=='verify'&&<label>{mode==='reset'?'新密碼':'密碼'}<div className="auth-password"><input disabled={busy} type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="最少 6 位"/><button type="button" aria-label={visible?'隱藏密碼':'顯示密碼'} aria-pressed={visible} onClick={()=>setVisible(x=>!x)}>{visible?<EyeOff/>:<Eye/>}</button></div></label>}{(mode==='signup'||mode==='reset')&&<label>再次輸入密碼<input disabled={busy} type={visible?'text':'password'} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password" placeholder="再次輸入密碼"/></label>}{mode==='login'&&<button type="button" className="forgot-link" disabled={busy} onClick={()=>switchMode('forgot')}>唔記得密碼？</button>}<button type="submit" className="primary" disabled={busy||(sending&&cooldown>0)}>{busy?'處理中…':sending&&cooldown>0?`${cooldown} 秒後可再寄`:labels[mode]}</button>{canResend&&<button type="button" className="ghost" disabled={busy||cooldown>0} onClick={resend}>{cooldown>0?`${cooldown} 秒後可重寄`:'未收到？重新寄驗證電郵'}</button>}{google&&(mode==='login'||mode==='signup')&&<button type="button" className="ghost auth-google" disabled={busy} onClick={()=>action(async()=>{const{error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:authRedirect}});if(error)throw error})}>使用 Google 登入</button>}{msg&&<div className={`auth-notice ${tone}`} role={tone==='error'?'alert':'status'}>{msg}</div>}
   {(mode==='signup'||mode==='forgot'||mode==='verify'||canResend)&&<div className="auth-email-help"><b>收唔到電郵？</b><ol><li>確認地址有冇打錯，檢查垃圾郵件。</li><li>等倒數完再重寄，開啟最新嗰封。</li><li>如顯示寄信服務出錯，係服務設定問題，唔需要轉用另一個電郵 App。</li></ol>{(mode==='signup'||mode==='verify')&&<button type="button" className="forgot-link" disabled={busy} onClick={()=>switchMode('login')}>已經驗證？返回登入</button>}{mode==='verify'&&<button type="button" className="forgot-link" disabled={busy} onClick={()=>switchMode('forgot')}>需要重設密碼？</button>}</div>}
  </form></div></main>
}
