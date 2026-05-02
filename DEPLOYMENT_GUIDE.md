# 🚀 KadaiGPT - Deployment Guide (Render.com)

## Why Render.com?

| Feature | Vercel ❌ | Render ✅ |
|---------|----------|----------|
| FastAPI backend | 30s timeout serverless | Full long-running process |
| WhatsApp Baileys Bot | ❌ No WebSocket support | ✅ Docker, always-on |
| PostgreSQL | External only (Neon) | Built-in free DB |
| Background tasks | ❌ No workers | ✅ Cron + workers |
| File uploads | ❌ /tmp only | ✅ Persistent disk |
| Python version | 3.14 only (broken) | Any version via Docker |
| **Monthly Cost** | **$0 (limited)** | **$0 free tier** |

---

## Architecture on Render

```
┌──────────────────────────────────────────────────────────┐
│                    RENDER.COM                            │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │   Web Service         │  │   WhatsApp Bot           │  │
│  │   (Docker)            │  │   (Docker)               │  │
│  │                       │  │                           │  │
│  │  FastAPI Backend      │  │  Baileys + Node.js       │  │
│  │  + React Frontend     │  │  Persistent WebSocket    │  │
│  │  + OCR + AI           │  │  24/7 Connection         │  │
│  │  + Keep-Alive ♻️      │  │                           │  │
│  └──────────┬────────────┘  └───────────────────────────┘  │
│             │                                              │
│  ┌──────────▼────────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL Database   │  │  UptimeRobot (External)  │  │
│  │  (Render Free Tier)    │  │  Pings /api/ping q5min   │  │
│  └────────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 🟢 24/7 Uptime System (3-Layer Protection)

KadaiGPT uses a **triple-layer** keep-alive strategy to stay online 24/7 on free tier:

### Layer 1: Built-in Self-Ping (Automatic)
The backend has a built-in `KeepAliveService` that self-pings `/api/health` every 10 minutes.
- **Zero config needed** — it starts automatically in production
- Runs as an asyncio background task
- Logs uptime stats hourly

### Layer 2: UptimeRobot (Free External Monitor) ⭐ Recommended
1. Go to [uptimerobot.com](https://uptimerobot.com) → Create free account
2. Click **Add New Monitor**:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `KadaiGPT`
   - **URL**: `https://kadaigpt.onrender.com/api/ping`
   - **Monitoring Interval**: `5 minutes`
3. Click **Create Monitor**
4. (Optional) Add a 2nd monitor for WhatsApp:
   - **URL**: `https://kadaigpt-whatsapp.onrender.com/health`
   - **Interval**: `5 minutes`

### Layer 3: Frontend Warm-Up (User Experience)
When a user visits the site during a cold start:
1. A beautiful loading screen shows with the KadaiGPT brand
2. Animated progress bar with status: *"Server is waking up... (~30s)"*
3. Auto-retries every 5 seconds until the backend responds
4. Once warm, the app loads instantly on subsequent visits (10-min cache)

### Verify Uptime System
After deployment, check: `https://kadaigpt.onrender.com/api/health`

You'll see:
```json
{
  "status": "healthy",
  "uptime": "12h 34m",
  "database": "healthy",
  "keepalive": {
    "running": true,
    "total_pings": 72,
    "ping_interval_minutes": 10
  },
  "scheduler": {
    "running": true,
    "tasks": 7
  }
}
```

---

## Step 1: Create a Render Account

