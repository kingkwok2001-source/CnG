import React,{useState} from 'react'
import ExpenseComposer from './ExpenseComposer'
import {ProofThumb,ProofViewer} from './PaymentProofs'
import {createPaymentDemoClient} from './payment-demo-client'
const project={id:'proof-demo',currency:'HKD'}
export default function ExpenseDemo(){
 const[client]=useState(()=>createPaymentDemoClient({empty:true})),[data,setData]=useState(null),[viewer,setViewer]=useState(null)
 return <main className="receipt-demo"><a href="/">返回正式 App</a><p className="notice">入帳操作示範：重新載入會清除，唔會改動真實帳本。</p>{!data?<ExpenseComposer p={project} cats={[]} client={client} done={()=>setData(client.snapshot())}/>:<><h2>支出已儲存</h2>{data.expenses.map(e=><section className="receipt-demo-result" key={e.id}><h3>{e.title}</h3><strong>HK${e.total_amount}</strong><h4>入帳證明 · {data.files.filter(f=>f.expense_id===e.id).length} 個</h4><div className="history-proofs">{data.files.filter(f=>f.expense_id===e.id).map(file=><ProofThumb key={file.id} file={file} client={client} open={()=>setViewer(file)}/>)}</div></section>)}</>}{viewer&&<ProofViewer file={viewer} client={client} close={()=>setViewer(null)}/>}</main>
}
