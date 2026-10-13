import test from 'node:test'
import assert from 'node:assert/strict'
import {authLinkState,authErrorMessage,emailValid} from '../src/auth-state.js'
test('failed or expired recovery links never open password change',()=>{
 const failed=authLinkState({hash:'#type=recovery&error=access_denied&error_code=otp_expired'})
 assert.equal(failed.recovery,false);assert.equal(failed.mode,'forgot');assert.match(failed.notice,/過期/)
 assert.equal(authLinkState({hash:'#type=recovery&access_token=fixture'}).recovery,true)
})
test('auth notices distinguish provider delivery failure from user credentials',()=>{
 assert.match(authErrorMessage({code:'email_address_not_authorized'}),/SMTP/)
 assert.match(authErrorMessage({code:'over_email_send_rate_limit'}),/伺服器上限/)
 assert.match(authErrorMessage({code:'invalid_credentials'}),/電郵或密碼/)
 assert.equal(authLinkState({search:'?error=access_denied&error_description=private-data'}).notice.includes('private-data'),false)
})
test('malformed email addresses are rejected before any sending request',()=>{
 for(const value of ['a@','abc','a b@gmail.com','a@b'])assert.equal(emailValid(value),false)
 assert.equal(emailValid('Suetyinghon17@gmail.com'),true)
})
