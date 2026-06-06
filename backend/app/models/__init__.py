"""
KadaiGPT - Database Models
Complete data models for the retail operations platform
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, 
    ForeignKey, Enum, JSON, LargeBinary
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum
from datetime import datetime

# Import enums from single source of truth
from app.constants.roles import UserRole, BillStatus, PaymentMethod, SyncStatus, OCRConfidence


# ==================== MODELS ====================

class Store(Base):
    """Store/Shop model - supports multi-store management"""
    __tablename__ = "stores"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(Text)
    phone = Column(String(20))
    gst_number = Column(String(20))
    license_number = Column(String(50))
    
    # Business Info
    business_type = Column(String(50))  # kirana, medical, grocery, etc.
    opening_time = Column(String(10))
    closing_time = Column(String(10))
    
    # Settings
    currency = Column(String(10), default="INR")
    tax_rate = Column(Float, default=0.0)
    upi_id = Column(String(100))

    # ── Per-store WhatsApp customer-bot connection ──────────────────────────
    # provider: 'cloud' (Meta) | 'evolution' (WAHA) | None
    wa_provider = Column(String(20))
    # Routing keys used to map an inbound message back to this store:
    #   Meta  -> wa_cloud_phone_id (= webhook metadata.phone_number_id)
    #   WAHA  -> wa_session (= webhook session name)
    wa_cloud_phone_id = Column(String(64), index=True)
    wa_session = Column(String(64), index=True)
    # Secrets are stored encrypted (DataEncryption); never returned to the client.
    wa_cloud_token_enc = Column(Text)
    wa_evolution_url = Column(String(255))
    wa_evolution_key_enc = Column(Text)
    # The connected WhatsApp number shown to customers + connection state
    wa_number = Column(String(20))
    wa_connected = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="store")
    products = relationship("Product", back_populates="store")
    bills = relationship("Bill", back_populates="store")
    categories = relationship("Category", back_populates="store")


class User(Base):
    """User model - store owners, managers, cashiers"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Auth Info
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    staff_id = Column(String(20), unique=True, index=True, nullable=True)  # For staff login (e.g., KDG-4821)
    
    # Profile
    full_name = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CASHIER)
    avatar_url = Column(String(500))
    
    # Preferences
    language = Column(String(10), default="en")  # en, hi, ta, te, etc.
    theme = Column(String(20), default="dark")
    
    # Status
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))

    # Token revocation: JWTs issued before this timestamp are rejected.
    # Bumped on logout / password change to invalidate all outstanding tokens.
    tokens_valid_after = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    store = relationship("Store", back_populates="users")
    bills = relationship("Bill", back_populates="cashier")


class Category(Base):
    """Product category model"""
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))  # emoji or icon name
    color = Column(String(20))  # hex color
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    store = relationship("Store", back_populates="categories")
    products = relationship("Product", back_populates="category")


