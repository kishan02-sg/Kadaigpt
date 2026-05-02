"""
KadaiGPT - Subscription & Billing Models
Multi-tier SaaS subscription system for kirana store management

Tiers: FREE → SMART (₹299) → PRO (₹799) → ENTERPRISE (Custom)
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum
from datetime import datetime


# ==================== ENUMS ====================

class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    SMART = "smart"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    PAUSED = "paused"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"


# ==================== TIER CONFIGURATION ====================

TIER_FEATURES = {
    SubscriptionTier.FREE: {
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "max_bills_per_month": 100,
        "max_languages": 2,
        "analytics_days": 7,
        "max_products": 200,
        "max_customers": 100,
        "whatsapp_messages_per_month": 0,
        "max_stores": 1,
        "features": [
            "basic_billing",
            "basic_inventory",
            "mobile_app",
            "community_support",
        ],
        "branding": True,  # Shows "Powered by KadaiGPT"
        "api_access": False,
        "custom_reports": False,
        "voice_commands": True,
        "ocr_scanning": True,
        "demand_forecasting": False,
        "credit_management": False,
        "priority_support": False,
    },
    SubscriptionTier.SMART: {
        "name": "Smart",
        "price_monthly": 299,
        "price_yearly": 2990,  # ~17% discount
        "max_bills_per_month": -1,  # Unlimited
        "max_languages": 6,
        "analytics_days": 90,
        "max_products": -1,  # Unlimited
        "max_customers": -1,  # Unlimited
        "whatsapp_messages_per_month": 500,
        "max_stores": 1,
        "features": [
            "basic_billing",
            "basic_inventory",
            "advanced_analytics",
            "whatsapp_integration",
            "email_support",
            "gst_reports",
            "thermal_printing",
            "barcode_scanning",
        ],
        "branding": False,
        "api_access": False,
        "custom_reports": False,
        "voice_commands": True,
        "ocr_scanning": True,
        "demand_forecasting": False,
        "credit_management": True,
        "priority_support": False,
    },
    SubscriptionTier.PRO: {
        "name": "Pro",
        "price_monthly": 799,
        "price_yearly": 7990,  # ~17% discount
        "max_bills_per_month": -1,
        "max_languages": 6,
        "analytics_days": 365,
        "max_products": -1,
        "max_customers": -1,
        "whatsapp_messages_per_month": 2000,
        "max_stores": 3,
        "features": [
            "basic_billing",
            "basic_inventory",
            "advanced_analytics",
            "whatsapp_integration",
            "priority_support",
            "gst_reports",
            "thermal_printing",
            "barcode_scanning",
            "demand_forecasting",
            "credit_management",
            "multi_store",
            "custom_reports",
            "api_access",
            "supplier_management",
            "staff_management",
            "loyalty_program",
        ],
        "branding": False,
        "api_access": True,
        "custom_reports": True,
        "voice_commands": True,
        "ocr_scanning": True,
        "demand_forecasting": True,
        "credit_management": True,
        "priority_support": True,
    },
    SubscriptionTier.ENTERPRISE: {
        "name": "Enterprise",
        "price_monthly": -1,  # Custom pricing
        "price_yearly": -1,
        "max_bills_per_month": -1,
        "max_languages": 6,
        "analytics_days": -1,  # Unlimited history
        "max_products": -1,
        "max_customers": -1,
        "whatsapp_messages_per_month": -1,
        "max_stores": -1,  # Unlimited
        "features": [
            "basic_billing",
            "basic_inventory",
            "advanced_analytics",
            "whatsapp_integration",
            "priority_support",
            "gst_reports",
            "thermal_printing",
            "barcode_scanning",
            "demand_forecasting",
            "credit_management",
            "multi_store",
            "custom_reports",
            "api_access",
            "supplier_management",
            "staff_management",
            "loyalty_program",
            "white_label",
            "dedicated_support",
            "sla_guarantee",
            "on_premise",
            "custom_integrations",
            "chain_management",
        ],
        "branding": False,
        "api_access": True,
        "custom_reports": True,
        "voice_commands": True,
        "ocr_scanning": True,
        "demand_forecasting": True,
        "credit_management": True,
        "priority_support": True,
    },
}


# ==================== MODELS ====================

class Subscription(Base):
    """Store subscription tracking"""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, unique=True)

    # Subscription Details
    tier = Column(SAEnum(SubscriptionTier), default=SubscriptionTier.FREE, nullable=False)
    status = Column(SAEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False)
    
    # Billing Cycle
    billing_cycle = Column(String(20), default="monthly")  # monthly, yearly
    price_amount = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    
    # Dates
    trial_start = Column(DateTime(timezone=True))
    trial_end = Column(DateTime(timezone=True))
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    cancelled_at = Column(DateTime(timezone=True))
    
    # Payment Gateway
    gateway = Column(String(50))  # razorpay, stripe, manual
    gateway_subscription_id = Column(String(200))  # Razorpay subscription ID
    gateway_customer_id = Column(String(200))  # Razorpay customer ID
    
    # Custom pricing (for Enterprise)
    custom_price = Column(Float)
    custom_features = Column(JSON)  # Override features for enterprise
    
    # Metadata
    activated_by = Column(String(100))  # sales rep, self-service, partner
    activation_source = Column(String(100))  # web, app, field_rep, partner_code
    partner_code = Column(String(50))  # Kadai Champion or partner referral code
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    store = relationship("Store", backref="subscription")
    usage_records = relationship("UsageRecord", back_populates="subscription")
    invoices = relationship("SubscriptionInvoice", back_populates="subscription")


class UsageRecord(Base):
    """Track feature usage for metering (bills, WhatsApp msgs, etc.)"""
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Usage Period
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Metered Usage
    bills_created = Column(Integer, default=0)
    whatsapp_messages_sent = Column(Integer, default=0)
    ocr_scans = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    storage_mb = Column(Float, default=0.0)
    
    # AI Usage
    ai_queries = Column(Integer, default=0)
    voice_commands = Column(Integer, default=0)
    demand_forecasts = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    subscription = relationship("Subscription", back_populates="usage_records")


class SubscriptionInvoice(Base):
    """Subscription invoice/payment records"""
    __tablename__ = "subscription_invoices"

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Invoice Details
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    invoice_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True))
    
    # Amounts (in INR)
    subtotal = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)  # 18% GST
    discount_amount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    
    # Payment
    status = Column(SAEnum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    payment_method = Column(String(50))  # upi, card, netbanking
    payment_gateway = Column(String(50))  # razorpay
    payment_id = Column(String(200))  # Gateway payment ID
    paid_at = Column(DateTime(timezone=True))
    
    # Period covered
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    
    # GST Details (for Indian compliance)
    gstin = Column(String(20))
    place_of_supply = Column(String(50))
    cgst_amount = Column(Float, default=0.0)
    sgst_amount = Column(Float, default=0.0)
    igst_amount = Column(Float, default=0.0)
    
    # PDF
    invoice_pdf_url = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    subscription = relationship("Subscription", back_populates="invoices")


class FeatureFlag(Base):
    """Runtime feature toggles per store"""
    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)  # NULL = global
    
    # Flag Details
    feature_key = Column(String(100), nullable=False, index=True)
    enabled = Column(Boolean, default=False)
    
    # Override reason
    reason = Column(Text)  # "Beta tester", "Enterprise custom", etc.
    enabled_by = Column(String(100))
    
    # A/B Testing
    rollout_percentage = Column(Float, default=100.0)  # 0-100
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))  # Auto-disable after date


class PartnerReferral(Base):
    """Track Kadai Champions and partner referrals"""
    __tablename__ = "partner_referrals"

    id = Column(Integer, primary_key=True, index=True)
    
    # Partner Info
    partner_name = Column(String(200), nullable=False)
    partner_type = Column(String(50))  # kadai_champion, ca_firm, telecom, bank_bc
    partner_code = Column(String(50), unique=True, nullable=False, index=True)
    partner_phone = Column(String(20))
    partner_email = Column(String(200))
    
    # Location
    city = Column(String(100))
    state = Column(String(100))
    district = Column(String(100))
    
    # Commission Structure
    per_signup_commission = Column(Float, default=500.0)  # ₹500 per store
    recurring_commission = Column(Float, default=50.0)    # ₹50/month per active store
    commission_currency = Column(String(10), default="INR")
    
    # Performance
    total_signups = Column(Integer, default=0)
    active_stores = Column(Integer, default=0)
    total_earned = Column(Float, default=0.0)
    last_signup_date = Column(DateTime(timezone=True))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
