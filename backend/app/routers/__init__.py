"""
KadaiGPT - Routers Package
"""

from app.routers.auth import router as auth_router
from app.routers.products import router as products_router
from app.routers.bills import router as bills_router
from app.routers.ocr import router as ocr_router
from app.routers.print import router as print_router
from app.routers.customers import router as customers_router
from app.routers.suppliers import router as suppliers_router
from app.routers.whatsapp import router as whatsapp_router
from app.routers.dashboard import router as dashboard_router
from app.routers.analytics import router as analytics_router
from app.routers.notifications import router as notifications_router

__all__ = [
    "auth_router",
    "products_router", 
    "bills_router",
    "ocr_router",
    "print_router",
    "customers_router",
    "suppliers_router",
    "whatsapp_router",
    "dashboard_router",
    "analytics_router",
    "notifications_router"
]


