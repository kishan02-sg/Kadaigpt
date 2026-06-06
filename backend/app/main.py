"""
KadaiGPT - Main Application Entry Point
India's First Agentic AI-Powered Retail Intelligence Platform

"Kadai" (கடை) = Shop in Tamil | GPT = Next-Gen AI
Tagline: "கடை சிறியது, கனவுகள் பெரியது" (The shop may be small, but dreams are big)

This backend serves both the API and the React frontend from a single host.
"""

import os
import time
from pathlib import Path
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager

from sqlalchemy import text
from app.config import get_settings
from app.database import engine, Base, check_db_health, init_db, run_migrations, create_indexes, is_sqlite
from app.routers import (
    auth_router,
    products_router,
    bills_router,
    ocr_router,
    print_router,
    customers_router,
    suppliers_router,
    whatsapp_router,
    dashboard_router,
    analytics_router,
    notifications_router
)
from app.routers.bulk import router as bulk_router
from app.routers.telegram import router as telegram_router
from app.services.scheduler import router as scheduler_router
from app.routers.subscription import router as subscription_router
from app.routers.gst import router as gst_router
from app.routers.credit import router as credit_router
from app.routers.audit import router as audit_router
from app.routers.inapp_notifications import router as inapp_notifications_router
from app.routers.backup import router as backup_router
from app.routers.privacy import router as privacy_router
from app.services.keepalive import keepalive
from app.services.scheduler import scheduler, register_default_tasks
from app.middleware.security import rate_limiter, get_rate_limit_type, RATE_LIMITS, audit_logger
import uuid

settings = get_settings()

# Track server start time for uptime reporting
SERVER_START_TIME = time.time()

# Path to frontend build directory
FRONTEND_BUILD_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events"""
    # Startup
    print("🚀 KadaiGPT Starting up...")
    print("   கடை சிறியது, கனவுகள் பெரியது")
    print("   'The shop may be small, but dreams are big'")
    
    # Create database tables + run migrations + create indexes
    await init_db()
    
    # Skip background services in serverless (Vercel) — they can't run there
    if not settings.is_serverless:
        # Start keep-alive service (prevents Render free tier from sleeping)
        await keepalive.start()
        
        # Start task scheduler
        register_default_tasks()
        await scheduler.start()
        print("✅ Scheduler started with", len(scheduler.tasks), "tasks")
        
        # Check if frontend build exists
        if FRONTEND_BUILD_DIR.exists():
            print(f"✅ Frontend build found at {FRONTEND_BUILD_DIR}")
        else:
            print(f"⚠️ Frontend build not found at {FRONTEND_BUILD_DIR}")
            print("   Run 'npm run build' in the frontend directory")
    else:
        print("☁️ Running in serverless mode — skipping keepalive & scheduler")
    
    print("🎉 KadaiGPT is ready!")
    
    yield
    
    # Shutdown
    print("👋 KadaiGPT shutting down... நன்றி!")
    if not settings.is_serverless:
        await keepalive.stop()
        await scheduler.stop()
    await engine.dispose()


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
    # 🛒 KadaiGPT - AI-Powered Retail Intelligence for Bharat
    
    **"Kadai" (கடை) = Shop in Tamil | GPT = Next-Gen AI**
    
    ## Features
    - 🗣️ **Multilingual Voice Commands** - Tamil, Hindi, Telugu, English
    - 📸 **AI OCR** - Scan handwritten bills instantly
    - 📊 **Predictive Analytics** - Demand forecasting & smart reordering
    - 💬 **WhatsApp Integration** - Bills, reminders, promotions
    - 🔌 **Offline-First** - Works without internet
    - 🖨️ **Thermal Printing** - ESC/POS compatible
    
    ## National Level Hackathon Project 🏆
    Transforming 12 Million+ Kirana Stores with Agentic AI
    """,
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# ═══════════════════════════════════════════════════════════════════
# CORS — Production-safe origins (NO wildcard "*")
# ═══════════════════════════════════════════════════════════════════
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://kadaigpt.vercel.app",
    "https://kadaigpt-main.vercel.app",
    "https://kadaigpt.onrender.com",
]

# In development, allow all origins for convenience
if settings.app_env == "development":
    ALLOWED_ORIGINS.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)


# ═══════════════════════════════════════════════════════════════════
# Security Middleware — Pure ASGI (no BaseHTTPMiddleware)
# BaseHTTPMiddleware / @app.middleware("http") run handlers in a threadpool,
# which breaks SQLAlchemy async greenlet context → MissingGreenlet error.
# Using raw ASGI middleware preserves the greenlet.
# ═══════════════════════════════════════════════════════════════════
from starlette.types import ASGIApp, Scope, Receive, Send
from starlette.responses import Response as StarletteResponse

