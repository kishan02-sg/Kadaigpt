"""
KadaiGPT - Platform Admin Authentication
Bootstrap the first admin account, admin-only login, and an RBAC smoke test.
"""

import hmac
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import AuditTrail, User
from app.constants.roles import UserRole
from app.routers.auth import create_access_token, get_password_hash, verify_password
from app.routers.admin._common import require_admin
from app.schemas import Token
from app.services.login_history import get_client_ip, record_login_event
from app.utils.password import validate_password_strength

router = APIRouter(prefix="/admin", tags=["Admin - Auth"])
logger = logging.getLogger("KadaiGPT.AdminAuth")


class AdminBootstrapRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2)


@router.post("/bootstrap", response_model=Token)
async def bootstrap_admin(
    payload: AdminBootstrapRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create the first platform ADMIN account.

    Gated by the X-Bootstrap-Secret header (compared against
    ADMIN_BOOTSTRAP_SECRET). Returns 404 if the secret isn't configured
    (hides the endpoint's existence), 401 on mismatch, and 409 if an
    ADMIN account already exists (idempotency guard).
    """
    if not settings.admin_bootstrap_secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    provided = request.headers.get("x-bootstrap-secret", "")
    if not hmac.compare_digest(provided, settings.admin_bootstrap_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bootstrap secret")

    existing_admin = await db.execute(select(User).where(User.role == UserRole.ADMIN))
    if existing_admin.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An admin account already exists")

    validate_password_strength(payload.password)

    email = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        store_id=None,
        email=email,
        full_name=payload.full_name,
        password_hash=get_password_hash(payload.password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.flush()

    db.add(AuditTrail(
        store_id=None,
        user_id=user.id,
        action="admin_bootstrap",
        entity_type="user",
        entity_id=user.id,
        new_values={"email": email, "role": UserRole.ADMIN.value},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ))
    await db.commit()
    await db.refresh(user)

    await record_login_event(
        db, user=user, email_or_staff_id=email, success=True, method="admin", request=request,
    )

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=Token)
async def admin_login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only login. Rejects valid credentials for non-ADMIN accounts with 403."""
    email = form_data.username.lower().strip()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        await record_login_event(
            db, email_or_staff_id=email, success=False, method="admin",
            failure_reason="not_found" if not user else "bad_password", request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.role != UserRole.ADMIN:
        await record_login_event(
            db, user=user, email_or_staff_id=email, success=False, method="admin",
            failure_reason="not_admin", request=request,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account does not have admin access.")

    if not user.is_active:
        await record_login_event(
            db, user=user, email_or_staff_id=email, success=False, method="admin",
            failure_reason="inactive", request=request,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive")

    user.last_login = datetime.utcnow()
    await db.commit()

    await record_login_event(
        db, user=user, email_or_staff_id=email, success=True, method="admin", request=request,
    )

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token, token_type="bearer")


@router.get("/ping")
async def admin_ping(current_user: User = Depends(require_admin)):
    """RBAC smoke test — 200 for ADMIN, 403 for any other role, 401 if unauthenticated."""
    return {"status": "ok", "admin": current_user.email}
