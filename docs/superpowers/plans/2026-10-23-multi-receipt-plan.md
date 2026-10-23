# Multiple purchase receipts in one expense

User intent: purchases from different shops belong to one item. Add several amounts/photos, calculate the total, keep each receipt inside that item, and allow later additions. Continue directly under the user's existing instruction to implement and deploy without repeated questions.

Chosen approach: reuse one expense and one payment per paid purchase receipt, plus existing attachments.payment_id. All receipts in this purchase flow are paid in full. For an existing expense, append the purchase total to both total expense and paid amount; outstanding stays unchanged. Original balance payments continue using Add Payment. This avoids a second receipt/attachment system and preserves every original record.

## Task 1 — atomic persistence and retry contract

Create `finance_receipts_write(uuid,text,jsonb)` as SECURITY INVOKER. Validate access, project/category/expense boundaries, 1–20 receipts, unique receipt UUIDs, positive finite two-decimal amounts and dates. Use the existing request ledger and row locks. Create one expense or atomically increase the selected expense, create each payment with merchant/date/method, and return `{expense_id,payments:[{receipt_id,payment_id}]}`. Repeated requests return the same result; changed payloads fail.

Write rollback SQL tests first and observe missing-feature failure. Verify new expense totals, later additions, unknown-response retry, changed request payload, all-or-nothing invalid last receipt, duplicates, outsider and cross-project targets. Apply one additive production migration. No existing record is rewritten by the migration.

## Task 2 — local receipt form and safe file upload

Create `receipt-batch.js`: `receiptPayload({title,categoryId,expenseId,receipts})`, `receiptTotal(receipts)` and `saveReceiptBatch(client,context,receipts,onProgress)`. Amounts use integer cents. Freeze the payload after submission starts. Commit the whole batch first; attach each local file using the existing proof uploader with the returned payment ID. Retry only unsaved attachments, without another expense/payment. Write failure/rounding tests first.

Create `ReceiptBatch.jsx` with a single project item, optional existing-item selector, repeatable receipt rows, merchant/amount/date/method, photo/PDF picker and camera, local preview/removal and optional on-device OCR. Amounts are always editable and OCR never submits automatically. Show running batch total and existing-item before/after totals. Explain that this flow adds purchases and paid amounts. Guard closing while busy; retain partial attachment retries.

## Task 3 — integrate and verify

Add entries to Smart Capture (including the screenshot's original single-capture sheet) and Expense Detail. Show merchant notes in payment history. Reuse actual components in a disposable demo. Test selecting multiple files, editing/removing rows, exact decimal sum, selecting existing item and later addition, submit/retry, receipt persistence and project isolation. Use live rollback DB tests and actual Storage integration where available; use only synthetic fixtures. Build and run all Node tests, retaining the existing environment-dependent sync test's skip as a reported limit. Review and deploy via current GitHub main while preserving the Wedding Live Album spec added since the prior release.

Review focus: ambiguous OCR/zero amounts; 0.1+0.2; concurrent appends; failed last line; lost commit/upload response; wrong-project target; stale/removed payment parent; no file upload before commit. iPhone camera remains a real-device check.

## Progress

- Baseline: current main 3083f8e; 23 Node tests passed, 1 live sync test skipped without environment. Production baseline: 3 users, 1 active project, 23 expenses/payments, 2 attachment rows/files.
- Existing isolated worktree reused; remote Wedding Live Album spec retained.

- User clarification: ordinary manual entry must accept several evidence images, without mandatory OCR. Replaced single-file AddExpense with ExpenseComposer + EvidencePicker; quick entry/draft confirmation also supports the same multi-file evidence picker. Existing expense edits accept additional files. Shared safe uploader now supports either expense_id or payment_id while retaining exactly one parent.
- DB rollback integration passed: one expense/three merchant payments, append .10+.20 exact cents, idempotent replay, changed payload rejection, invalid last row atomicity, cross-project expense/category rejection, outsider rejection.
- Actual authenticated API + private Storage runner passed 8 checks: grouped purchase records; image/PDF per-payment mapping; unknown-response replay without duplicates; exact-cent append; new client reload + signed download; outsider isolation; deleting proof keeps payment; multiple expense evidence files survive fresh-client reload. The first pg_net call timed out at 5 seconds; retry with 60-second timeout returned 200 success. Both runs' fixtures were cleaned. Final counts equal baseline: 3 users,23 expenses,23 payments,2 attachment rows,2 Storage objects. Temporary verification function disabled (version6, JWTrequired,410).
- Fresh independent review: no Critical; fixed Important OCR manual-value/date overwrite with a regression test. Fixed internal transition bypass of pending-payment guard. Advanced reviewer unavailable due usage; standard reviewer completed.
- Build passed, Node suite30 passed/1 environment-dependent sync test skipped. Real iPhone camera/Safari requires device check; do not claim native device certification. Browser release verification pending.

- Quick-entry review found failed dismiss retry and incomplete response caching edge cases. Fixed effective-operation handling and moved validated RPC/proof persistence into money-entry.js, with two RED→GREEN regression tests. Final suite32 pass/1 environment skip.
