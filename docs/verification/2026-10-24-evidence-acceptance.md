# Project Finance 接手驗證 — 2026-10-24

正式網址：https://cng-finance.vercel.app/

基準：main `8776703`，功能提交 `d1f76f8`。本次重用原有 attachments、RPC、上載及展示組件，沒有重設、重新匯入或改寫原有財務資料，沒有重開臨時驗證 Edge Function，也沒有修改資料庫結構／權限。

## 本次修正

- 四種表格共用離開保護：新增／修改支出、付款、購買單、快捷入帳。文字／金額變更及未上載附件均會提示，準備／上載期間阻止關閉；瀏覽器重新載入註冊 beforeunload。
- 移除「完成後永久略過保護」的狀態，避免儲存成功但重新整理失敗後，新追加的附件失去保護。
- 付款首次提交後凍結金額／日期／方式／備註，即使提交回應遺失，也保留原請求供安全重試。
- 支出詳情加入附件數量；付款紀錄沿用最多三個縮圖及 +N。

## 驗收矩陣

「示範 UI」使用真正表格／選檔／預覽組件和獨立記憶體 client；「實際服務」使用獨立合成帳號及帳本，連接正式 Supabase／Storage，沒有使用原有帳戶。

| # | 項目 | 結果及證據 |
|---|---|---|
| 1 | 無附件入帳 | 通過：390px／1440px 示範 UI；實際 finance_write 建立支出，零附件 |
| 2 | 一張圖片 | 通過：兩種寬度 UI 選檔、儲存、重新預覽；實際 PNG 上載／簽名下載 |
| 3 | 多張圖片 | 通過：同一 $350 項目三個證明，仍只有一項；實際服務重讀 |
| 4 | 圖片混合 PDF | 通過：UI 和實際 Storage；正式登入 UI 新增三檔、修改追加一檔。可重跑測試使用含 xref 的有效單頁 PDF |
| 5 | 提交前預覽、移除、追加 | 通過：390px／1440px 實際 input.setInputFiles，圖片全螢幕、移除第二張、追加後保持三檔；下載連結存在 |
| 6 | 儲存後查閱 | 通過：正式網站登入讀取真實附件、縮圖、簽名圖片全螢幕；本機新版 UI 連正式服務新增／修改 |
| 7 | 重載、重新登入／換瀏覽器 | 通過：實際 API fresh client；登入 UI reload、登出再登入、全新桌面瀏覽器 context 均有四檔 |
| 8 | 付款紀錄及詳情 | 通過：五檔展示三縮圖 +2；真實付款上載兩檔、進入詳情 |
| 9 | 刪附件保留付款 | 通過：真實 API／UI 刪圖後 $80 付款仍在；Storage 已移除檔案 |
| 10 | 刪付款清理附件 | 通過：真實 API／UI，attachment cascade 及 Storage 刪除；DB cleanup queue、trigger、每十分鐘 cron 已核對 |
| 11 | 失敗重試不重複入帳 | 通過：實際服務模擬成功付款／上載／insert 回應遺失，部分成功後重試仍一筆付款、兩證明；瀏覽器回歸另驗 callback 失敗後追加及忙碌保護、未知付款結果時鎖定欄位 |
| 12 | 跨帳本／帳號權限隔離 | 通過：實際 outsider 讀取 DB 為空、Storage 拒絕；跨帳本 FK 及多 parent constraint 拒絕。邀請加入可讀證明，移除成員即不可讀 |
| 13 | 真實 iPhone Safari 選相／拍照／預覽 | **未驗收**：本環境只有 Chromium；390px 響應式及 capture=environment 不能代替真機、iOS 相簿／相機／HEIC 驗證 |

多張購買單：真實服務和 UI 驗證 $120+$80+$150 為一個 $350 項目、三筆已付款、每單獨立商戶／日期／方式／附件。真實後補 $0.30 同時增加 total 和 paid，重試不重複。介面已清楚說明此為增加已付清購買，支付原有尚欠使用「新增付款」。

beforeunload 是瀏覽器提供的提示，iOS 強制關閉 App／系統終止程序不保證觸發；未宣稱支援未提交附件跨程序恢復。

## 測試與重跑

- Node：**33 通過、0 略過**；原先略過的 composite-FK Data API 測試今次提供 publishable key 後亦通過。
- 初次 Node 直接連線因本環境需要 proxy 而失敗，使用 `NODE_USE_ENV_PROXY=1` 後全套通過；不是 App 修正。
- `npm run build`、`git diff --check` 通過。
- `tests/browser/evidence-flows.cjs`：390／1440 兩種寬度，每種七組流程，共十四組。
- `tests/browser/leave-guard.cjs`：四種表格的 pristine／dirty navigation。
- `tests/browser/payment-recovery.cjs`：兩個獨立審查發現，均觀察修正前失敗／修正後通過。此 harness 需要 Vite dev server。
- `tests/browser/authenticated-evidence.cjs`：真實登入 UI、建立／修改／付款／刪除／重載／重新登入／新 context。
- `tests/integration/live-evidence.mjs`：真實 API／Storage、回應遺失、RLS 及合併購買。
- `tests/integration/cleanup-evidence.mjs`：只接受明確配置的 `finance-acceptance-...@example.invalid` 合成用戶；錯誤密碼不刪除，正確密碼刪除帳號、帳本、附件，舊 JWT 無權讀取，刪除後不能登入。

Playwright 由執行環境提供，repo 沒有新增產品依賴；執行環境可用 `CHROMIUM_PATH`，UI 目標可用 `TEST_URL`。真實測試需私有 `FINANCE_TEST_CREDENTIALS` JSON（url、publishable key、password、users 的 id/email），及可選的 `FINANCE_TEST_ARTIFACT_DIR`。請先建立專用合成用戶，測試完成後執行 cleanup；不要使用原有用戶。憑證、token、瀏覽器狀態不提交。

## 部署／清理記錄

新版部署及部署後重跑結果會在完成後補記。測試帳號 B 已透過現有 delete-account 實際刪除，cleanup_pending=false；帳號 A 保留至部署後驗證完成才清理。
