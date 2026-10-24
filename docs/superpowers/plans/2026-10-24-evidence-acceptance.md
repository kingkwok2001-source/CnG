# Evidence acceptance follow-up

Goal: finish the user's existing multi-evidence specification without replacing existing flows or touching original financial data.

Approach: retain the existing expense/payment RPCs, uploader and attachment constraints. Add a shared form leave guard to the four existing composers. Compare editable values against their initial snapshot, retain pending-attachment warnings, block internal closing during preparation/upload, and register beforeunload for browser navigation. Successful saves clear the guard before invoking completion callbacks. Browser unload warnings remain subject to Safari/browser lifecycle limitations.

- [ ] Reproduce missing dirty-text unload protection; add browser regression cases.
- [ ] Implement shared guard in ExpenseComposer, PaymentComposer, ReceiptBatch and TransactionForm; verify pristine, dirty, busy, cancel and successful save behavior.
- [ ] Exercise real file inputs on expense/payment/receipt/quick-entry demos with synthetic files; check preview/removal/append/save and payment deletion.
- [ ] Inspect live database constraints, policies, cleanup and existing records read-only. Do not reopen the disabled verification function or impersonate existing users.
- [ ] Run Node tests/build, review changes, deploy through GitHub/Vercel, repeat production browser checks, publish an acceptance matrix and feature inventory.

Ruling: user has already supplied the detailed specification and requested execution and deployment; continue without a new design approval gate. Use the fresh clone and task branch as isolation. Real iPhone camera, mail delivery and Google account consent require actual device/account interaction and must remain explicitly unverified when unavailable.
