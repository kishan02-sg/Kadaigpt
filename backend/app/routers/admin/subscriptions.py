"""
KadaiGPT - Platform Admin: Subscription Management
Grant/upgrade/downgrade/cancel a store's subscription plan.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditTrail, Store, User
from app.models.subscription import Subscription, SubscriptionTier, SubscriptionStatus
from app.routers.admin._common import require_admin
from app.services.login_history import get_client_ip

router = APIRouter(prefix="/admin/subscriptions", tags=["Admin - Subscriptions"])


class GrantPlanRequest(BaseModel):
    tier: str = Field(..., description="Tier key: free, smart, pro, enterprise")
    billing_cycle: str = Field("monthly", description="monthly or yearly")
    reason: Optional[str] = Field(None, description="Admin note for the audit trail")


class CancelPlanRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Admin note for the audit trail")


@router.post("/{store_id}/grant")
async def grant_plan(
    store_id: int,
    body: GrantPlanRequest,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Set a store's subscription to the given tier. Creates or updates."""
    store = (await db.execute(select(Store).where(Store.id == store_id))).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    try:
        tier = SubscriptionTier(body.tier)
    except ValueError:
        valid = [t.value for t in SubscriptionTier]
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {', '.join(valid)}")

    sub = (await db.execute(
        select(Subscription).where(Subscription.store_id == store_id)
    )).scalar_one_or_none()

    now = datetime.utcnow()
    old_values = {}

    if sub:
        old_values = {"tier": sub.tier.value, "status": sub.status.value, "billing_cycle": sub.billing_cycle}
        sub.tier = tier
        sub.status = SubscriptionStatus.ACTIVE
        sub.billing_cycle = body.billing_cycle
        sub.current_period_start = now
        sub.current_period_end = now + timedelta(days=365 if body.billing_cycle == "yearly" else 30)
        sub.cancelled_at = None
        sub.activated_by = f"admin:{current_user.email}"
        sub.activation_source = "admin_dashboard"
    else:
        sub = Subscription(
            store_id=store_id,
            tier=tier,
            status=SubscriptionStatus.ACTIVE,
            billing_cycle=body.billing_cycle,
            current_period_start=now,
            current_period_end=now + timedelta(days=365 if body.billing_cycle == "yearly" else 30),
            activated_by=f"admin:{current_user.email}",
            activation_source="admin_dashboard",
        )
        db.add(sub)

    db.add(AuditTrail(
        store_id=store_id,
        user_id=current_user.id,
        action="subscription_admin_grant",
        entity_type="subscription",
        entity_id=sub.id,
        old_values=old_values if old_values else None,
        new_values={"tier": tier.value, "billing_cycle": body.billing_cycle, "reason": body.reason},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ))
    await db.commit()

    return {
        "store_id": store_id,
        "tier": tier.value,
        "status": "active",
        "billing_cycle": body.billing_cycle,
    }


@router.post("/{store_id}/cancel")
async def cancel_plan(
    store_id: int,
    body: CancelPlanRequest,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a store's subscription (reverts to free tier behavior)."""
    store = (await db.execute(select(Store).where(Store.id == store_id))).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    sub = (await db.execute(
        select(Subscription).where(Subscription.store_id == store_id)
    )).scalar_one_or_none()

    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found for this store")

    old_values = {"tier": sub.tier.value, "status": sub.status.value}

    sub.status = SubscriptionStatus.CANCELLED
    sub.cancelled_at = datetime.utcnow()

    db.add(AuditTrail(
        store_id=store_id,
        user_id=current_user.id,
        action="subscription_admin_cancel",
        entity_type="subscription",
        entity_id=sub.id,
        old_values=old_values,
        new_values={"status": "cancelled", "reason": body.reason},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ))
    await db.commit()

    return {
        "store_id": store_id,
        "tier": sub.tier.value,
        "status": "cancelled",
    }
