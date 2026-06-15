"""
KadaiGPT - Platform Admin Routers
Aggregates all /admin/* sub-routers into a single router. Registered in
app.main under the /api/v1 prefix, giving /api/v1/admin/*.
"""

from fastapi import APIRouter

from app.routers.admin.auth import router as admin_auth_router
from app.routers.admin.stores import router as admin_stores_router
from app.routers.admin.users import router as admin_users_router

router = APIRouter()
router.include_router(admin_auth_router)
router.include_router(admin_stores_router)
router.include_router(admin_users_router)

__all__ = ["router"]
