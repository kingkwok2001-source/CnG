// In-memory demonstration client: deliberately contains no Auth or network API.
import {parseTransaction} from './transaction-parser'
const data={finance_wallet_balances:[{id:'bank',name:'銀行',opening_balance:1000,balance:500},{id:'octopus',name:'八達通',opening_balance:0,balance:372}],finance_wallet_entries:[{id:'e1',wallet_id:'octopus',amount:-128,title:'餐廳',entry_date:'2026-10-11'}],finance_drafts:[{id:'draft',title:'餐廳',amount:128,method:'PayMe',transaction_date:'2026-10-11',source:'screenshot',raw_text:'收款人：餐廳\nHK$128.00\n2026-10-11\nPayMe'}]}
export const demoClient={
 from(table){let inserted;const q={select(){return q},eq(){return q},order(){return q},limit(){return q},insert(row){inserted=row;return q},then(resolve){if(inserted){if(table==='finance_wallets')data.finance_wallet_balances.push({...inserted,balance:inserted.opening_balance});else{data[table]??=[];data[table].push(inserted)}}return Promise.resolve({data:data[table]||[],error:null}).then(resolve)}};return q},
 channel(){const ch={on(){return ch},subscribe(){return ch}};return ch},removeChannel(){},
 async rpc(name,args){
  if(name==='finance_shortcut_key')return{data:args.p_revoke?null:'示範金鑰，無法接駁真實帳本',error:null}
  const p=args.p_payload,source=data.finance_wallet_balances.find(w=>w.id===p.wallet_id),dest=data.finance_wallet_balances.find(w=>w.id===p.destination_id)
  if(source&&source.balance<p.amount)return{error:{message:'錢包餘額不足'}}
  if(p.draft_id)data.finance_drafts=data.finance_drafts.filter(d=>d.id!==p.draft_id)
  if(args.p_kind!=='dismiss'){
   if(source){source.balance-=p.amount;data.finance_wallet_entries.unshift({id:crypto.randomUUID(),wallet_id:source.id,amount:-p.amount,title:p.title||'轉出',entry_date:p.date})}
   if(dest){dest.balance+=p.amount;data.finance_wallet_entries.unshift({id:crypto.randomUUID(),wallet_id:dest.id,amount:p.amount,title:'轉入／增值',entry_date:p.date,transfer_id:'demo'})}
  }
  return{data:{success:true},error:null}
 }
}
