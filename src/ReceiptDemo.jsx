import React,{useState} from 'react'
import ReceiptBatch from './ReceiptBatch'
import {PaymentHistory} from './PaymentProofs'
import {createPaymentDemoClient} from './payment-demo-client'
const project={id:'proof-demo',currency:'HKD'}
const money=n=>new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'}).format(n)
export default function ReceiptDemo(){
 const[client]=useState(()=>createPaymentDemoClient({empty:true})),[data,setData]=useState(()=>client.snapshot()),[editing,setEditing]=useState(true),[generation,setGeneration]=useState(0)
 async function refresh(){setData(client.snapshot())}
 async function done(){await refresh();setEditing(false)}
 return <main className="receipt-demo"><a href="/">返回正式 App</a><p className="notice">操作示範：只暫存喺此頁，重新載入會清除，唔會改動真實帳本。</p>{editing?<ReceiptBatch key={generation} p={project} expenses={data.expenses} client={client} done={done}/>:<><h2>購買單已合併</h2>{data.expenses.map(expense=><section className="receipt-demo-result" key={expense.id}><h3>{expense.title}</h3><dl><div><dt>項目總額</dt><dd>{money(expense.total_amount)}</dd></div><div><dt>購買單</dt><dd>{data.payments.filter(p=>p.expense_id===expense.id).length} 張</dd></div></dl><PaymentHistory payments={data.payments.filter(p=>p.expense_id===expense.id)} files={data.files} project={project} expenseId={expense.id} client={client} reload={refresh}/></section>)}<button className="primary full" onClick={()=>{setGeneration(x=>x+1);setEditing(true)}}>再加入購買單</button></>}</main>
}
