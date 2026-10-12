import React from 'react'
import MoneyTools from './MoneyTools'
import {FundingSummary} from './ProjectPlanning'
import {demoClient} from './demo-client'
const p={id:'demo',name:'示範帳本',currency:'HKD',budget:200000,event_date:'2026-11-22',monthly_deposit:30000,monthly_limit:12000}
export default function Demo(){return <main className="finance-shell"><aside className="desktop-sidebar"><h2>Project Finance</h2><p>操作示範</p><a href="/">返回正式 App</a></aside><header><b>Project Finance · 操作示範</b></header><section className="page"><div className="notice">呢度係示範資料，可以放心試按。所有修改只喺此頁面暫存，唔會影響你嘅真實帳本。<a href="/"> 返回正式 App</a></div><MoneyTools p={p} cats={[{id:'food',name:'飲食'}]} client={demoClient} onChanged={async()=>{}}/><FundingSummary p={p} t={{total:128,due:0}}/></section></main>}
