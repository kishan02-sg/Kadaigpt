"""
KadaiGPT - Subscription API Router
Endpoints for subscription management, feature checks, and billing
"""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_db
from app.models import User
from app.models.subscription import (
    SubscriptionTier, SubscriptionStatus, SubscriptionInvoice, InvoiceStatus, TIER_FEATURES
)
from app.routers.auth import get_current_active_user
from app.services.subscription_engine import subscription_engine
from app.services.razorpay_service import razorpay_service

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


class CheckoutRequest(BaseModel):
    tier: str = Field(..., description="Target tier: smart, pro, enterprise")
    billing_cycle: str = Field(default="monthly", description="monthly or yearly")


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tier: str = Field(..., description="Tier purchased: smart, pro, enterprise")
    billing_cycle: str = Field(default="monthly")


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


@router.get("/payment-config")
async def get_payment_config():
    """Public: whether Razorpay is configured, and the publishable key id for Checkout.js"""
    return {
        "configured": razorpay_service.is_configured,
        "key_id": settings.RAZORPAY_KEY_ID if razorpay_service.is_configured else None,
    }


@router.post("/checkout")
async def create_checkout(
    request: CheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a Razorpay order for upgrading to a paid tier"""
    if not razorpay_service.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Online payments are not configured yet. Please contact support to upgrade."
        )

    try:
        tier = SubscriptionTier(request.tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {request.tier}")

    if tier == SubscriptionTier.FREE:
        raise HTTPException(status_code=400, detail="The Free tier doesn't require checkout")

    if request.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billing_cycle must be 'monthly' or 'yearly'")

    cfg = TIER_FEATURES[tier]
    amount = cfg["price_monthly"] if request.billing_cycle == "monthly" else cfg["price_yearly"]
    if amount <= 0:
        raise HTTPException(status_code=400, detail=f"{cfg['name']} uses custom pricing — contact sales")

    sub = await subscription_engine.get_or_create_subscription(db, current_user.store_id)

    tier_order = list(SubscriptionTier)
    if tier_order.index(tier) < tier_order.index(sub.tier):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot downgrade from {sub.tier.value} to {tier.value}"
        )

    try:
        order = await razorpay_service.create_order(
            amount,
            receipt=f"sub_{current_user.store_id}_{int(datetime.utcnow().timestamp())}_{uuid.uuid4().hex[:6]}",
            notes={
                "store_id": str(current_user.store_id),
                "tier": tier.value,
                "billing_cycle": request.billing_cycle,
            }
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    invoice = SubscriptionInvoice(
        subscription_id=sub.id,
        store_id=current_user.store_id,
        invoice_number=f"INV-{order['id']}",
        subtotal=amount,
        total_amount=amount,
        status=InvoiceStatus.DRAFT,
        payment_gateway="razorpay",
        gateway_order_id=order["id"],
        period_start=datetime.utcnow(),
        period_end=datetime.utcnow() + timedelta(days=30 if request.billing_cycle == "monthly" else 365),
    )
    db.add(invoice)
    await db.commit()

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": settings.RAZORPAY_KEY_ID,
        "tier": tier.value,
        "tier_name": cfg["name"],
        "billing_cycle": request.billing_cycle,
    }


@router.post("/verify-payment")
async def verify_payment(
    request: VerifyPaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify a completed Razorpay payment and activate the purchased tier"""
    if not razorpay_service.verify_payment_signature(
        request.razorpay_order_id, request.razorpay_payment_id, request.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    try:
        tier = SubscriptionTier(request.tier)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {request.tier}")

    result = await db.execute(select(SubscriptionInvoice).where(and_(
        SubscriptionInvoice.gateway_order_id == request.razorpay_order_id,
        SubscriptionInvoice.store_id == current_user.store_id,
    )))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Order not found for this store")

    if invoice.status == InvoiceStatus.PAID:
        details = await subscription_engine.get_subscription_details(db, current_user.store_id)
        return {"message": "Payment already processed", **details}

    cfg = TIER_FEATURES[tier]
    expected_amount = cfg["price_monthly"] if request.billing_cycle == "monthly" else cfg["price_yearly"]
    if abs((invoice.total_amount or 0) - expected_amount) > 0.01:
        raise HTTPException(status_code=400, detail="Tier/amount mismatch for this order")

    sub = await subscription_engine.get_or_create_subscription(db, current_user.store_id)
    now = datetime.utcnow()

    invoice.status = InvoiceStatus.PAID
    invoice.payment_method = "razorpay"
    invoice.payment_id = request.razorpay_payment_id
    invoice.paid_at = now

    sub.tier = tier
    sub.billing_cycle = request.billing_cycle
    sub.price_amount = expected_amount
    sub.status = SubscriptionStatus.ACTIVE
    sub.gateway = "razorpay"
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=30 if request.billing_cycle == "monthly" else 365)

    await db.commit()

    details = await subscription_engine.get_subscription_details(db, current_user.store_id)
    return {"message": f"Upgraded to {cfg['name']}!", **details}