class Product(Base):
    """Product/Item model with inventory tracking"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    
    # Basic Info
    name = Column(String(200), nullable=False)
    description = Column(Text)
    sku = Column(String(50), index=True)  # Stock Keeping Unit
    barcode = Column(String(50), index=True)
    
    # Pricing
    cost_price = Column(Float, default=0.0)
    selling_price = Column(Float, nullable=False)
    mrp = Column(Float)  # Maximum Retail Price
    discount_percent = Column(Float, default=0.0)
    
    # Tax
    tax_rate = Column(Float, default=0.0)
    hsn_code = Column(String(20))  # GST HSN Code
    
    # Inventory
    current_stock = Column(Integer, default=0)
    min_stock_alert = Column(Integer, default=10)
    unit = Column(String(20), default="pieces")  # pieces, kg, liters, etc.
    
    # For medical stores
    expiry_date = Column(DateTime)
    batch_number = Column(String(50))
    manufacturer = Column(String(200))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    store = relationship("Store", back_populates="products")
    category = relationship("Category", back_populates="products")
    bill_items = relationship("BillItem", back_populates="product")


class Bill(Base):
    """Bill/Invoice model"""
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    cashier_id = Column(Integer, ForeignKey("users.id"))
    
    # Bill Info
    bill_number = Column(String(50), unique=True, nullable=False, index=True)
    bill_date = Column(DateTime(timezone=True), server_default=func.now())
    
    # Customer Info (optional)
    customer_name = Column(String(200))
    customer_phone = Column(String(20))
    
    # Amounts
    subtotal = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    
    # Payment
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    amount_paid = Column(Float, default=0.0)
    change_amount = Column(Float, default=0.0)
    
    # Status
    status = Column(Enum(BillStatus), default=BillStatus.COMPLETED)
    
    # Offline Sync
    sync_status = Column(Enum(SyncStatus), default=SyncStatus.SYNCED)
    local_id = Column(String(50))  # UUID for offline bills
    
    # Print Status
    is_printed = Column(Boolean, default=False)
    print_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    store = relationship("Store", back_populates="bills")
    cashier = relationship("User", back_populates="bills")
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")


class BillItem(Base):
    """Individual line items in a bill"""
    __tablename__ = "bill_items"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"))
    
    # Item Details (copied from product at time of sale)
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(50))
    
    # Pricing at time of sale
    unit_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    discount_percent = Column(Float, default=0.0)
    tax_rate = Column(Float, default=0.0)
    
    # Calculated amounts
    subtotal = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    
    # Relationships
    bill = relationship("Bill", back_populates="items")
    product = relationship("Product", back_populates="bill_items")


class HandwrittenBill(Base):
    """OCR-processed handwritten bills"""
    __tablename__ = "handwritten_bills"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Image
    image_path = Column(String(500), nullable=False)
    image_thumbnail = Column(String(500))
    
    # OCR Results
    raw_ocr_text = Column(Text)
    extracted_data = Column(JSON)  # Structured extracted data
    
    # Confidence Scores
    overall_confidence = Column(Float)
    confidence_level = Column(Enum(OCRConfidence))
    
    # Extracted Fields
    extracted_date = Column(DateTime)
    extracted_total = Column(Float)
    extracted_items = Column(JSON)  # List of items with confidence
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey("users.id"))
    verified_at = Column(DateTime)
    corrections_made = Column(JSON)  # Track user corrections for learning
    
    # Converted to digital bill?
    converted_bill_id = Column(Integer, ForeignKey("bills.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PrintJob(Base):
    """Print job tracking for the Print Agent"""
    __tablename__ = "print_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    
    # Printer Info
    printer_name = Column(String(200))
    
    # Status
    status = Column(String(50), default="pending")  # pending, printing, completed, failed
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    # Error tracking
    last_error = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime)


class AgentLog(Base):
    """Audit log for all AI agent decisions"""
    __tablename__ = "agent_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"))
    
    # Agent Info
    agent_name = Column(String(100), nullable=False)  # print_agent, ocr_agent, etc.
    action = Column(String(200), nullable=False)
    
    # Decision Details
    input_data = Column(JSON)
    decision = Column(JSON)
    confidence_score = Column(Float)
    
    # Outcome
    success = Column(Boolean)
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DailySummary(Base):
    """Daily sales summary for analytics"""
    __tablename__ = "daily_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Date
    summary_date = Column(DateTime, nullable=False)
    
    # Sales Metrics
    total_bills = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    total_tax = Column(Float, default=0.0)
    total_discount = Column(Float, default=0.0)
    
    # Payment Breakdown
    cash_amount = Column(Float, default=0.0)
    upi_amount = Column(Float, default=0.0)
    card_amount = Column(Float, default=0.0)
    credit_amount = Column(Float, default=0.0)
    
    # Items
    total_items_sold = Column(Integer, default=0)
    top_selling_items = Column(JSON)  # List of top 10 items
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Customer(Base):
    """Customer model with loyalty and credit tracking"""
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Basic Info
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(200))
    address = Column(Text)
    
    # Financial
    credit = Column(Float, default=0.0)
    credit_limit = Column(Float, default=5000.0)  # Max credit allowed
    total_purchases = Column(Float, default=0.0)
    
    # Loyalty
    loyalty_points = Column(Integer, default=0)
    last_purchase = Column(DateTime)
    
    # Status
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AuditTrail(Base):
    """Audit trail for tracking all critical business operations"""
    __tablename__ = "audit_trails"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # What happened
    action = Column(String(100), nullable=False)  # create, update, delete, login, etc.
    entity_type = Column(String(50), nullable=False)  # bill, product, customer, etc.
    entity_id = Column(Integer, nullable=True)
    
    # Details
    old_values = Column(JSON, nullable=True)  # Previous state (for updates)
    new_values = Column(JSON, nullable=True)  # New state
    
    # Context
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    """In-app notifications for users"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # None = broadcast
    
    # Content
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info")  # info, warning, alert, success
    
    # Status
    is_read = Column(Boolean, default=False)
    
    # Reference (optional link to entity)
    entity_type = Column(String(50), nullable=True)  # bill, product, etc.
    entity_id = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)


class Supplier(Base):
    """Supplier model — persistent storage (was in-memory)"""
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Basic Info
    name = Column(String(200), nullable=False)
    contact = Column(String(200))  # Contact person
    phone = Column(String(20), nullable=False)
    email = Column(String(200))
    address = Column(Text)
    category = Column(String(100), default="General")
    
    # Financial
    pending_amount = Column(Float, default=0.0)
    total_orders = Column(Integer, default=0)
    total_paid = Column(Float, default=0.0)
    
    # Status
    last_order = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    store = relationship("Store")
    orders = relationship("PurchaseOrder", back_populates="supplier")


class PurchaseOrder(Base):
    """Purchase orders from suppliers"""
    __tablename__ = "purchase_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    
    # Order Info
    order_number = Column(String(50), unique=True, nullable=False)
    items = Column(JSON)  # List of items with quantity, price
    item_count = Column(Integer, default=0)
    amount = Column(Float, default=0.0)
    
    # Status
    status = Column(String(50), default="pending")  # pending, confirmed, shipped, delivered, cancelled
    notes = Column(Text)
    expected_delivery = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    store = relationship("Store")
    supplier = relationship("Supplier", back_populates="orders")


class AuthSecurityState(Base):
    """Cross-request persistence for auth security state.

    Serverless (Vercel) containers are stateless, so in-memory dicts for login
    lockout, password-reset tokens and OTPs evaporate on cold starts — which
    silently defeats brute-force protection. This table persists that state.

    kind: 'lockout' | 'reset_token' | 'otp'
    key:  identifier for the kind (email/staff_id, reset token, phone-last10)
    """
    __tablename__ = "auth_security_state"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(20), index=True, nullable=False)
    key = Column(String(255), index=True, nullable=False)
    data = Column(JSON, default=dict)        # arbitrary payload (count, otp, user_id, ...)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Expense(Base):
    """Store expense record (rent, salary, utilities, inventory, etc.)."""
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    category = Column(String(50), default="other")   # rent, salary, utilities, inventory, transport, other
    description = Column(String(255), nullable=False)
    amount = Column(Float, default=0.0)
    expense_date = Column(DateTime(timezone=True))    # when the expense occurred
    recurring = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    store = relationship("Store")
