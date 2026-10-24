// Deletes ONLY the explicitly provisioned @example.invalid acceptance users.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
const cfg=JSON.parse(fs.readFileSync(process.env.FINANCE_TEST_CREDENTIALS,'utf8'))
const indexes=process.env.FINANCE_TEST_CLEANUP_USER?[Number(process.env.FINANCE_TEST_CLEANUP_USER)]:cfg.users.map((_,i)=>i)
for(const i of indexes){const u=cfg.users[i];assert.ok(u.email.startsWith('finance-acceptance-')&&u.email.endsWith('@example.invalid'))
 const c=createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false}}),login=await c.auth.signInWithPassword({email:u.email,password:cfg.password});assert.equal(login.error,null,login.error?.message);assert.equal(login.data.user.id,u.id)
 const denied=await c.functions.invoke('delete-account',{body:{confirm:'刪除',password:'wrong-test-password'}});assert.ok(denied.error,'Incorrect password must not delete account')
 const before=await c.auth.getUser();assert.equal(before.error,null)
 const removed=await c.functions.invoke('delete-account',{body:{confirm:'刪除',password:cfg.password}});assert.equal(removed.error,null,removed.error?.message);assert.equal(removed.data.success,true);console.log('PASS dedicated test user deleted, cleanup_pending='+removed.data.cleanup_pending)
 const inaccessible=await c.from('projects').select('id').eq('owner_id',u.id);assert.equal(inaccessible.error,null);assert.deepEqual(inaccessible.data,[])
 const relogin=await c.auth.signInWithPassword({email:u.email,password:cfg.password});assert.ok(relogin.error,'Deleted user must not log in');console.log('PASS old JWT cannot access owned books; deleted credentials rejected')
}
