# Finance 網頁版：Graphify 本機導航

2026-10-28：使用者決定只做網頁版；原生 iOS／Android 封裝、商店上架、商店訂閱及原生廣告不再是完成網頁版的待辦。保留響應式手機網頁及現有 PWA 安裝功能。真 iPhone Safari、Google 登入、SMTP 真實收信仍是網頁版的相關驗收；付費方案沒有因這次決定而新增。

## 安裝及使用

來源：https://github.com/Graphify-Labs/graphify （v8）。注意 npm 的 `graphify` 是另一個隨機圖工具；這裡使用 Python 套件 `graphifyy`。

```sh
python -m venv /workspace/graphify-venv
/workspace/graphify-venv/bin/pip install -r tools/graphify-requirements.txt
GRAPHIFY_BIN=/workspace/graphify-venv/bin/graphify bash tools/finance-graph.sh build
GRAPHIFY_BIN=/workspace/graphify-venv/bin/graphify bash tools/finance-graph.sh explain savePaymentProofs
GRAPHIFY_BIN=/workspace/graphify-venv/bin/graphify bash tools/finance-graph.sh affected saveLinkedProofs --depth 3
```

本次只裝在 Finance 目前的雲端開發環境，沒有安裝到使用者個人電腦。版本固定 0.9.97，與網站的 npm runtime 依賴分開。指令關閉 LLM backend、只讀程式碼；不連正式資料庫、不讀帳目／Storage 附件、不建立外部雲端圖譜。`graphify-out/` 已 gitignore，不部署到 Vercel。

## 已執行查詢與用途

初次含 SQL 圖譜：441 節點、957 邊、22 communities。`graphify-out/graph.html` 是本機互動圖，`graph.json` 是可查詢圖。

- `explain savePaymentProofs`：找到 PaymentComposer、saveReceiptBatch、saveLinkedProofs 及付款測試。
- `affected saveLinkedProofs --depth 3`：反查到 ExpenseComposer、PaymentComposer、saveMoneyEntry、ReceiptBatch、MoneyTools，以及 payment-files／expense-proofs／money-entry 等測試。
- 改共用附件上載前先查 affected，讀原碼及 RPC／SQL，再跑相關測試及全套驗證。圖譜不能代替測試或正式權限驗證。

工具對 `src/main.jsx`、`src/MoneyTools.jsx` 有 JSX 部分提取警告；這不是已證明的 App syntax error（Vite build 另行驗證），也代表圖譜不是完整 call graph。沒有從圖推斷「未列出即不受影響」。部分測試、純資料檔也可能沒有 symbols；CSS、Auth dashboard 與 Storage 實際政策不是此圖的完整覆蓋範圍。沒有量度或宣稱節省 token 百分比。

## 本機 MCP

```sh
GRAPHIFY_BACKEND=none GRAPHIFY_QUERY_LOG_DISABLE=1 \
/workspace/graphify-venv/bin/graphify-mcp --graph /workspace/CnG/graphify-out/graph.json
```

這是 stdio server，需由 MCP client 啟動；不對外開 port。CLI 安裝不等於 ChatGPT 連接器已註冊，本次使用 Python MCP client 做握手、工具列表及 query_graph 測試。
