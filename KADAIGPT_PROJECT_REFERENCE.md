# KadaiGPT — Complete Project Reference

> **Last Updated:** May 31, 2026  
> **Author:** Kishan (kishan02-sg)  
> **Repo:** https://github.com/kishan02-sg/Kadaigpt  
> **Live URL:** https://kadaigpt-main.vercel.app  
> **"Kadai" (கடை) = Shop in Tamil | GPT = Next-Gen AI**

---

## 1. What is KadaiGPT?

KadaiGPT is an **AI-Powered Retail Intelligence Platform** for India's 12M+ Kirana (corner) stores. It provides:

- POS Billing with GST compliance
- Multi-language support (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
- AI-powered demand forecasting & insights (Google Gemini)
- Voice commands in 6 Indian languages
- WhatsApp Business integration
- Staff management with role-based access (Owner/Manager/Cashier/Inventory)
- Customer loyalty & credit tracking
- Offline-first PWA architecture
- OCR bill scanning

---

## 2. Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** (Vite) | UI framework |
| **react-i18next** | Multi-language translations (6 languages) |
| **Lucide React** | Icon library |
| **Vanilla CSS** | Styling (dark theme with CSS variables) |
| **PWA** | Offline-first with service worker |

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** (Python 3.14) | REST API framework |
| **SQLAlchemy 2.0** (async) | ORM with async support |
| **asyncpg** | PostgreSQL async driver |
| **aiosqlite** | SQLite async driver (local dev) |
| **Google Generative AI** | Gemini for OCR, insights, agent AI |
| **python-jose + passlib** | JWT auth + bcrypt password hashing |
| **Pydantic v2** | Request/response validation |

### Infrastructure
| Service | Purpose |
|---|---|
| **Vercel** | Hosting (serverless Python + static frontend) |
| **Supabase** | PostgreSQL database (Transaction Pooler) |
| **GitHub** | Source control |

---

## 3. Project Structure

```
kadaigpt-main/
├── api/
│   └── index.py              # Vercel serverless entry point
├── backend/
│   └── app/
│       ├── main.py            # FastAPI app, CORS, middleware, health checks
│       ├── config.py          # Settings (env vars, DB URL, JWT, features)
│       ├── database.py        # SQLAlchemy engine, session, IPv4 resolver
│       ├── rbac.py            # Role-based access control
│       ├── models/
│       │   ├── __init__.py    # All SQLAlchemy models (User, Product, Bill, etc.)
│       │   └── subscription.py
│       ├── routers/           # 22 API route files
│       │   ├── auth.py        # Login, register, /me, staff creation
│       │   ├── bills.py       # CRUD bills, payment tracking
│       │   ├── products.py    # Product management
│       │   ├── customers.py   # Customer & credit management
│       │   ├── analytics.py   # Sales analytics, trends
│       │   ├── dashboard.py   # Dashboard stats
│       │   ├── agents.py      # AI agent endpoints
│       │   ├── ocr.py         # OCR bill scanning (Gemini)
│       │   ├── gst.py         # GST reports
│       │   ├── suppliers.py   # Supplier management
│       │   ├── whatsapp.py    # WhatsApp bot integration
│       │   ├── notifications.py
│       │   ├── subscription.py
│       │   ├── backup.py
│       │   ├── bulk.py        # Import/Export CSV
│       │   ├── credit.py      # Customer credit/due tracking
│       │   ├── audit.py       # Audit trail
│       │   ├── print.py       # Thermal printer support
│       │   ├── privacy.py     # Legal pages
│       │   └── telegram.py    # Telegram bot
│       ├── schemas/           # Pydantic request/response schemas
│       ├── services/          # Business logic services
│       ├── agents/            # AI agent implementations (Gemini-based)
│       ├── middleware/        # Custom middleware
│       ├── constants/         # Enums, constants
│       └── utils/             # Helpers
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app shell, navbar, routing
│   │   ├── main.jsx           # React entry point
│   │   ├── pages/             # 23 page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── CreateBill.jsx # POS billing interface
│   │   │   ├── Bills.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── StaffManagement.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   └── ... (13 more)
│   │   ├── components/        # 50 reusable components
│   │   │   ├── UnifiedAIAssistant.jsx  # AI chatbot
│   │   │   ├── LanguageSwitcher.jsx    # i18n language dropdown
│   │   │   ├── VoiceCommandAgent.jsx   # Voice input
│   │   │   ├── MobileNav.jsx           # Mobile navigation
│   │   │   └── ... (46 more)
│   │   ├── config/
│   │   │   └── roles.js       # Role-based nav config (Owner/Manager/Cashier/Inventory)
│   │   ├── contexts/
│   │   │   └── LanguageContext.jsx  # Language state (legacy, partially used)
│   │   ├── i18n/
│   │   │   ├── index.js       # i18next setup (PRIMARY translation system)
│   │   │   └── locales/       # Translation JSON files
│   │   │       ├── en.json
│   │   │       ├── hi.json    # Hindi
│   │   │       ├── ta.json    # Tamil
│   │   │       ├── te.json    # Telugu
│   │   │       ├── kn.json    # Kannada
│   │   │       └── ml.json    # Malayalam
│   │   ├── services/
│   │   │   ├── api.js         # Axios HTTP client
│   │   │   ├── realDataService.js
│   │   │   ├── ocrService.js
│   │   │   └── whatsapp.js
│   │   └── styles/            # CSS files
│   ├── .env.production        # VITE_API_URL (empty = same-origin on Vercel)
│   └── package.json
├── vercel.json                # Vercel config (rewrites, functions, headers)
├── requirements.txt           # Python dependencies (must stay under 250MB)
├── setup_tables_v2.sql        # Database schema SQL (for manual Supabase setup)
├── DEPLOYMENT_GUIDE.md        # Deployment instructions
└── README.md
```

---

## 4. Vercel Deployment — How It Works

### Architecture
```
Browser → Vercel CDN → /index.html (React SPA)
                     → /api/* → api/index.py → FastAPI (app.main.app)
```

### Key Config: `vercel.json`
- **Build:** `cd frontend && npm install && npm run build`
- **Output:** `frontend/dist`
- **Rewrites:**
  - `/api/:path(.*)` → `/api/index.py` (all API calls go to Python)
  - `/((?!api|assets|favicon).*)` → `/index.html` (SPA client-side routing)
- **Function Region:** `bom1` (Mumbai, India)
- **Max Duration:** 30 seconds
- **Memory:** 1024MB (ignored on Active CPU billing)

### Entry Point: `api/index.py`
```python
os.environ.setdefault("VERCEL", "1")
sys.path.insert(0, backend_dir)  # Add backend/ to path
from app.main import app         # Import FastAPI app
# Vercel auto-detects the `app` ASGI variable
```

---

## 5. Database Configuration

### Supabase PostgreSQL
- **Project Ref:** See Supabase Dashboard
- **Connection Mode:** **Transaction Pooler** (port 6543) — REQUIRED for Vercel
- **Direct Connection (port 5432):** ❌ Does NOT work on Vercel (IPv6-only)

### DATABASE_URL Format
```
postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### ⚠️ Password with Special Characters
If your password contains `@`, `#`, or other URL-special characters, you MUST URL-encode them:
- `@` → `%40`
- `#` → `%23`
- `:` → `%3A`

**Example:** Password `Kishan@123@2026` becomes `Kishan%40123%402026` in the URL.

### IPv4 Resolution Fix
Vercel serverless only supports IPv4. Our `database.py` auto-resolves the database hostname to an IPv4 address using `socket.getaddrinfo()` to prevent `[Errno 99] Cannot assign requested address`.

### Connection Settings (Serverless)
```python
engine = create_async_engine(
    db_url,
    poolclass=NullPool,           # No persistent pool in serverless
    connect_args={"ssl": "require"},
    echo=False
)
```

### Database URL Priority
`SUPABASE_DB_URL` > `DATABASE_URL` > `POSTGRES_URL` > default SQLite

### Table Setup
After first deployment, either:
1. Call `POST /api/setup-db` endpoint (auto-creates tables via SQLAlchemy)
2. Or run `setup_tables_v2.sql` in Supabase SQL Editor

---

## 6. Environment Variables (Vercel)

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://postgres.xxx:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET_KEY` | ✅ | Random 64-char string |
| `SECRET_KEY` | ✅ | Random 64-char string |
| `GOOGLE_API_KEY` | Optional | Gemini API key for AI features |
| `APP_ENV` | Optional | `production` (default on Vercel) |
| `EVOLUTION_API_URL` | Optional | WhatsApp Business API |
| `EVOLUTION_API_KEY` | Optional | WhatsApp API key |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot integration |

> ⚠️ Make sure all env vars are enabled for **Production**, **Preview**, AND **Development** in Vercel.

---

## 7. Authentication & Roles

### JWT Auth Flow
1. `POST /api/v1/auth/login` — Returns `access_token` (24h) + `refresh_token` (30d)
2. Frontend stores token in localStorage
3. All API calls include `Authorization: Bearer <token>` header
4. Backend validates token via `get_current_user` dependency

### User Roles (Enum: `UserRole`)
| Role | Access |
|---|---|
| `OWNER` | Full access + Staff management + More dropdown |
| `MANAGER` | Bills + Analytics + Staff + limited More |
| `CASHIER` | Billing + Customers + Loyalty only |
| `INVENTORY_MANAGER` | Products + Suppliers + Bulk ops + Analytics |

### Role Config: `frontend/src/config/roles.js`
Each role defines:
- `nav[]` — Main navbar items (with i18n `labelKey`)
- `moreNav[]` — "More" dropdown items
- `defaultPage` — Landing page after login

---

## 8. Multi-Language (i18n) System

### Architecture
- **Primary System:** `react-i18next` (via `frontend/src/i18n/index.js`)
- **Locale Files:** `frontend/src/i18n/locales/{en,hi,ta,te,kn,ml}.json`
- **Storage Key:** `kadaigpt_language` (localStorage)
- **Language Switcher:** `frontend/src/components/LanguageSwitcher.jsx`

### Supported Languages
| Code | Language | Native Name |
|---|---|---|
| `en` | English | English |
| `hi` | Hindi | हिन्दी |
| `ta` | Tamil | தமிழ் |
| `te` | Telugu | తెలుగు |
| `kn` | Kannada | ಕನ್ನಡ |
| `ml` | Malayalam | മലയാളം |

### How to Use in Components
```jsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
    const { t } = useTranslation()
    return <h1>{t('dashboard.title', 'Dashboard')}</h1>
    //                                ^^^^^^^^^^^ fallback
}
```

### Legacy System (LanguageContext)
There's a legacy `LanguageContext.jsx` with its own `commonTranslations`. It uses a **different** localStorage key (`kadai_language`). The primary system is `react-i18next`. The LanguageContext is still used by some older components but should be migrated.

### Current Translation Coverage
- ✅ Navbar items (connected to i18next via `labelKey` in roles.js)
- ✅ Online/Offline status, Notifications header
- ⚠️ Individual page content (most pages still use hardcoded English)
- To translate a page: add `useTranslation()` and use `t('key')` for all strings

---

## 9. API Endpoints

### Core Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check with DB status |
| `GET` | `/api/ping` | Lightweight uptime check |
| `POST` | `/api/setup-db` | Create all database tables |
| `GET` | `/api/info` | App info & features |
| `GET` | `/api/docs` | Swagger UI |

### Auth (`/api/v1/auth/`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/login` | Login (email + password) |
| `POST` | `/register` | Register new owner |
| `GET` | `/me` | Get current user profile |
| `POST` | `/refresh` | Refresh access token |
| `POST` | `/staff/create` | Create staff account |

### Business (`/api/v1/`)
| Method | Prefix | Description |
|---|---|---|
| CRUD | `/products` | Product management |
| CRUD | `/bills` | Billing & invoices |
| CRUD | `/customers` | Customer management |
| GET | `/dashboard` | Dashboard statistics |
| GET | `/analytics` | Sales analytics |
| CRUD | `/suppliers` | Supplier management |
| GET | `/gst` | GST reports |
| POST | `/ocr` | OCR bill scanning |
| CRUD | `/notifications` | In-app notifications |

---

## 10. Bugs Fixed (History)

### Deployment & Database
| Issue | Root Cause | Fix |
|---|---|---|
| 500 Internal Server Error on Vercel | Missing `asyncpg` in requirements.txt | Added `asyncpg==0.30.0` |
| `(ENOTFOUND) tenant/user not found` | Wrong Supabase project ref in DATABASE_URL | Updated to correct connection string |
| `[Errno 99] Cannot assign requested address` | Vercel is IPv4-only, Supabase direct is IPv6 | Added IPv4 resolver in `database.py` + use Transaction Pooler (port 6543) |
| `password authentication failed` | `@` in password broke URL parsing | URL-encode `@` as `%40` in DATABASE_URL |
| `asyncpg` + `sslmode=require` conflict | asyncpg doesn't support sslmode URL param | Strip sslmode from URL, pass via `connect_args={"ssl": "require"}` |
| `MissingGreenlet` error | BaseHTTPMiddleware breaks SQLAlchemy async | Replaced with pure ASGI middleware (`SecurityASGIMiddleware`) |

### Role & Auth
| Issue | Root Cause | Fix |
|---|---|---|
| Dashboard crash for Inventory Manager | Role not normalized to lowercase | `role.lower()` in AuthContext |
| Infinite re-render loop | Inventory Manager missing from allowed pages | Added `dashboard`, `analytics` to allowed pages |
| Staff login failing at `/me` | ORM lazy-loading issue in serverless | Raw SQL fallback in `/me` endpoint |
| Staff can't see Bills/Customers | Missing nav items in Manager role | Added `bills`, `customers`, `suppliers` to Manager nav |

### Frontend
| Issue | Root Cause | Fix |
|---|---|---|
| Only 3 languages in dropdown | `.slice(0, 3)` on language array | Removed `.slice(0, 3)` |
| Missing Telugu/Kannada/Malayalam translations | `commonTranslations` only had en/hi/ta | Added te/kn/ml translations |
| Language switch doesn't translate navbar | Hardcoded English labels in roles.js | Added `labelKey` i18n keys + `useTranslation()` in App.jsx |
| Mobile billing cart hidden behind navbar | CSS z-index/positioning | Fixed mobile.css |
| UnicodeEncodeError on Windows CMD | Emoji in print statements | Force `PYTHONIOENCODING=utf-8` |

---

## 11. Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r ../requirements.txt

# Create .env in backend/
# DATABASE_URL=sqlite+aiosqlite:///./kadaigpt.db
# JWT_SECRET_KEY=dev-secret-key
# GOOGLE_API_KEY=your-gemini-key

# Run
set PYTHONIOENCODING=utf-8   # Windows
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev    # Starts on http://localhost:5173
```

### Frontend Dev Proxy
The Vite dev server proxies `/api` requests to `localhost:8000` so the backend and frontend work together locally.

---

## 12. Deployment Checklist

### First-Time Deployment
1. Push code to GitHub
2. Connect repo to Vercel
3. Set **Build Command:** `cd frontend && npm install && npm run build`
4. Set **Output Directory:** `frontend/dist`
5. Set **Root Directory:** (leave empty or `.`)
6. Add environment variables (DATABASE_URL, JWT_SECRET_KEY, etc.)
7. Deploy
8. Call `POST https://your-app.vercel.app/api/setup-db` to create tables
9. Register first user via the app

### Redeployment
1. `git add . && git commit -m "description" && git push origin main`
2. Vercel auto-deploys on push to `main`
3. Verify: `GET https://your-app.vercel.app/api/health`

### Debugging Production
1. **Check health:** `GET /api/health` — shows DB status, uptime, feature flags
2. **Check ping:** `GET /api/ping` — minimal response test
3. **Vercel Logs:** Vercel Dashboard → Deployments → Logs
4. **Error details hidden in production:** Set `APP_ENV=development` temporarily to see error messages

---

## 13. Key Architecture Decisions

### Why NullPool in Serverless?
Vercel serverless functions are stateless — each request may run in a new container. Connection pooling doesn't work across containers. `NullPool` creates a fresh connection per request and closes it immediately.

### Why Pure ASGI Middleware?
Starlette's `BaseHTTPMiddleware` runs handlers in a threadpool, which breaks SQLAlchemy's async greenlet context (`MissingGreenlet` error). The custom `SecurityASGIMiddleware` preserves the greenlet.

### Why Two Translation Systems?
Legacy `LanguageContext.jsx` was the original approach. Later, `react-i18next` was added for proper i18n with JSON locale files. The LanguageSwitcher uses i18next. Eventually, all components should migrate to `useTranslation()`.

### Rate Limiting
In-memory rate limiter (no Redis dependency). Separate limits for:
- Auth endpoints: 5 req/min
- API endpoints: 100 req/min
- Skips: `/api/ping`, `/api/health`, docs endpoints

---

## 14. Git Workflow

```bash
# Always work on main branch
git add .
git commit -m "type(scope): description"
git push origin main

# Commit message format:
# feat(billing): add DUE payment option
# fix(db): resolve hostname to IPv4 on Vercel
# fix(i18n): connect navbar to i18next
# chore: trigger re-deploy
```

---

## 15. Useful Commands

```bash
# Check live health
curl https://kadaigpt-main.vercel.app/api/health

# Create DB tables
curl -X POST https://kadaigpt-main.vercel.app/api/setup-db

# Test login
curl -X POST https://kadaigpt-main.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=your@email.com&password=yourpassword"

# Test local backend import
set VERCEL=1
set DATABASE_URL=postgresql+asyncpg://test:test@localhost/test
cd backend && python -c "from app.main import app; print('OK')"
```

---

## 16. Known Limitations & TODO

### Current Limitations
- [ ] Individual page content is mostly hardcoded English (navbar is translated)
- [ ] No Redis in production — rate limiting is per-container (resets on cold start)
- [ ] Thermal printer only works on local deployment (not Vercel)
- [ ] WhatsApp integration requires Evolution API setup
- [ ] OCR requires `GOOGLE_API_KEY` (Gemini)

### Future Improvements
- [ ] Add `useTranslation()` to all 23 pages for full i18n
- [ ] Add offline sync queue for bills created without internet
- [ ] Add Supabase Realtime for live inventory updates
- [ ] Add email notifications (SMTP credentials)
- [ ] Add barcode scanner integration
- [ ] Add dark/light theme toggle (currently dark only)

---

## 17. Contacts & Resources

| Resource | URL |
|---|---|
| **GitHub Repo** | https://github.com/kishan02-sg/Kadaigpt |
| **Live App** | https://kadaigpt-main.vercel.app |
| **Supabase Dashboard** | https://supabase.com/dashboard |
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **FastAPI Docs (Live)** | https://kadaigpt-main.vercel.app/api/docs |
| **Gemini API** | https://ai.google.dev |

---

*This document is the single source of truth for the KadaiGPT project. Keep it updated after major changes.*
