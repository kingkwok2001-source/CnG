import {saveLinkedProofs} from './payment-files.js'
export const saveExpenseProofs=(client,context,items,onProgress)=>saveLinkedProofs(client,context,items,onProgress,'expense')
