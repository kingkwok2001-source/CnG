// Composite constraints protect project boundaries. Always name the intended
// relationship: otherwise PostgREST returns PGRST201 when multiple FKs match.
export const expenseSelect='*,categories!expenses_category_project_fk(name),payments!payments_expense_project_fk(*)'
export function syncFailure(error){
 if(error?.code==='PGRST201')return '帳目關聯讀取失敗（PGRST201）。請更新網頁後重試。'
 if(error?.code==='PGRST301'||error?.code==='PGRST303'||error?.status===401)return '登入狀態未能驗證，請重新登入後同步。'
 if(/fetch|network|load failed/i.test(error?.message||''))return '暫時連唔到伺服器，請檢查網絡後重試。'
 return '暫時未能同步'+(error?.code?'（'+error.code+'）':'')+'，畫面保留上次成功讀取嘅資料。'
}