class SecurityASGIMiddleware:
    """Pure ASGI middleware for rate limiting + security headers.
    Does NOT use BaseHTTPMiddleware, so it preserves SQLAlchemy async greenlet context.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        request_id = str(uuid.uuid4())[:8]
        path = scope.get("path", "")
        
        # Rate limiting (skip health/docs)
        if not path.startswith(("/api/ping", "/api/health", "/api/docs", "/api/redoc", "/api/openapi")):
            # Get the REAL client IP. On Vercel/proxies, scope["client"] is the
            # shared proxy address — using it would put every user in ONE rate-limit
            # bucket, so one noisy client (or load test) throttles everyone. Prefer
            # the first hop in X-Forwarded-For.
            client_ip = "unknown"
            headers = dict(scope.get("headers") or [])
            xff = headers.get(b"x-forwarded-for")
            if xff:
                client_ip = xff.decode().split(",")[0].strip()
            else:
                client_addr = scope.get("client")
                client_ip = client_addr[0] if client_addr else "unknown"

            limit_type = get_rate_limit_type(path)
            limits = RATE_LIMITS.get(limit_type, RATE_LIMITS['api'])
            allowed, remaining = rate_limiter.check_rate_limit(
                f"{client_ip}:{limit_type}",
                max_requests=limits['max'],
                window_seconds=limits['window']
            )
            if not allowed:
                resp = JSONResponse(
                    status_code=429,
                    content={
                        "error": True,
                        "message": "Too many requests. Please slow down.",
                        "retry_after": limits['window']
                    },
                    headers={"Retry-After": str(limits['window'])}
                )
                await resp(scope, receive, send)
                return

        # Intercept response headers
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                extra = [
                    (b"x-request-id", request_id.encode()),
                    (b"x-response-time", f"{(time.time() - start_time)*1000:.1f}ms".encode()),
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"x-xss-protection", b"1; mode=block"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    (b"permissions-policy", b"camera=(), microphone=(self), geolocation=()"),
                    # Content Security Policy — baseline. 'unsafe-inline' is required by the
                    # current React build (inline styles/Vite). Tighten with nonces later.
                    (b"content-security-policy",
                     b"default-src 'self'; "
                     b"script-src 'self' 'unsafe-inline'; "
                     b"style-src 'self' 'unsafe-inline'; "
                     b"img-src 'self' data: blob:; "
                     b"font-src 'self' data:; "
                     b"connect-src 'self' https:; "
                     b"frame-ancestors 'none'; "
                     b"base-uri 'self'; "
                     b"form-action 'self'"),
                ]
                # HSTS only over HTTPS / in production — avoids breaking local http dev.
                if settings.app_env == "production" or settings.is_serverless:
                    extra.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    )
                message["headers"] = list(message.get("headers", [])) + extra
            await send(message)

        await self.app(scope, receive, send_with_headers)

app.add_middleware(SecurityASGIMiddleware)


# API Health check endpoint — production-grade
@app.get("/api/health")
async def health_check():
    """Comprehensive health check with DB pool stats, uptime, and keepalive status."""
    uptime_seconds = time.time() - SERVER_START_TIME
    hours = int(uptime_seconds // 3600)
    minutes = int((uptime_seconds % 3600) // 60)
    
    # Detailed DB health check with pool stats
    db_health = await check_db_health()
    
    return {
        "status": "healthy",
        "app": settings.app_name,
        "tagline": settings.app_tagline,
        "version": "2.0.0",
        "environment": settings.app_env,
        "uptime": f"{hours}h {minutes}m",
        "uptime_seconds": int(uptime_seconds),
        "server_started": datetime.fromtimestamp(SERVER_START_TIME).isoformat(),
        "database": db_health,
        "keepalive": keepalive.get_status(),
        "scheduler": {
            "running": scheduler.running,
            "tasks": len(scheduler.tasks)
        },
        "features": {
            "voice_commands": settings.enable_voice_commands,
            "multilingual": settings.enable_multilingual,
            "predictive_analytics": settings.enable_predictive_analytics,
            "whatsapp": settings.enable_whatsapp_integration
        },
        "security": {
            "cors_restricted": settings.app_env == "production",
            "rate_limiting": True,
            "security_headers": True
        }
    }


# Ultra-lightweight ping endpoint for external monitors (UptimeRobot, etc.)
@app.get("/api/ping")
async def ping():
    """Minimal response for uptime monitors. Returns instantly."""
    return {"pong": True, "ts": int(time.time())}


@app.post("/api/setup-db")
async def setup_database(request: Request):
    """One-time endpoint to create all database tables in Supabase.

    Protected: requires the X-Setup-Secret header to match the SECRET_KEY env var.
    This prevents anonymous callers from triggering schema operations on the
    public deployment. Call once after first deployment to initialize the schema.
    """
    import hmac
    provided = request.headers.get("X-Setup-Secret", "")
    expected = settings.secret_key or ""
    # Constant-time compare; reject if no real secret is configured.
    if not expected or not hmac.compare_digest(provided, expected):
        return JSONResponse(
            status_code=401,
            content={"status": "error", "message": "Unauthorized. Provide a valid X-Setup-Secret header."}
        )
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return {"status": "ok", "message": "Database tables created successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}


# API Info endpoint
@app.get("/api/info")
async def app_info():
    return {
        "name": "KadaiGPT",
        "tamil_name": "கடைGPT",
        "tagline": "AI-Powered Retail Intelligence for Bharat",
        "tamil_tagline": "கடை சிறியது, கனவுகள் பெரியது",
        "version": "2.0.0",
        "hackathon": "National Level 2026",
        "team": "KadaiGPT Team",
        "features": [
            "Multilingual Voice Commands (Tamil, Hindi, Telugu, English)",
            "AI-Powered OCR for Handwritten Bills",
            "Predictive Demand Forecasting",
            "WhatsApp Business Integration",
            "Offline-First PWA Architecture",
            "GST-Compliant Billing",
            "Customer Loyalty Program",
            "Smart Inventory Management"
        ]
    }


# Include API routers with /api/v1 prefix
app.include_router(auth_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(bills_router, prefix="/api/v1")
app.include_router(ocr_router, prefix="/api/v1")
app.include_router(print_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(suppliers_router, prefix="/api/v1")
app.include_router(whatsapp_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(bulk_router, prefix="/api/v1")
app.include_router(scheduler_router, prefix="/api/v1")
app.include_router(telegram_router, prefix="/api/v1")
app.include_router(subscription_router, prefix="/api/v1")
app.include_router(gst_router, prefix="/api/v1")
app.include_router(credit_router, prefix="/api/v1")
app.include_router(audit_router)  # Already has /api/audit prefix
app.include_router(inapp_notifications_router)  # Already has /api/notifications prefix
app.include_router(backup_router, prefix="/api/v1")  # /api/v1/backup
app.include_router(privacy_router, prefix="/api/v1")  # /api/v1/privacy


# Serve static files from frontend build (assets like JS, CSS, images)
if FRONTEND_BUILD_DIR.exists():
    # Serve static assets
    assets_dir = FRONTEND_BUILD_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    # Serve other static files (favicon, etc.)
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR)), name="static")


# Catch-all route to serve the React app for client-side routing
@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    """
    Serve the React SPA for all non-API routes.
    This enables client-side routing in the React app.
    """
    # If it's an API request that wasn't matched, return 404
    if full_path.startswith("api/"):
        return JSONResponse(
            status_code=404,
            content={"error": True, "message": "API endpoint not found"}
        )
    
    # Check if requesting a specific file
    file_path = FRONTEND_BUILD_DIR / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    
    # For all other routes, serve the React app's index.html
    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    # If frontend build doesn't exist, show helpful message
    return JSONResponse(
        status_code=200,
        content={
            "app": "KadaiGPT",
            "tamil": "கடைGPT",
            "tagline": "AI-Powered Retail Intelligence for Bharat",
            "message": "Frontend not built. Run 'npm run build' in the frontend directory.",
            "api_docs": "/api/docs",
            "health": "/api/health",
            "info": "/api/info"
        }
    )


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    # Log the error for debugging (never leak sensitive info in production)
    print(f"[Error] {type(exc).__name__}: {str(exc)}")
    
    # Audit log the error
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.log_event(
        event_type="server_error",
        user_id=None,
        ip_address=client_ip,
        path=str(request.url.path),
        method=request.method,
        status_code=500,
        details={"error": type(exc).__name__}
    )
    
    # Log error server-side but don't expose internals to client
    import logging
    logging.getLogger(__name__).error(f"Unhandled error on {request.url.path}: {type(exc).__name__}: {exc}")
    
    message = str(exc) if settings.app_env == "development" else "An unexpected error occurred"
    
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": message,
            "detail": "Internal server error"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
