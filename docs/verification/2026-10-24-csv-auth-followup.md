# CSV／Auth 補驗 — 2026-10-24

沿用現有 CSV `finance_write` 批次 RPC 及 SHA-256 request key；沒有改資料庫或匯入原有帳本。

## 修正與測試

- 嚴格處理 CSV 引號，拒絕未封口、欄位中間未跳脫引號及封口後多餘文字。
- 拒絕重複／空白欄名、欄數不符、超過 1,000 筆、沒有資料、無效日期／到期日、已付超過總額。
- 金額只接受最多兩位小數，保留分；支援 HK$／HKD／$ 及正確千位分組，拒絕科學記號、不正確千位分組及過大數字。
- 支援 BOM、CRLF、引號內逗號／換行／雙引號。
- 選檔讀取採版本保護；提交時同步鎖定、禁止換檔；讀取中不可提交。讀取錯誤有提示，檔案上限 5MB。
- 重設檔案 input 值，讓同一檔案可再選。自動化需等待完成後 reload 解除 busy 才能選下一檔；較早的 timeout 是測試在 busy 時強行 setInputFiles，已修正等待條件。

新增六個 Node 測試，原邏輯有四組失敗，修正後全通過。全套 **39 通過、0 略過**，build 通過。

真實 UI／正式 Supabase（合成帳號）：五類錯誤檔案不能提交、DB 零新增；有效兩筆 CSV（含 quoted newline、中文、千位及小數）兩次提交仍只有兩筆支出、一筆付款 $20.50，總額 $1,200.50 不變。只測專用合成帳本。

獨立 code review 無 Critical／Important；Minor 保留：錯誤的「行」編號是邏輯紀錄位置，含空行或 multiline quoted field 時不是檔案實體行號。

## Auth 畫面補驗

`tests/browser/auth-flows.cjs` 攔截所有 email POST，沒有寄測試信：註冊後待驗證畫面、60 秒重寄冷卻、重寄成功提示、過期 recovery 不開新密碼表格、SMTP 錯誤不顯示成功，均通過。此測試不代表 SMTP 真實投遞或確認連結已通過。

Google provider 仍未啟用。現有工具沒有 SMTP／Google OAuth 管理設定能力；需使用者在平台設定 OAuth client／SMTP 後，再以可收信地址及真實 Google 帳戶驗證。沒有要求在對話提交密碼或 secret。

真 iPhone Safari、實體相機／HEIC、商店上架、訂閱／收費會員及廣告仍是上次列出的未完成項目。

## 發佈及清理

功能 release `b69be19` 已推送 main，GitHub Vercel status=success；正式程式 `/assets/index-C9xslW4T.js` 與本機 build 一致。正式站重跑真實 CSV 匯入／防重複及攔截 email POST 的 Auth UI 測試均通過。附件重試回歸兩組仍通過。

專用 CSV 測試帳號及全部測試帳本已經由原有 delete-account 清理，cleanup_pending=false；原有 3 用戶、23 支出、25 付款、4 附件、4 Storage 檔案維持，測試用戶為零。
