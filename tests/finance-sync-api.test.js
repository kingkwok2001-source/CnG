import test from 'node:test'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {expenseSelect} from '../src/finance-sync.js'

// Read-only Data API regression. An anonymous client validates relationship
// resolution without bypassing RLS or accessing anyone's financial records.
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
test('expense sync resolves the actual composite category/payment relationships',{skip:!url||!key},async()=>{
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const previous=await client.from('expenses').select('*,categories(name),payments(*)').limit(1)
 assert.equal(previous.error?.code,'PGRST201','fixture must reproduce the multiple-FK regression')
 const current=await client.from('expenses').select(expenseSelect).is('deleted_at',null).order('created_at',{ascending:false}).limit(1)
 assert.equal(current.error,null,current.error?.message)
 assert.equal(current.status,200)
 assert.deepEqual(current.data,[],'RLS must continue hiding account data from anonymous clients')
})
