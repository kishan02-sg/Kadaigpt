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

# Frontend
cd frontend && npm install && npm run build && cd ..

# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env  # Add your API keys

# Run (serves both frontend & API)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Open http://localhost:8000** 🎉

---

## 📱 Demo Credentials

| Mode | Username | Password |
|------|----------|----------|
| Demo | Click "Try Demo Mode" | No password needed |
| Admin | admin | admin123 |

---

## 🌐 Deploy (Railway - FREE)

1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. Deploy from GitHub
4. Add environment variables:
   - `SECRET_KEY` = your-secret
   - `GOOGLE_API_KEY` = gemini-api-key
5. Done! 🚀

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

[Live Demo](https://kadaigpt.up.railway.app) • [API Docs](/api/docs) • [Video Demo](#)

</div>
