"""
KadaiGPT - Platform Admin: Users
Cross-store user browsing (search/role/store/active filters), detail with
recent login history, and activate/deactivate (revokes tokens on deactivate,
guards against deactivating the last active ADMIN).
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditTrail, LoginHistory, Store, User
from app.constants.roles import UserRole
from app.routers.admin._common import require_admin
from app.services.login_history import get_client_ip

router = APIRouter(prefix="/admin/users", tags=["Admin - Users"])


def _serialize_user(u: User, store_name: Optional[str] = None) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if u.role else None,
        "store_id": u.store_id,
        "store_name": store_name,
        "staff_id": u.staff_id,
        "phone": u.phone,
        "is_active": u.is_active,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("")
async def list_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cross-store user listing. Never serializes password_hash."""
    query = select(User)
    if search:
        like = f"%{search}%"
        query = query.where(or_(User.email.ilike(like), User.full_name.ilike(like), User.staff_id.ilike(like)))
    if role:
        try:
            role_enum = UserRole(role.upper())
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        query = query.where(User.role == role_enum)
    if store_id is not None:
        query = query.where(User.store_id == store_id)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(User.id.desc()).offset(offset).limit(limit)
    users = (await db.execute(query)).scalars().all()

    store_ids = {u.store_id for u in users if u.store_id is not None}
    store_names = {}
    if store_ids:
        rows = (await db.execute(select(Store.id, Store.name).where(Store.id.in_(store_ids)))).all()
        store_names = {row[0]: row[1] for row in rows}

    return {
        "total": total,
        "users": [_serialize_user(u, store_names.get(u.store_id)) for u in users],
        "pagination": {"limit": limit, "offset": offset, "total": total, "has_more": (offset + limit) < total},
    }


@router.get("/{user_id}")
async def get_user_detail(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """User detail plus the 5 most recent LoginHistory entries."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    store_name = None
    if user.store_id is not None:
        store_name = (await db.execute(select(Store.name).where(Store.id == user.store_id))).scalar_one_or_none()

    recent_logins = (await db.execute(
        select(LoginHistory)
        .where(LoginHistory.user_id == user.id)
        .order_by(desc(LoginHistory.created_at))
        .limit(5)
    )).scalars().all()

    detail = _serialize_user(user, store_name)
    detail["recent_logins"] = [
        {
            "id": lh.id,
            "success": lh.success,
            "login_method": lh.login_method,
            "failure_reason": lh.failure_reason,
            "ip_address": lh.ip_address,
            "created_at": lh.created_at.isoformat() if lh.created_at else None,
        }
        for lh in recent_logins
    ]
    return detail


async def _set_user_active(user_id: int, active: bool, request: Request, current_user: User, db: AsyncSession):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not active and user.role == UserRole.ADMIN:
        other_active_admins = (await db.execute(
            select(func.count(User.id)).where(
                User.role == UserRole.ADMIN,
                User.is_active.is_(True),
                User.id != user.id,
            )
        )).scalar() or 0
        if other_active_admins == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate the last active admin account")

    old_active = user.is_active
    user.is_active = active
    if not active:
        user.tokens_valid_after = datetime.utcnow()  # revoke existing sessions

    db.add(AuditTrail(
        store_id=user.store_id,
        user_id=current_user.id,
        action="admin_user_activate" if active else "admin_user_deactivate",
        entity_type="user",
        entity_id=user.id,
        old_values={"is_active": old_active},
        new_values={"is_active": active},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ))
    await db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _set_user_active(user_id, True, request, current_user, db)


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _set_user_active(user_id, False, request, current_user, db)
