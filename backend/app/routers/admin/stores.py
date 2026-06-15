"""
KadaiGPT - Platform Admin: Stores
Cross-store browsing (search/status/plan filters), per-store detail and user
list, and the suspend/activate lifecycle (status state machine + AuditTrail).
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditTrail, Bill, Product, Store, User
from app.models.subscription import Subscription
from app.constants.roles import UserRole
from app.routers.admin._common import require_admin
from app.services.login_history import get_client_ip

router = APIRouter(prefix="/admin/stores", tags=["Admin - Stores"])


def _serialize_user_brief(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if u.role else None,
        "staff_id": u.staff_id,
        "is_active": u.is_active,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _serialize_subscription(sub: Optional[Subscription]) -> dict:
    if not sub:
        return {"tier": "free", "status": None, "billing_cycle": None, "current_period_end": None}
    return {
        "tier": sub.tier.value,
        "status": sub.status.value,
        "billing_cycle": sub.billing_cycle,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }


@router.get("")
async def list_stores(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    plan: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cross-store listing with search/status/plan filters and pagination."""
    query = select(Store)
    if search:
        like = f"%{search}%"
        query = query.where(or_(Store.name.ilike(like), Store.phone.ilike(like), Store.gst_number.ilike(like)))
    if status_filter:
        query = query.where(Store.status == status_filter)
    if plan:
        query = query.join(Subscription, Subscription.store_id == Store.id).where(Subscription.tier == plan)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Store.id.desc()).offset(offset).limit(limit)
    stores = (await db.execute(query)).scalars().all()

    store_ids = [s.id for s in stores]

    owners = {}
    user_counts = {}
    subs = {}
    if store_ids:
        owner_rows = (await db.execute(
            select(User.store_id, User.id, User.full_name, User.email)
            .where(User.store_id.in_(store_ids), User.role == UserRole.OWNER)
        )).all()
        for row in owner_rows:
            owners[row.store_id] = {"id": row.id, "full_name": row.full_name, "email": row.email}

        count_rows = (await db.execute(
            select(User.store_id, func.count(User.id))
            .where(User.store_id.in_(store_ids))
            .group_by(User.store_id)
        )).all()
        user_counts = {row[0]: row[1] for row in count_rows}

        sub_rows = (await db.execute(
            select(Subscription).where(Subscription.store_id.in_(store_ids))
        )).scalars().all()
        subs = {sub.store_id: sub for sub in sub_rows}

    items = [
        {
            "id": s.id,
            "name": s.name,
            "business_type": s.business_type,
            "phone": s.phone,
            "status": s.status or "active",
            "owner": owners.get(s.id),
            "user_count": user_counts.get(s.id, 0),
            "subscription": _serialize_subscription(subs.get(s.id)),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in stores
    ]

    return {
        "total": total,
        "stores": items,
        "pagination": {"limit": limit, "offset": offset, "total": total, "has_more": (offset + limit) < total},
    }


@router.get("/{store_id}")
async def get_store_detail(
    store_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Store detail: profile, user list, product/bill counts, subscription."""
    store = (await db.execute(select(Store).where(Store.id == store_id))).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    users = (await db.execute(select(User).where(User.store_id == store_id))).scalars().all()
    product_count = (await db.execute(
        select(func.count(Product.id)).where(Product.store_id == store_id)
    )).scalar() or 0
    bill_count = (await db.execute(
        select(func.count(Bill.id)).where(Bill.store_id == store_id)
    )).scalar() or 0
    sub = (await db.execute(
        select(Subscription).where(Subscription.store_id == store_id)
    )).scalar_one_or_none()

    return {
        "id": store.id,
        "name": store.name,
        "address": store.address,
        "phone": store.phone,
        "gst_number": store.gst_number,
        "business_type": store.business_type,
        "status": store.status or "active",
        "currency": store.currency,
        "created_at": store.created_at.isoformat() if store.created_at else None,
        "users": [_serialize_user_brief(u) for u in users],
        "counts": {"products": product_count, "bills": bill_count, "users": len(users)},
        "subscription": _serialize_subscription(sub),
    }


@router.get("/{store_id}/users")
async def get_store_users(
    store_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """All users belonging to a single store."""
    store = (await db.execute(select(Store).where(Store.id == store_id))).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    users = (await db.execute(select(User).where(User.store_id == store_id))).scalars().all()
    return [_serialize_user_brief(u) for u in users]


async def _set_store_status(store_id: int, new_status: str, request: Request, current_user: User, db: AsyncSession):
    store = (await db.execute(select(Store).where(Store.id == store_id))).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    old_status = store.status or "active"
    store.status = new_status

    db.add(AuditTrail(
        store_id=store.id,
        user_id=current_user.id,
        action=f"admin_store_{new_status}",
        entity_type="store",
        entity_id=store.id,
        old_values={"status": old_status},
        new_values={"status": new_status},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ))
    await db.commit()
    return {"id": store.id, "status": store.status}


@router.post("/{store_id}/suspend")
async def suspend_store(
    store_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend a store. Idempotent — re-suspending an already-suspended store is a no-op status-wise."""
    return await _set_store_status(store_id, "suspended", request, current_user, db)


@router.post("/{store_id}/activate")
async def activate_store(
    store_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reactivate a suspended (or trial/closed) store."""
    return await _set_store_status(store_id, "active", request, current_user, db)
