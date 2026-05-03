# KadaiGPT - Project Context (paste this into a new Antigravity conversation)

I'm working on **KadaiGPT** — an AI-powered retail management platform for Indian small shops. The codebase is at `c:\Users\lalit\Desktop\kadaigpt-main\kadaigpt-main`.

## Architecture
- **Frontend**: React + Vite (in `frontend/`)
- **Backend**: FastAPI (in `backend/app/`)
- **Database**: Supabase PostgreSQL (project: `cgekqqvbipbpduwcapnr`, region: `ap-south-1` Mumbai)
- **Deployment**: Vercel serverless

## Deployment Status (LIVE)
- **URL**: https://kadaigpt-main.vercel.app/
- **API**: https://kadaigpt-main.vercel.app/api/ping → 200 OK
- **Vercel function region**: `bom1` (Mumbai) — matches Supabase for low latency (~4ms warm)
- **DB**: 16 tables created via SQL Editor (setup_tables_v2.sql), UPPERCASE enums

## Key Files Modified for Vercel Deployment
- `vercel.json` — build config, rewrites, function region (bom1), 30s timeout
- `api/index.py` — serverless entry point, imports FastAPI app
- `api/.python-version` — Python 3.12
- `api/requirements.txt` — trimmed dependencies for 245MB limit
- `backend/app/database.py` — connection pool (pool_size=1), asyncpg SSL context (not sslmode), lazy init_db
- `backend/app/main.py` — CORS for kadaigpt-main.vercel.app, /api/setup-db endpoint, skip scheduler/keepalive in serverless
- `backend/app/agents/ocr_agent.py` — `from __future__ import annotations` (PIL optional)
- `backend/app/agents/offline_agent.py` — uses /tmp/ for file storage on Vercel
- `backend/app/routers/ocr.py` — uses /tmp/ for uploads on Vercel
- `backend/app/utils/encryption.py` — optional cryptography import

## Vercel Environment Variables
- `DATABASE_URL`: `postgresql://postgres.cgekqqvbipbpduwcapnr:Kishan%40123%402026@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`
- `SECRET_KEY`: `kadaigpt-prod-secret-2026-x7k9m2p4q8`
- `JWT_SECRET_KEY`: `kadaigpt-jwt-prod-2026-r1s5t9v3w7`
- `APP_ENV`: `production`
- `GOOGLE_API_KEY`: `AIzaSyCWs8OyDJxE-Fetgp9W6B0tCS27-WjB2Xg`

## Supabase Connection
- **Session Pooler** (IPv4): `aws-1-ap-south-1.pooler.supabase.com:5432`
- **SSL**: asyncpg requires ssl context object, NOT `sslmode=require` in URL
- **Password**: `Kishan@123@2026` (URL-encoded: `Kishan%40123%402026`)

## Test Account
- Email: `test@kadaigpt.com` / Password: `Test123!`
- Store: TestKadai (id: 1)

## Known Limitations
- Cold starts: ~7s (Vercel free tier, Python boot)
- WhatsApp gateway needs separate persistent hosting
- File uploads go to /tmp/ (ephemeral) — needs Supabase Storage for persistence

## Git
- Repo: https://github.com/kishan02-sg/Kadaigpt.git
- Branch: main
- Latest commit: perf: deploy function to Mumbai (bom1)

Continue working on KadaiGPT from here.
