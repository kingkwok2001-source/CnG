# Project Finance

Payment Tracker / Balance Tracker for C&G Wedding and future projects.

## Current release

- Auth screens now support Enter submission, accessible password visibility, persisted resend cooldowns and specific SMTP/rate-limit notices. Signup transitions into email verification. Expired callback links are handled without entering password-change mode; completed recovery removes the callback from the URL. Google OAuth is shown only when the live backend reports its provider enabled. This prepares the frontend but does not enable the provider or certify SMTP delivery.

- Smart capture: on-device English/Traditional Chinese OCR, pasted payment text, shared pending inbox and explicit confirmation. OCR is lazy-loaded; the first use downloads public OCR runtime/language files. No screenshot is sent to an OCR service.
- Payment methods include PayMe, Alipay, Octopus, Apple Pay, Jockey Club, cash and bank transfer. These are bookkeeping labels, not direct connections to those financial services.
- Project wallets with opening balances, atomic transfers/top-ups and balance-aware paid expense capture. Top-ups are excluded from expense totals. Existing expenses are not retroactively deducted from wallets.
- Optional budget, event date, monthly deposit and project monthly limit. Forecasts are separate from actual receipts and payments.
- Invite-code collaboration, charts, CSV template/import/export, profile/project images and one-page print-to-PDF remain available for Free users.
- Auth notices distinguish submitting an email request from confirmed delivery. Recovery has a return-to-login action. Existing retry-safe writes and account-deletion safeguards are retained.
- Real interactive demo at `/?demo=1` uses an in-memory client with no account/network access. The guide links to both the actual app screens and the demo.
- Shortcut ingress accepts an explicit per-project capture key. It can only create pending drafts, not read projects or confirm payments. Rotate/revoke from Smart Capture > iPhone Shortcuts. It is not arbitrary access to other apps' iOS notifications.

## Database deployment

Applied additive SQL is recorded in `supabase/sql/wallets-and-inbox.sql`, `project-planning.sql`, `payment-methods.sql`, and `shortcut-retry-safety.sql`. Apply these once, in that order, to a fresh deployment after the earlier migration/safety SQL. Do not reapply to the production project. Shortcut callers should include a UUID `request_id` and reuse it when retrying the same payload.

`capture-transaction` uses custom authentication via a hashed, narrowly scoped capture key and therefore has JWT gateway verification disabled; its SQL ingestion function is executable only by `service_role`. Never put that role key in browser code. Its CORS origin is the production application.

## Verification

The October 13 sync repair names the composite category/payment relationships explicitly. The earlier unqualified joins returned `PGRST201` after project-boundary constraints were added. Read failures now retain the last successful data with an actionable retry notice, and a successful refresh clears the notice. `tests/finance-sync-api.test.js` is a read-only live Data API regression, using the public URL/key environment variables; it verifies relationship resolution and anonymous RLS together.

`node --test tests/transaction-parser.test.js` checks parsing ambiguity and impossible dates. `tests/wallet-invariants.sql` verifies retries, atomicity, transfers, draft confirmation and access under `authenticated`, using generated fixtures and a final rollback. `tests/shortcut-key.sql` verifies client permissions and key creation/revocation. `npm run build` checks the shipped bundle.

## Remaining platform work

Native iOS/Android packages, Android notification access, store submission, paid memberships/in-app billing, ad SDKs, and Google OAuth provider credentials are not shipped by this web release. Store and payment-provider accounts/configuration must be supplied before enabling those services. Existing data stays available on the Free plan. The Shortcut endpoint is deployed, but installation and Wallet automation must be configured/tested on each iPhone.
