# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

KadaiGPT is an AI-powered POS / retail-intelligence PWA for Indian kirana stores: FastAPI (Python) backend + React 19 (Vite) frontend, deployed on Vercel with Supabase PostgreSQL.

## Commands

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server on :5173. Proxies/points `/api` to the backend at `http://localhost:8000` (see `frontend/src/services/api.js`: dev uses `http://localhost:8000/api/v1`, prod uses same-origin `/api/v1`).
- `npm run build` — production build to `frontend/dist` (this is what Vercel deploys). **Always build after frontend changes to catch JSX/import errors.**
- `npm run lint` — ESLint.
- `npm run test:e2e` / `test:e2e:ui` — Playwright E2E.

Backend (`cd backend`):
- Run locally: `set PYTHONIOENCODING=utf-8` then `DATABASE_URL=sqlite+aiosqlite:///./local.db python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (no `--reload` if you want a stable background process). On Windows, `PYTHONIOENCODING=utf-8` is required or emoji in logs crash.
- Tests: `pytest` (config in `backend/pytest.ini`, `asyncio_mode=auto`). Single test: `pytest tests/test_auth.py::TestX::test_y`.
- Quick import sanity check: `python -c "from app.main import app; print(len(app.routes))"`.

Health: `GET /api/health` (DB status, provider flags), `GET /api/ping`.

## Architecture

**Single-deployable, serverless.** `api/index.py` is the Vercel entry: it sets `VERCEL=1`, adds `backend/` to `sys.path`, and imports `app.main:app`. `vercel.json` rewrites `/api/*` → `api/index.py` (FastAPI) and everything else → the SPA. FastAPI also serves the built frontend from `frontend/dist` in non-serverless mode. So both API and UI ship together.

**Database is environment-split.** Production = Supabase PostgreSQL via the **Transaction Pooler (port 6543)**; local = SQLite. `app/database.py` resolves the URL, forces IPv4 (Vercel is IPv4-only), and configures the engine. The backend is multi-tenant: nearly every query is scoped by `current_user.store_id`.

### Serverless gotchas (these have caused production outages — respect them)
- **Schema changes must go in `ensure_serverless_schema()` in `app/database.py`.** `init_db()` *skips all DB work on Vercel* (it assumes tables exist), so SQLAlchemy migrations never run in prod. New columns/tables = add idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` to the `_SERVERLESS_SCHEMA_STATEMENTS` list; it runs once per cold container from `get_db()`. Also add the column to the ORM model.
- **asyncpg + Supabase pooler:** serverless engine uses `NullPool` and disables prepared statements (`statement_cache_size=0`, unique `prepared_statement_name_func`). The pooler does **not** support prepared statements — reusing a pooled connection causes `prepared statement "__asyncpg_stmt_x__" already exists` and crashes every query.
- **Never use `NOW()` in raw `text()` SQL** — it's Postgres-only and silently errors on SQLite. Pass a bound `datetime.utcnow()` param instead.
- **No reliable ASGI lifespan / background tasks on Vercel.** The scheduler/keepalive are intentionally skipped when serverless; don't rely on startup events for required work.

**Security middleware is pure ASGI, not `BaseHTTPMiddleware`** (`SecurityASGIMiddleware` in `app/main.py`). `BaseHTTPMiddleware` runs handlers in a threadpool which breaks SQLAlchemy's async greenlet (`MissingGreenlet`). It also sets security headers (CSP, HSTS in prod) and does in-memory rate limiting keyed by the real client IP from `X-Forwarded-For`.

**Auth** (`app/routers/auth.py`): JWTs carry `iat`/`iss`/`aud` (validated on decode) plus `users.tokens_valid_after` for revocation (bumped on logout / password change). Lockout, OTPs, and reset tokens are persisted to the DB via `app/services/auth_state.py` (`auth_security_state` table) so they survive cold starts. `config.py` **fails fast at startup in production** if `JWT_SECRET_KEY`/`SECRET_KEY` are unset/default — these env vars are required to boot. Password policy lives in `app/utils/password.py`.

**RBAC** (`app/rbac.py`): `require_role(...)` / `require_min_role(...)`. Note `CASHIER` and `INVENTORY_MANAGER` share level 1, so use explicit role lists (not level checks) to separate them. `rbac.py` imports `get_current_active_user` **lazily inside the factory** to avoid a circular import (rbac → routers.auth → routers/__init__ → products → rbac).

**Provider integrations follow an "activate-when-configured, graceful-fallback" pattern:**
- Email (`services/resend_service.py`, `msg91_service.py`, `email_service.py`): tries Resend → MSG91 → SMTP → log.
- WhatsApp (`services/whatsapp_bot.py`): Meta Cloud API or WAHA/Evolution. Sending is **per-store** — connection config is stored encrypted on the `Store` row (`wa_*` columns, secrets via `app/utils/encryption.py`), and inbound webhook messages are routed to the owning store by WAHA `session` or Meta `phone_number_id`. The customer-facing storefront bot (`process_customer_message`) answers stock/price/store-info from that store's live products.
- Secrets are encrypted at rest and never returned by config endpoints (only `*_set` booleans).

### Frontend
React 19 + Vite, **no react-router** — navigation is hash-based via `currentPage` state in `App.jsx` (`window.location.hash`). Pages are code-split with `React.lazy`. `App.jsx` enforces per-role page whitelists (`ROLE_PAGES`) and renders role-driven nav from `config/roles.js`; the bottom `MobileNav` has its own role config. The API client (`services/api.js`) stores the JWT in `localStorage` (`kadai_token`) and attaches it as `Authorization: Bearer`. Much page styling lives in `<style>` blocks **inside the component** (so a page's CSS and its `@media` rules are co-located in the `.jsx`).

**i18n:** `react-i18next`, 6 languages (`en/hi/ta/te/kn/ml`) with JSON in `frontend/src/i18n/locales/`. All 6 files share the same key set. To translate UI: add the key to **all 6** locale files, then wire the component with `t('section.key', 'English fallback')`. Many pages are still partially hardcoded English — the translation *data* is complete; components just need `t()` wiring.

## Conventions
- Work on `main`; Vercel auto-deploys on push. Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `requirements.txt` must stay under Vercel's ~250 MB bundle limit (keep deps minimal). bcrypt is **pinned to 4.2.1** — passlib 1.7.4 breaks with bcrypt 5.x (local venvs often have 5.x, which breaks auth locally only; prod is fine).
- Env vars must be enabled for Production **and** Preview in Vercel, or previews fail to boot (secret fail-fast).
