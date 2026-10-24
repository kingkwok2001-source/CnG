# Evidence acceptance follow-up

Goal: finish the user's existing multi-evidence specification without replacing existing flows or touching original financial data.

Approach: retain the existing expense/payment RPCs, uploader and attachment constraints. Add a shared form leave guard to the four existing composers. Compare editable values against their initial snapshot, retain pending-attachment warnings, block internal closing during preparation/upload, and register beforeunload for browser navigation. Successful saves clear the guard before invoking completion callbacks. Browser unload warnings remain subject to Safari/browser lifecycle limitations.

- [x] Reproduce missing dirty-text unload protection; add browser regression cases.
- [x] Implement shared guard in ExpenseComposer, PaymentComposer, ReceiptBatch and TransactionForm; verify pristine, dirty, busy, cancel and successful save behavior.
- [x] Exercise real file inputs on expense/payment/receipt/quick-entry demos with synthetic files; check preview/removal/append/save and payment deletion.
- [x] Inspect live database constraints, policies, cleanup and existing records read-only. Do not reopen the disabled verification function or impersonate existing users.
- [x] Run Node tests/build, review changes, deploy through GitHub/Vercel, repeat production browser checks, publish an acceptance matrix and feature inventory.

Ruling: user has already supplied the detailed specification and requested execution and deployment; continue without a new design approval gate. Use the fresh clone and task branch as isolation. Real iPhone camera, mail delivery and Google account consent require actual device/account interaction and must remain explicitly unverified when unavailable.

Review: independent reviewer found two Important issues (permanent completion bypass, editable payment after lost response). Both received failing browser reproductions, fixes, and passing regressions. Node suite 33/33, build and desktop/mobile browser checks passed. No deferred minor findings.
