# 🛒 KadaiGPT - AI-Powered Retail Intelligence for Bharat

<div align="center">

![KadaiGPT](https://img.shields.io/badge/KadaiGPT-AI%20Retail%20Intelligence-ff6b35?style=for-the-badge&logo=robot)

### 🏆 National Level Hackathon Project

**"Kadai" (கடை) = Shop in Tamil** | **GPT = Next-Gen AI**

*Transforming 12 Million+ Kirana Stores with Agentic AI*

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-AI-8E75B2?style=flat-square&logo=google)](https://ai.google.dev)

</div>

---

## 🎯 Problem Statement

**India's $900 Billion retail sector** has 12+ million kirana stores, yet:
- 📊 **78%** still use paper-based billing
- 💰 **₹2.3 Lakh Crore** lost annually to inventory mismanagement
- 📱 **65%** shopkeepers prefer regional languages
- 🔌 **40%** of rural areas have unreliable internet

**KadaiGPT** solves these with **Agentic AI** that works offline, speaks regional languages, and thinks like a store owner.

---

## ✨ Unique Features (What Makes Us Stand Out)

### 🤖 **Agentic AI Brain**
Unlike traditional POS systems, KadaiGPT has an **AI Brain** that:
- **Predicts demand** before you run out of stock
- **Suggests optimal prices** based on competition & demand
- **Detects fraud** in unusual billing patterns
- **Auto-generates** GST reports, purchase orders, reminders

### 🗣️ **Multilingual Voice Commerce**
```
"Thambi, Rice 2 kilo bill pannu" → ₹180 billed ✅
"भाई, 5 किलो आटा बिल करो" → ₹275 billed ✅
```
Supports: **Tamil, Hindi, Telugu, Kannada, Malayalam, English**

### 📸 **AI Vision OCR**
- **Scan handwritten bills** and extract data automatically
- **Barcode recognition** without internet
- **Product identification** from images

### 💬 **WhatsApp Business Integration**
- Send bills via WhatsApp (60%+ customers prefer this)
- Automated payment reminders
- Bulk promotional campaigns
- Stock alerts to suppliers

### 📊 **Predictive Analytics Dashboard**
| Feature | Description |
|---------|-------------|
| 📈 Demand Forecasting | Predict next week's sales |
| 🛒 Smart Reordering | Auto-generate purchase orders |
| 👥 Customer Segmentation | RFM analysis for loyalty |
| 💸 Credit Risk Score | Assess customer creditworthiness |
| 🎯 Personalized Offers | AI-suggested promotions |

### 🔌 **Offline-First Architecture**
- **Works without internet** - syncs when connected
- **Edge AI** for voice & OCR on device
- **Conflict-free sync** with CRDT technology

### 🖨️ **Universal Printer Support**
- ESC/POS thermal printers
- Bluetooth mini printers
- PDF generation for email

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        KadaiGPT Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   React PWA   │  │ Voice Engine │  │  OCR Engine  │          │
│  │  (Frontend)   │  │  (Web Speech) │  │   (Gemini)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Service Worker + Offline Sync Layer             │  │
│  │   Cache-First Static ← → Network-First API ← → Queue     │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Backend                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │ Billing  │ │Inventory │ │Analytics │ │ WhatsApp │    │  │
│  │  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │  │ Audit    │ │Notifica- │ │ Backup   │ │ Security │    │  │
│  │  │ Trail    │ │  tions   │ │ & Export │ │Middleware│    │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │     SQLite (Local) ←→ PostgreSQL (Cloud) + Redis Cache    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 🔒 **Production-Ready Infrastructure**
| Feature | Implementation |
|---------|---------------|
| 🛡️ Rate Limiting | Per-IP throttling with auth-aware limits |
| 📋 Audit Trail | Full CRUD logging with old/new value diff |
| 🔔 In-App Notifications | DB-backed alerts for low stock, payments, system events |
| 💾 Data Backup | One-click JSON export of entire store data |
| 📱 PWA + Offline | Service Worker, manifest.json, background sync |
| 🔐 Security Headers | HSTS, CSP, X-Frame-Options, nosniff |
| 📊 DB Health Check | Pool stats, latency monitoring, auto-indexes |
| 🗑️ Soft Deletes | Recoverable customer/product deletion |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/yourusername/KadaiGPT.git
cd KadaiGPT

# Backend — terminal 1 (FastAPI on :8000, SQLite locally)
cd backend
pip install -r requirements.txt
cp .env.example .env              # add GOOGLE_API_KEY etc.
set PYTHONIOENCODING=utf-8        # Windows: required, or emoji in logs crash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend — terminal 2 (Vite dev server on :5173, proxies /api to :8000)
cd frontend
npm install
npm run dev
```

**Open http://localhost:5173** 🎉 — register a new store from the Login screen (no seeded demo account; Owner sign-up creates your store + first user).

For a single-server production-style run, build the frontend and let FastAPI serve it:
```bash
cd frontend && npm run build      # outputs frontend/dist
cd ../backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 🔐 Roles & Staff Access

After registering as Owner, go to **Settings → Staff Management** to add Staff (Cashier, Inventory Manager, etc.) — each gets a Staff ID for the dedicated staff-login tab. Roles are enforced both in the UI (per-role navigation) and on every API endpoint (RBAC).

---

## 🧪 Testing

```bash
# Backend unit/integration tests (pytest)
cd backend && pytest

# Frontend E2E (Playwright — desktop chromium + mobile/Pixel 5 viewport)
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:ui   # interactive UI mode
```

---

## 🌐 Deploy (Vercel + Supabase)

KadaiGPT ships as a **single Vercel deployment** — `vercel.json` builds the React app to `frontend/dist` and runs the FastAPI backend as a serverless function (`api/index.py`) behind `/api/*`.

1. Push to GitHub, then [import the repo on Vercel](https://vercel.com/new)
2. Create a free [Supabase](https://supabase.com) Postgres project and copy the **Transaction Pooler** connection string (port 6543)
3. In Vercel → Project Settings → Environment Variables, set for **both Production and Preview**:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Supabase pooler connection string |
   | `SECRET_KEY` / `JWT_SECRET_KEY` | strong random values — app fails to boot without them in production |
   | `GOOGLE_API_KEY` | Gemini API key (OCR & AI features) |
   | `APP_ENV` | `production` |

4. Deploy — Vercel runs `cd frontend && npm install && npm run build`, then serves `/api/*` from `api/index.py` and everything else from `frontend/dist`

---

## 📊 Market Impact

| Metric | Value |
|--------|-------|
| Target Market | 12M+ Kirana Stores |
| Market Size | $900 Billion |
| Problem | 78% still paper-based |
| Solution | Affordable AI POS |
| Business Model | Freemium + ₹299/month Pro |

---

## 🏆 Why KadaiGPT Will Win

| Feature | Traditional POS | KadaiGPT |
|---------|-----------------|----------|
| Voice Commands | ❌ | ✅ Tamil, Hindi, Telugu |
| Offline Mode | ❌ | ✅ Full functionality |
| AI Predictions | ❌ | ✅ Demand forecasting |
| WhatsApp Integration | ❌ | ✅ Bills, reminders |
| OCR Scanning | ❌ | ✅ Handwritten bills |
| Price | ₹15,000+ | ₹0 (Freemium) |

---

## 👥 Team

| Role | Expertise |
|------|-----------|
| AI/ML Engineer | Gemini, Voice AI, OCR |
| Full Stack Developer | React, FastAPI, PWA |
| Product Designer | UX for Bharat |

---

## 📄 License

MIT License - Open Source for Bharat 🇮🇳

---

<div align="center">

### 🙏 *"Kadai சிறியதாக இருக்கலாம், கனவுகள் பெரியது"*
### *"The shop may be small, but dreams are big"*

**Built with ❤️ for Indian Retail**

[Live Demo](https://kadaigpt.vercel.app) • [API Docs](/api/docs) • [Video Demo](#)

</div>
