import {useContext,useEffect,useRef} from 'react'
import {SheetCloseContext} from './SheetCloseContext'

// Keep browser navigation and sheet transitions on the same current state.
export function useFormLeaveGuard({values,busy,pending=false,committed=false,message}){
 const guard=useContext(SheetCloseContext),initial=useRef(JSON.stringify(values)),current=useRef(null)
 current.current={busy,dirty:!committed&&JSON.stringify(values)!==initial.current,pending,message}
 useEffect(()=>{
  const needsWarning=()=>(current.current.busy||current.current.dirty||current.current.pending)
  const check=()=>(!current.current.busy&&(!needsWarning()||window.confirm(current.current.message||'表格有未儲存資料，確定離開？')))
  const unload=event=>{if(needsWarning()){event.preventDefault();event.returnValue=''}}
  if(guard)guard.current=check
  window.addEventListener('beforeunload',unload)
  return()=>{if(guard?.current===check)guard.current=null;window.removeEventListener('beforeunload',unload)}
 },[guard])
}
