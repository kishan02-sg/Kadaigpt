"""
KadaiGPT - Subscription API Router
Endpoints for subscription management, feature checks, and billing
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import User
from app.models.subscription import SubscriptionTier
from app.routers.auth import get_current_active_user
from app.services.subscription_engine import subscription_engine

router = APIRouter(prefix="/subscription", tags=["Subscription"])


# ── Request/Response Schemas ──

class CreateSubscriptionRequest(BaseModel):
    tier: str = Field(default="free", description="Tier: free, smart, pro, enterprise")
    billing_cycle: str = Field(default="monthly", description="monthly or yearly")
    partner_code: Optional[str] = Field(default=None, description="Referral partner code")


class UpgradeRequest(BaseModel):
    new_tier: str = Field(..., description="Target tier: smart, pro, enterprise")
    billing_cycle: str = Field(default="monthly")


class CancelRequest(BaseModel):
    reason: Optional[str] = None


class FeatureCheckRequest(BaseModel):
    feature_key: str = Field(..., description="Feature to check access for")


# ── Endpoints ──

@router.get("/details")
async def get_subscription_details(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current subscription details including usage and available tiers"""
    try:
        details = await subscription_engine.get_subscription_details(db, current_user.store_id)
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create")
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new subscription for the current store"""
    try:
        tier = SubscriptionTier(request.tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {request.tier}")

    try:
        sub = await subscription_engine.create_subscription(
            db, current_user.store_id, tier,
            request.billing_cycle, request.partner_code
        )
        return {
            "message": f"Subscription created: {tier.value.upper()}",
            "subscription_id": sub.id,
            "tier": sub.tier.value,
            "status": sub.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upgrade")
async def upgrade_subscription(
    request: UpgradeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Upgrade to a higher subscription tier"""
    try:
        new_tier = SubscriptionTier(request.new_tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {request.new_tier}")

    try:
        result = await subscription_engine.upgrade_subscription(
            db, current_user.store_id, new_tier, request.billing_cycle
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel")
async def cancel_subscription(
    request: CancelRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel subscription (access until end of current period)"""
    try:
        result = await subscription_engine.cancel_subscription(
            db, current_user.store_id, request.reason
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/check-feature")
async def check_feature_access(
    request: FeatureCheckRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if current store has access to a specific feature"""
    result = await subscription_engine.check_feature_access(
        db, current_user.store_id, request.feature_key
    )
    return result


@router.get("/check-feature/{feature_key}")
async def check_feature_access_get(
    feature_key: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Check feature access via GET (convenience endpoint)"""
    result = await subscription_engine.check_feature_access(
        db, current_user.store_id, feature_key
    )
    return result


@router.get("/usage")
async def get_usage(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current period usage metrics"""
    details = await subscription_engine.get_subscription_details(db, current_user.store_id)
    return details.get("usage", {})


@router.get("/usage/{usage_type}")
async def check_usage_limit(
    usage_type: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Check usage limit for a specific metric (bills, whatsapp, ocr, api)"""
    result = await subscription_engine.check_usage_limit(
        db, current_user.store_id, usage_type
    )
    return result


@router.get("/tiers")
async def get_available_tiers():
    """Get all available subscription tiers and their features (public)"""
    from app.models.subscription import TIER_FEATURES, SubscriptionTier
    
    tiers = []
    for tier in SubscriptionTier:
        cfg = TIER_FEATURES[tier]
        tiers.append({
            "tier": tier.value,
            "name": cfg["name"],
            "price_monthly": cfg["price_monthly"],
            "price_yearly": cfg["price_yearly"],
            "max_bills_per_month": cfg["max_bills_per_month"],
            "max_languages": cfg["max_languages"],
            "analytics_days": cfg["analytics_days"],
            "whatsapp_messages_per_month": cfg["whatsapp_messages_per_month"],
            "max_stores": cfg["max_stores"],
            "features": cfg["features"],
            "api_access": cfg["api_access"],
            "custom_reports": cfg["custom_reports"],
            "demand_forecasting": cfg["demand_forecasting"],
            "credit_management": cfg["credit_management"],
            "priority_support": cfg["priority_support"],
        })
    return {"tiers": tiers}
