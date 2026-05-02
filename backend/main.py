"""
╔═══════════════════════════════════════════════════════════════════╗
║                         KADAIGPT                                 ║
║     India's First Agentic AI-Powered Retail Operations Platform  ║
║                                                                   ║
║     "Bill Karo, AI Sambhalo" (Bill it, AI handles it)            ║
╚═══════════════════════════════════════════════════════════════════╝

Main FastAPI Application Entry Point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import time

from app.config import settings
from app.database import init_db
from app.routers import auth_router, products_router, bills_router, ocr_router, print_router, customers_router, suppliers_router, whatsapp_router, dashboard_router
from app.routers.analytics import router as analytics_router

# Import security middleware (optional - can be disabled)
try:
    from app.middleware.security import SecurityMiddleware
    SECURITY_MIDDLEWARE_AVAILABLE = True
except ImportError:
    SECURITY_MIDDLEWARE_AVAILABLE = False
from app.agents import offline_agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 Starting KadaiGPT...")
    print("═" * 50)
    
    # Initialize database
    await init_db()
    print("✅ Database initialized")
    
    # Create upload directories
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "ocr_images"), exist_ok=True)
    print("✅ Upload directories ready")
    
    # Start offline agent network monitoring
    await offline_agent.start_network_monitoring()
    print("✅ Network monitoring started")
    
    # Debug: Print JWT config
    jwt_key = settings.jwt_secret_key
    print(f"🔐 JWT Key (first 10 chars): {jwt_key[:10]}...")
    print(f"🔐 JWT Algorithm: {settings.jwt_algorithm}")
    
    print("═" * 50)
    print("🎉 KadaiGPT is ready!")
    print(f"📍 API running at: http://localhost:8000")
    print(f"📚 Docs available at: http://localhost:8000/docs")
    print("═" * 50)
    
    yield
    
    # Shutdown
    print("\n🛑 Shutting down KadaiGPT...")
    await offline_agent.stop_network_monitoring()
    print("✅ Cleanup complete")


# Create FastAPI application
app = FastAPI(
    title="KadaiGPT",
    description="""
    # 🛒 KadaiGPT - AI-Powered Retail Intelligence Platform
    
    India's first intelligent billing and retail management system powered by autonomous AI agents.
    
    ## 🤖 AI Agents
    
    - **🖨️ Print Agent**: Autonomous silent printing with fallback and retry logic
    - **📷 OCR Agent**: Handwritten bill digitization with 94%+ accuracy
    - **📶 Offline Agent**: Seamless offline-online synchronization
    - **📦 Inventory Agent**: Predictive stock management and reorder suggestions
    
    ## 🎯 Key Features
    
    - Real-time billing with instant receipt printing
    - Handwritten bill to digital conversion
    - Full offline operation capability
    - Smart inventory tracking and alerts
    - GST-compliant invoicing
    - Multi-language support (Hindi, Tamil, Telugu, English)
    
    ## 📊 Analytics
    
    - Real-time sales dashboard
    - Hourly/daily/weekly reports
    - AI-powered business insights
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred",
            "error": str(exc) if settings.debug else "Internal server error"
        }
    )


# Include routers
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(products_router, prefix=settings.api_v1_prefix)
app.include_router(bills_router, prefix=settings.api_v1_prefix)
app.include_router(ocr_router, prefix=settings.api_v1_prefix)
app.include_router(print_router, prefix=settings.api_v1_prefix)
app.include_router(customers_router, prefix=settings.api_v1_prefix)
app.include_router(suppliers_router, prefix=settings.api_v1_prefix)
app.include_router(whatsapp_router, prefix=settings.api_v1_prefix)
app.include_router(dashboard_router, prefix=settings.api_v1_prefix)
app.include_router(analytics_router, prefix=settings.api_v1_prefix)

# Include notifications router
from app.routers.notifications import router as notifications_router
app.include_router(notifications_router, prefix=settings.api_v1_prefix)

# Include bulk operations router
from app.routers.bulk import router as bulk_router
app.include_router(bulk_router, prefix=settings.api_v1_prefix)

# Include scheduler router
from app.services.scheduler import router as scheduler_router
app.include_router(scheduler_router, prefix=settings.api_v1_prefix)

# Include AI Agents router
from app.routers.agents import router as agents_router
app.include_router(agents_router, prefix=settings.api_v1_prefix)
print("🤖 AI Agents router enabled")

# Add security middleware if available
if SECURITY_MIDDLEWARE_AVAILABLE:
    app.add_middleware(SecurityMiddleware)
    print("🔒 Security middleware enabled")


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "KadaiGPT",
        "version": "1.0.0"
    }


# Root endpoint
@app.get("/")
async def root():
    """Welcome endpoint"""
    return {
        "message": "🛒 Welcome to KadaiGPT!",
        "tagline": "Bill Karo, AI Sambhalo",
        "description": "India's First Agentic AI-Powered Retail Operations Platform",
        "docs": "/docs",
        "api_prefix": settings.api_v1_prefix,
        "features": [
            "🖨️ Smart Silent Printing",
            "📷 Handwritten Bill OCR",
            "📶 Offline-First Operations",
            "📦 AI Inventory Management",
            "📊 Real-time Analytics"
        ]
    }


# Agent status endpoint
@app.get("/agents/status")
async def get_agents_status():
    """Get status of all AI agents"""
    from app.agents import print_agent, ocr_agent, inventory_agent
    
    return {
        "agents": {
            "print_agent": {
                "name": print_agent.agent_name,
                "status": "active",
                "cached_printers": len(print_agent.cached_printers)
            },
            "ocr_agent": ocr_agent.get_agent_stats(),
            "offline_agent": offline_agent.get_status(),
            "inventory_agent": inventory_agent.get_agent_stats()
        }
    }


# Static files for uploads (in production, use CDN/S3)
if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
