"""
KadaiGPT - Login History Service

Records every login attempt (success and failure) across all stores so the
platform admin dashboard can show a cross-store login activity feed.

DESIGN RULE: recording a login event must never break the login flow. If the
write fails for any reason, log and continue — availability of auth comes first.
"""

import logging
from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LoginHistory

logger = logging.getLogger("KadaiGPT.LoginHistory")


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Best-effort real client IP, preferring the first hop in X-Forwarded-For
    (mirrors SecurityASGIMiddleware's logic for proxied/serverless deployments)."""
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


async def record_login_event(
    db: AsyncSession,
    *,
    email_or_staff_id: str,
    success: bool,
    method: str,
    user=None,
    role: Optional[str] = None,
    failure_reason: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """Persist a single login attempt.

    `user` (if provided) is an ORM User or a SimpleNamespace with
    id/store_id/full_name/role attributes — used to fill in details for
    successful logins. `role`/`failure_reason` let callers describe failed
    attempts where no user was resolved.
    """
    user_role = role
    if user_role is None and getattr(user, "role", None) is not None:
        user_role = getattr(user.role, "value", user.role)

    entry = LoginHistory(
        user_id=getattr(user, "id", None),
        store_id=getattr(user, "store_id", None),
        email_or_staff_id=email_or_staff_id,
        role=user_role,
        full_name=getattr(user, "full_name", None),
        login_method=method,
        success=success,
        failure_reason=failure_reason,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent") if request else None,
    )

    try:
        db.add(entry)
        await db.commit()
    except Exception as e:
        logger.warning(f"[LoginHistory] Failed to record login event: {e}")
        await db.rollback()
