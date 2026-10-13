export const authRedirect='https://cng-finance.vercel.app/'
export const emailValid=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
export function authLinkState(location){
 const query=new URLSearchParams(location.search||''),hash=new URLSearchParams((location.hash||'').replace(/^#/,''))
 const code=hash.get('error_code')||query.get('error_code'),error=code||hash.get('error')||query.get('error')
 const recovery=(hash.get('type')||query.get('type'))==='recovery'
 if(error)return {recovery:false,error:true,mode:recovery?'forgot':'verify',notice:code==='otp_expired'?'電郵連結已過期或已使用。請輸入電郵，再寄一封新連結。':'未能完成電郵驗證／登入。請重新要求連結，並開啟最新嗰封。'}
 return {recovery,error:false,mode:'login',notice:''}
}
export function authErrorMessage(error){
 const code=error?.code||'',message=error?.message||''
 if(code==='invalid_credentials'||/invalid login credentials/i.test(message))return '電郵或密碼唔正確。唔記得密碼可按「忘記密碼」。'
 if(code==='email_not_confirmed'||/email not confirmed/i.test(message))return '帳戶尚未驗證。請檢查電郵，或按「重新寄驗證電郵」。'
 if(code==='email_exists'||/already registered|already exists/i.test(message))return '呢個電郵已經有帳戶，請直接登入或重設密碼。'
 if(code==='over_email_send_rate_limit')return '寄信次數已達伺服器上限，請稍後再試。重複按掣唔會加快寄信。'
 if(/rate limit|too many/i.test(message)||code==='over_request_rate_limit')return '操作太頻密，請稍後再試。'
 if(code==='email_address_not_authorized')return '寄信服務尚未允許呢個收件地址。需要管理員完成 SMTP 設定，換電郵 App 無法解決。'
 if(code==='unexpected_failure'||/error sending.*email/i.test(message))return '寄信服務出錯，未能確認已寄出。請稍後再試；如持續失敗，需檢查 SMTP。'
 if(code==='otp_expired')return '電郵連結已過期或已使用。請重新寄送，並開啟最新嗰封。'
 if(/load failed|failed to fetch|network|fetch failed/i.test(message))return '暫時連唔到登入伺服器。請檢查網絡後再試；若剛提交登記，可先檢查電郵。'
 if(code==='weak_password')return '密碼未符合要求，請使用更長嘅密碼，包含英文及數字。'
 return '未能完成操作'+(code?'（'+code+'）':'')+'，請稍後再試。'
}
