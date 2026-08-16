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
`text()` SQL, bcrypt pinned to 4.2.1, no known bloat deps in requirements, and a
Vercel Python bundle size estimate (hard gate at 210 MB vs the platform's 225 MB
cap; warns when the estimate can't be computed, e.g. asyncpg 0.30.0 has no wheel
for local Python 3.14). The judgment checks it can't automate —
schema changes mirrored in `ensure_serverless_schema()`, every query store-scoped,
new UI strings in all 6 locale files, new env vars enabled for Production AND
Preview — are in CLAUDE.md.

## History

*Dated entries, newest first: what happened, what was decided, what to remember.*

### 2026-08-16 (post-deploy hardening)
Committed on `main` after the production deploy: `predeploy_check.ps1` now 6
checks (added **known-bloat-deps scan** — blocks google-generativeai/grpcio/
protobuf/tensorflow/torch/opencv/scipy/pandas/etc — and a **bundle size estimate**
that hard-fails above 210 MB when the temp-venv install succeeds, warns otherwise;
local pip can't build `asyncpg==0.30.0` on Python 3.14, a tooling gap not a
deploy issue). New `.github/workflows/health-monitor.yml`: scheduled every 15 min,
hits `/api/health`, fails the run (email alert) when `database.status != healthy`
— a plain uptime check returns 200 even with the DB down. New
`verify_production.ps1` smoke test: health → register throwaway store → create UPI
bill → confirm payment state; verified against prod that it fails ONLY at the DB
step (register 422 was fixed: email-validator rejects the `.test` TLD, and the
phone field needed exactly 10 digits). `DEPLOYMENT_GUIDE.md` gained a "FIRST AID"
section: exact Vercel env-var steps + correct Supabase connection string formats
(pooler: `postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require`,
direct: `db.<ref>.supabase.co:5432`) and the UptimeRobot keyword variant.

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

**Deployed 2026-08-16** (3 commits: `e4cf3b2`, `84de629`, `bd3ebdf`) — pushed to
`origin/main`; Vercel production deploy **Ready**, new payment endpoints live.
Build fixes shipped along the way: the Python function bundle was 231.65 MB (over
Vercel's 225 MB cap) — migrated AI agents from `google.generativeai`
(grpcio/protobuf, ~113 MB) to `google-genai` (httpx-based), then bumped
`httpx` to 0.28.1 to satisfy google-genai's resolver.

**Still open before the app is truly usable in prod:**
1. `DATABASE_URL` in Vercel is stale — host `postgres.cgekqqvbipbpduwcapnr...`
   returns ENOTFOUND, so `/api/health` reports `database: unhealthy`. Needs the
   current Supabase connection string (was broken before this deploy too).
2. Enable new env var `RAZORPAY_WEBHOOK_SECRET` for Production AND Preview.
3. Razorpay dashboard: register webhook URL
   `https://<domain>/api/v1/payments/webhook` for the `qr_code.credited` event.
4. `SECRET_KEY`/`JWT_SECRET_KEY`/`APP_ENV` are Production-only — Preview
   deployments fail the secret fail-fast check; enable for Preview too.

<!-- Template:
### YYYY-MM-DD
What happened / what was decided / what to remember. -->
