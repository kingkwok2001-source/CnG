# Project Finance 功能盤點 — 2026-10-24

「已有」指程式功能已存在；沒有端到端證據的部分另外標示，不能等同本次全面驗收。

| 要求 | 真實狀態 | 本次證據／尚欠 |
|---|---|---|
| 註冊、確認電郵、重寄、忘記密碼 | 部分確認 | UI、驗證／重寄／recovery 處理及 Node 測試存在；Auth 設定允許 email signup、要求確認。未驗證外部信箱實際收信、連結全流程及 SMTP 配額／投遞 |
| Google 登入 | **未啟用** | 正式 Auth settings external.google=false，按鈕按設定隱藏。欠 Google OAuth client、provider 啟用、redirect/consent 設定及真實 Google 登入驗證 |
| 電郵／密碼登入、登出 | 已有，實測通過 | 專用帳號正式網站登入、登出、再登入 |
| 刪除帳號 | 已有，實測通過 | 專用帳號錯密碼拒絕、正確密碼刪除，帳本權限撤銷及原憑證登入失敗。Google-only 帳號未測；目前要求密碼 |
| 跨裝置同步 | 已有，實測通過相應範圍 | 真正重新載入、重新登入及新瀏覽器 context 讀回附件；沒有宣稱兩部實體手機均已測 |
| 邀請碼共同管理 | 已有，實測通過 | 實際邀請加入可讀附件，移除成員後即讀不到；RLS 隔離通過 |
| 手機／桌面響應式 | 已有，Chromium 通過 | 390px／1440px UI 流程；現有 desktop sidebar、mobile navigation CSS。實體 iPhone／Android 裝置未測 |
| 首頁、分析圖表及返回 | 已有，實測通過 | 正式首頁／帳本／帳目返回；正式分析圖表、分類 drill-down，關閉明細後仍留在分析頁 |
| 自訂頭像／帳本 Logo | 已有，實測通過基本流程 | 合成帳號頭像上載及重載、帳本 Logo 上載通過；超大圖片及真機相簿仍待補驗 |
| 一鍵 PDF 總覽 | 已有，實測通過桌面列印輸出 | 正式網站一鍵開啟總覽、產生 A4 PDF 成功；使用瀏覽器列印／另存 PDF，並非 server 直接產生下載。收入開關與計算 Node 測試通過；真 iOS 列印未測 |
| CSV 範本、匯入、匯出 | 已有，部分驗收 | 正式網站下載 CSV 範本、匯出合成帳本並檢查內容通過；設定有預覽／匯入及兩類匯出，finance_write CSV 批次及 request key 防重複。本次未重新匯入資料，匯入／Excel／Numbers 邊界未全面測 |
| 首次圖像教學／重新觀看 | 已有，實測通過 | 正式登入首次顯示七步圖像教學，逐步完成後可在設定重新開啟 |
| Free／會員 | Free 功能可用；收費會員未做 | UI 明示現有功能全部免費；Free badge／profile 是預留產品呈現，不代表已有 Pro entitlement。沒有接付款、會員升降級、收據／退款或付費權限驗證 |
| iOS／Android 上架 | **未做** | 現有是可安裝 PWA，不等於 App Store／Google Play 上架。欠原生封裝／專案、developer 帳號、簽署、裝置測試、商店資料／私隱聲明、提交審核 |
| 訂閱 | **未做** | 欠商店內購／付款產品、驗證與 webhook、權限同步、restore purchases、取消／退款／測試環境驗收 |
| 廣告 | **未做** | 欠廣告平台／SDK、版位、consent／ATT（適用時）、私隱披露與真機測試 |

優先待辦：真 iPhone Safari 相簿／拍照／HEIC／PDF；電郵完整投遞驗證及 Google 啟用；頭像／Logo 真機、CSV 匯入邊界及真機 PDF 補驗。會員、商店、訂閱與廣告屬未交付功能，不能當作已完成。