1. Go to [render.com](https://render.com) → Sign up with **GitHub**
2. This auto-connects your GitHub repos

---

## Step 2: One-Click Deploy with Blueprint

The easiest way — uses the `render.yaml` file in the repo:

1. Go to [render.com/deploy](https://render.com/deploy)
2. Paste your repo URL: `https://github.com/Lokii1211/kadaigpt`
3. Render reads `render.yaml` and auto-creates:
   - ✅ Web Service (FastAPI + React)
   - ✅ WhatsApp Bot Service
   - ✅ PostgreSQL Database
4. Click **Apply** → Wait for build (~3-5 minutes)

---

## Step 3 (Alternative): Manual Setup

If Blueprint doesn't work, create services manually:

### 3a. Create PostgreSQL Database
1. Dashboard → **New** → **PostgreSQL**
2. Name: `kadaigpt-db`
3. Region: **Singapore**
4. Plan: **Free**
5. Click **Create Database**
6. Copy the **Internal Database URL** (starts with `postgres://...`)

### 3b. Create Web Service (Backend + Frontend)
1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo: `Lokii1211/kadaigpt`
3. Settings:
   - **Name**: `kadaigpt`
   - **Region**: Singapore
   - **Runtime**: Docker
   - **Plan**: Free
4. **Environment Variables** → Add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | *(paste Internal Database URL from step 3a)* |
| `SECRET_KEY` | *(click Generate)* |
| `JWT_SECRET_KEY` | *(click Generate)* |
| `APP_ENV` | `production` |
| `GOOGLE_API_KEY` | Your Gemini API key |
| `TELEGRAM_BOT_TOKEN` | Your bot token |
| `PORT` | `8000` |

5. Click **Create Web Service**

### 3c. Create WhatsApp Bot Service (Optional)
1. Dashboard → **New** → **Web Service**
2. Connect same repo
3. Settings:
   - **Name**: `kadaigpt-whatsapp`
   - **Root Directory**: `whatsapp-gateway`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
4. **Environment Variables**:
   - `KADAIGPT_BACKEND_URL` = `https://kadaigpt.onrender.com`
   - `PORT` = `3001`
5. Click **Create Web Service**

---

## Step 4: Verify Deployment

After build completes (~3-5 min), check these URLs:

| URL | Expected |
|-----|----------|
| `https://kadaigpt.onrender.com/` | React frontend ✅ |
| `https://kadaigpt.onrender.com/api/health` | Full health status with uptime ✅ |
| `https://kadaigpt.onrender.com/api/ping` | `{"pong": true}` ✅ |
| `https://kadaigpt.onrender.com/api/docs` | Swagger UI ✅ |

---

## Step 5: Set Up UptimeRobot (Keep Alive)

**This is the most important step for 24/7 uptime!**

1. Go to [uptimerobot.com](https://uptimerobot.com) → Sign up (free)
2. Add monitor:
   - URL: `https://kadaigpt.onrender.com/api/ping`
   - Interval: **5 minutes**
3. This ensures the server NEVER sleeps

---

## Step 6: Set Up Telegram Webhook

After deployment, hit this URL once:
```
https://kadaigpt.onrender.com/api/v1/telegram/set-webhook
```

---

## Monitoring Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/api/ping` | Ultra-fast uptime check | `{"pong": true}` |
| `/api/health` | Full system status | Uptime, DB, keepalive, scheduler |
| `/api/info` | App info & features | Version, features list |
| `/api/docs` | Swagger API docs | Interactive API explorer |

---

## Free Tier Limits & Solutions

| Limitation | Details | Solution |
|-----------|---------|----------|
| **Sleep after 15 min** | Free services sleep after inactivity | ✅ Self-ping + UptimeRobot makes it 24/7 |
| **750 hours/month** | Enough for 1 service 24/7 (31 days = 744 hrs) | ✅ WhatsApp service uses remaining ~6 hrs |
| **PostgreSQL 90 days** | Free DB expires after 90 days | Recreate or upgrade ($7/mo) |
| **512 MB RAM** | Per free service | ✅ Enough for KadaiGPT |
| **Cold start ~30s** | First request after deploy | ✅ Frontend shows beautiful loading screen |

---

## Troubleshooting

### Build fails
- Check **Logs** tab in Render dashboard
- Ensure `Dockerfile` exists at repo root
- Check `requirements.txt` has all dependencies

### Database connection errors
- Use the **Internal Database URL** (not External)
- Render auto-injects `DATABASE_URL` if using Blueprint

### Service sleeping despite UptimeRobot
- Verify UptimeRobot monitor is **active** (green checkmark)
- Check the monitor URL is exactly: `https://kadaigpt.onrender.com/api/ping`
- Verify interval is 5 minutes (not 30 minutes)

### WhatsApp QR Code
- Visit `https://kadaigpt-whatsapp.onrender.com` to see the QR
- Scan with WhatsApp on your phone
- Session persists across restarts

---

## Cost Comparison

| Platform | Backend | Database | WhatsApp Bot | Uptime | Total |
|----------|---------|----------|-------------|--------|-------|
| Railway (expired) | $5/mo | $5/mo | $5/mo | ✅ | **$15/mo** |
| Vercel + Neon | $0 | $0 | ❌ Can't run | ✅ | **$0 (limited)** |
| **Render + UptimeRobot** | **$0** | **$0** | **$0** | **✅ 24/7** | **$0/mo ✅** |
| Render Paid | $7/mo | $7/mo | $7/mo | ✅ | **$21/mo** |
