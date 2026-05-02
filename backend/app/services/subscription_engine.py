"""
KadaiGPT - Subscription Engine
Manages subscription lifecycle, feature gating, usage metering
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models import Store
from app.models.subscription import (
    Subscription, UsageRecord, SubscriptionInvoice, FeatureFlag,
    PartnerReferral, SubscriptionTier, SubscriptionStatus,
    InvoiceStatus, TIER_FEATURES
)

logger = logging.getLogger("KadaiGPT.Subscription")


class SubscriptionEngine:
    """Core subscription management engine"""
    
    TRIAL_DURATION_DAYS = 14
    GST_RATE = 0.18

    async def create_subscription(
        self, db: AsyncSession, store_id: int,
        tier: SubscriptionTier = SubscriptionTier.FREE,
        billing_cycle: str = "monthly",
        partner_code: Optional[str] = None
    ) -> Subscription:
        """Create a new subscription for a store"""
        existing = await db.execute(
            select(Subscription).where(Subscription.store_id == store_id)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Store {store_id} already has a subscription")

        tier_config = TIER_FEATURES[tier]
        price = tier_config["price_monthly"] if billing_cycle == "monthly" else tier_config["price_yearly"]
        now = datetime.utcnow()

        sub = Subscription(
            store_id=store_id, tier=tier,
            status=SubscriptionStatus.ACTIVE if tier == SubscriptionTier.FREE else SubscriptionStatus.TRIALING,
            billing_cycle=billing_cycle, price_amount=price,
            current_period_start=now,
            current_period_end=now + timedelta(days=30 if billing_cycle == "monthly" else 365),
            partner_code=partner_code, activation_source="self_service"
        )
        if tier != SubscriptionTier.FREE:
            sub.trial_start = now
            sub.trial_end = now + timedelta(days=self.TRIAL_DURATION_DAYS)

        db.add(sub)
        if partner_code:
            await self._track_partner_signup(db, partner_code)

        usage = UsageRecord(
            subscription_id=sub.id, store_id=store_id,
            period_start=now, period_end=now + timedelta(days=30)
        )
        db.add(usage)
        await db.commit()
        await db.refresh(sub)
        logger.info(f"[Subscription] Created {tier.value} for store {store_id}")
        return sub

    async def upgrade_subscription(
        self, db: AsyncSession, store_id: int,
        new_tier: SubscriptionTier, billing_cycle: str = "monthly"
    ) -> Dict[str, Any]:
        """Upgrade a store's subscription tier"""
        sub = await self._get_subscription(db, store_id)
        if not sub:
            raise ValueError(f"No subscription for store {store_id}")

        old_tier = sub.tier
        tier_order = list(SubscriptionTier)
        if tier_order.index(new_tier) <= tier_order.index(old_tier):
            raise ValueError(f"Cannot upgrade from {old_tier.value} to {new_tier.value}")

        proration = self._calculate_proration(sub, new_tier, billing_cycle)
        tier_config = TIER_FEATURES[new_tier]
        sub.tier = new_tier
        sub.billing_cycle = billing_cycle
        sub.price_amount = tier_config["price_monthly"] if billing_cycle == "monthly" else tier_config["price_yearly"]
        sub.status = SubscriptionStatus.ACTIVE
        await db.commit()

        logger.info(f"[Subscription] Upgraded store {store_id}: {old_tier.value} → {new_tier.value}")
        return {"old_tier": old_tier.value, "new_tier": new_tier.value, "proration": proration}

    async def cancel_subscription(
        self, db: AsyncSession, store_id: int, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cancel subscription (reverts to FREE at end of period)"""
        sub = await self._get_subscription(db, store_id)
        if not sub:
            raise ValueError(f"No subscription for store {store_id}")
        sub.cancelled_at = datetime.utcnow()
        sub.status = SubscriptionStatus.CANCELLED
        await db.commit()
        logger.info(f"[Subscription] Cancelled store {store_id}. Reason: {reason}")
        return {
            "message": "Subscription cancelled",
            "access_until": sub.current_period_end.isoformat() if sub.current_period_end else None,
        }

    async def check_feature_access(
        self, db: AsyncSession, store_id: int, feature_key: str
    ) -> Dict[str, Any]:
        """Check if a store has access to a feature"""
        sub = await self._get_subscription(db, store_id)
        tier = sub.tier if sub else SubscriptionTier.FREE

        override = await self._check_feature_flag(db, store_id, feature_key)
        if override is not None:
            return {"allowed": override, "current_tier": tier.value, "source": "flag"}

        tier_config = TIER_FEATURES[tier]
        has = feature_key in tier_config.get("features", []) or tier_config.get(feature_key, False)

        result = {"allowed": has, "current_tier": tier.value, "source": "tier"}
        if not has:
            for t in [SubscriptionTier.SMART, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]:
                cfg = TIER_FEATURES[t]
                if feature_key in cfg.get("features", []) or cfg.get(feature_key, False):
                    result["tier_required"] = t.value
                    result["upgrade_message"] = f"Upgrade to {cfg['name']} (₹{cfg['price_monthly']}/mo)"
                    break
        return result

    async def check_usage_limit(
        self, db: AsyncSession, store_id: int, usage_type: str
    ) -> Dict[str, Any]:
        """Check if store is within usage limits"""
        sub = await self._get_subscription(db, store_id)
        tier = sub.tier if sub else SubscriptionTier.FREE
        cfg = TIER_FEATURES[tier]
        usage = await self._get_current_usage(db, store_id)

        limit_map = {
            "bills": ("max_bills_per_month", usage.bills_created if usage else 0),
            "whatsapp": ("whatsapp_messages_per_month", usage.whatsapp_messages_sent if usage else 0),
        }
        limit_key, current = limit_map.get(usage_type, ("max_bills_per_month", 0))
        max_limit = cfg.get(limit_key, -1)
        unlimited = max_limit == -1

        return {
            "allowed": unlimited or current < max_limit,
            "current_usage": current,
            "max_limit": "unlimited" if unlimited else max_limit,
            "remaining": "unlimited" if unlimited else max(0, max_limit - current),
        }

    async def increment_usage(
        self, db: AsyncSession, store_id: int, usage_type: str, count: int = 1
    ) -> bool:
        """Increment usage counter. Returns True if within limits."""
        check = await self.check_usage_limit(db, store_id, usage_type)
        if not check["allowed"]:
            return False

        usage = await self._get_current_usage(db, store_id)
        if not usage:
            sub = await self._get_subscription(db, store_id)
            now = datetime.utcnow()
            usage = UsageRecord(
                subscription_id=sub.id if sub else None, store_id=store_id,
                period_start=now.replace(day=1),
                period_end=(now.replace(day=1) + timedelta(days=32)).replace(day=1)
            )
            db.add(usage)

        field_map = {
            "bills": "bills_created", "whatsapp": "whatsapp_messages_sent",
            "ocr": "ocr_scans", "api": "api_calls",
            "ai": "ai_queries", "voice": "voice_commands",
        }
        field = field_map.get(usage_type)
        if field:
            setattr(usage, field, (getattr(usage, field, 0) or 0) + count)
        await db.commit()
        return True

    async def get_subscription_details(
        self, db: AsyncSession, store_id: int
    ) -> Dict[str, Any]:
        """Get complete subscription details"""
        sub = await self._get_subscription(db, store_id)
        tier = sub.tier if sub else SubscriptionTier.FREE
        cfg = TIER_FEATURES[tier]
        usage = await self._get_current_usage(db, store_id)

        return {
            "subscription": {
                "tier": tier.value, "tier_name": cfg["name"],
                "status": sub.status.value if sub else "active",
                "price": sub.price_amount if sub else 0,
                "is_trial": sub.status == SubscriptionStatus.TRIALING if sub else False,
            },
            "features": cfg,
            "usage": {
                "bills_created": usage.bills_created if usage else 0,
                "bills_limit": cfg["max_bills_per_month"],
                "whatsapp_sent": usage.whatsapp_messages_sent if usage else 0,
                "whatsapp_limit": cfg["whatsapp_messages_per_month"],
            },
            "available_tiers": [
                {"tier": t.value, "name": TIER_FEATURES[t]["name"],
                 "price_monthly": TIER_FEATURES[t]["price_monthly"],
                 "price_yearly": TIER_FEATURES[t]["price_yearly"]}
                for t in SubscriptionTier
            ]
        }

    # ── Helpers ──

    async def _get_subscription(self, db: AsyncSession, store_id: int):
        r = await db.execute(select(Subscription).where(Subscription.store_id == store_id))
        return r.scalar_one_or_none()

    async def _get_current_usage(self, db: AsyncSession, store_id: int):
        now = datetime.utcnow()
        r = await db.execute(select(UsageRecord).where(and_(
            UsageRecord.store_id == store_id,
            UsageRecord.period_start <= now, UsageRecord.period_end >= now
        )))
        return r.scalar_one_or_none()

    async def _check_feature_flag(self, db: AsyncSession, store_id: int, key: str):
        r = await db.execute(select(FeatureFlag).where(and_(
            FeatureFlag.feature_key == key,
            (FeatureFlag.store_id == store_id) | (FeatureFlag.store_id.is_(None))
        )).order_by(FeatureFlag.store_id.desc()))
        flag = r.scalars().first()
        if flag and (not flag.expires_at or flag.expires_at >= datetime.utcnow()):
            return flag.enabled
        return None

    def _calculate_proration(self, sub, new_tier, billing_cycle):
        if not sub.current_period_end or not sub.current_period_start:
            return {"prorated_amount": 0}
        total = (sub.current_period_end - sub.current_period_start).days
        remaining = (sub.current_period_end - datetime.utcnow()).days
        if total <= 0:
            return {"prorated_amount": 0}
        credit = round(((sub.price_amount or 0) / total) * remaining, 2)
        new_cfg = TIER_FEATURES[new_tier]
        new_price = new_cfg["price_monthly"] if billing_cycle == "monthly" else new_cfg["price_yearly"]
        charge = round((new_price / (30 if billing_cycle == "monthly" else 365)) * remaining, 2)
        return {"credit": credit, "charge": charge, "prorated_amount": round(charge - credit, 2)}

    async def _track_partner_signup(self, db: AsyncSession, partner_code: str):
        r = await db.execute(select(PartnerReferral).where(PartnerReferral.partner_code == partner_code))
        partner = r.scalar_one_or_none()
        if partner:
            partner.total_signups = (partner.total_signups or 0) + 1
            partner.active_stores = (partner.active_stores or 0) + 1
            partner.total_earned = (partner.total_earned or 0) + partner.per_signup_commission
            partner.last_signup_date = datetime.utcnow()


subscription_engine = SubscriptionEngine()
