# KadaiGPT — project notes

Working notes that complement `CLAUDE.md` (which stays the authoritative technical
guide — commands, architecture, serverless gotchas, conventions). This file holds
what CLAUDE.md doesn't: the dated history log and the pre-deploy routine.

## Pre-deploy check

Before pushing to `main` (push = production deploy), run:

```powershell
powershell -File predeploy_check.ps1
```

It verifies: frontend production build, backend import sanity, no `NOW()` in raw
`text()` SQL, bcrypt pinned to 4.2.1. The judgment checks it can't automate —
schema changes mirrored in `ensure_serverless_schema()`, every query store-scoped,
new UI strings in all 6 locale files, new env vars enabled for Production AND
Preview — are in CLAUDE.md.

## History

*Dated entries, newest first: what happened, what was decided, what to remember.*

### 2026-07-07
Pre-deploy check script added and tested (all 4 checks passed; 216 routes import).
Repo state: platform admin foundation (ADMIN role, store suspension, login history,
plans table), admin subscription management, AI agents wired to live data, OCR
pipeline fixes. Last commit on `main` dated 2026-06-17.

### 2026-08-16
Working set (uncommitted, on `main`): bot consolidation, rate-limit fix, offline
billing E2E. Verified green: `pytest` **258/258** (incl. new `test_bot_integration.py`
and `test_rate_limits.py`), `npm run build` OK, `predeploy_check.ps1` all 4 OK
(218 routes import).
- **Shared bot services** — `app/services/bot_data.py` (single source of truth for
the numbers both owner bots answer with: sales/expense/profit/stock/GST/pending
payments/daily report, all store-scoped) and `app/services/bot_actions.py` (bot
writes: product create-or-merge-stock, `create_bill_core`, supplier
find-or-create + purchase order). `telegram_bot.py`/`whatsapp_bot.py` rewired to
call them instead of duplicating logic; per-store `wa_*`/Telegram config on the
Store row drives routing.
- **Rate-limit fix** — auth *read* paths (`GET /auth/me`, `GET /auth/staff/list`)
reclassified to the API bucket in `middleware/security.py`; app page loads no
longer burn the 5/min auth bucket. Covered by `test_rate_limits.py`.
- **Offline billing E2E** — new `frontend/tests/e2e/offline-billing.spec.js` proves
offline → pending → reconnect → auto-sync → server flow (OFL- prefixed rows, no
duplicate POSTs); `global-setup.js` + `playwright.config.js` reworked so
read-only specs reuse one shared storageState (zero auth-rate-limit calls).
- `setup_tables_v2.sql` and several frontend files touched (api.js, offlineSync.js,
CreateBill/Bills/OfflineIndicator).
- **Real UPI verification at checkout (Razorpay QR Codes API)** — UPI bills now
get a real single-use dynamic QR; the `qr_code.credited` webhook (HMAC-verified
with `RAZORPAY_WEBHOOK_SECRET`, separate from KEY_SECRET) is the ONLY thing that
flips `PENDING_PAYMENT` → `COMPLETED`. New `payments` table (`razorpay_payment_id`
UNIQUE = webhook idempotency guard), `routers/payments.py` (webhook +
payment-status poll + close/override), `BillStatus.PENDING_PAYMENT` (needs
`ALTER TYPE billstatus ADD VALUE` — added to `_SERVERLESS_SCHEMA_STATEMENTS` AND
`run_migrations`; fresh installs via updated `setup_tables_v2.sql`). Frontend:
CreateBill shows QR + 3-min countdown, polls every 2.5s, auto-completes on
confirmation, has cancel (restocks) / record-as-cash fallback. When Razorpay is
off, manual UPI is labeled "Manual UPI (unverified)". **New env var:**
`RAZORPAY_WEBHOOK_SECRET` (enable for Production AND Preview). `pytest` now
**275/275** (17 new `test_payments.py`).

**Uncommitted:** yes — nothing pushed. Deploy = `git push` to `main` after the
judgment checks in CLAUDE.md (i18n untouched; new env var `RAZORPAY_WEBHOOK_SECRET`
needs enabling for Production AND Preview + Razorpay dashboard webhook URL
`https://<domain>/api/v1/payments/webhook` for `qr_code.credited`).

<!-- Template:
### YYYY-MM-DD
What happened / what was decided / what to remember. -->
