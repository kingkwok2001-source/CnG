import {saveExpenseProofs} from './expense-files.js'
export async function saveMoneyEntry(client,context,args,items,onProgress){
 context.args??=args
 const operation=context.args.p_kind
 if(!context.result){
  const{data,error}=await client.rpc('finance_money_write',context.args)
  if(error)throw error
  if(operation==='expense'&&!data?.expense_id||operation==='dismiss'&&data?.dismissed!==true||operation==='transfer'&&!data?.transfer_id)throw new Error('儲存回應未完成，請用同一表格重試')
  if(operation==='expense')context.expenseId=data.expense_id
  context.result=data
 }
 if(context.expenseId)await saveExpenseProofs(client,context,items,onProgress)
 return context.result
}
