// Run with a Playwright installation available and the app served at TEST_URL.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const [demo,field] of [['evidence','例如：回禮用品'],['payments',null],['receipts',null],['1',null]]){
const p=await b.newPage();await p.goto(`${process.env.TEST_URL||'http://localhost:5173'}/?demo=${demo}`);if(demo==='1')await p.getByRole('button',{name:'快速記一筆',exact:true}).click();await p.locator('form').waitFor();
const blocked=()=>p.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented});
assert.equal(await blocked(),false,`${demo}: pristine`);
if(field)await p.getByPlaceholder(field).fill('unsaved');else await p.locator('form input:not([type=file])').first().fill(demo==='payments'?'120':'unsaved');
assert.equal(await blocked(),true,`${demo}: dirty text must protect browser navigation`);
await p.close();console.log('PASS',demo,'leave guard');}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
