"""
KadaiGPT - Pydantic Schemas
Request/Response schemas for API endpoints
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ==================== ENUMS ====================

class UserRoleEnum(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    CASHIER = "cashier"


class PaymentMethodEnum(str, Enum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    CREDIT = "credit"


class BillStatusEnum(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


# ==================== AUTH SCHEMAS ====================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    store_name: str = Field(..., min_length=2)
    business_type: Optional[str] = "general"


# ==================== USER SCHEMAS ====================

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRoleEnum = UserRoleEnum.CASHIER


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: int
    store_id: int
    is_active: bool
    language: str
    theme: str
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== STORE SCHEMAS ====================

class StoreBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    business_type: Optional[str] = "general"


class StoreCreate(StoreBase):
    pass


class StoreResponse(StoreBase):
    id: int
    currency: str
    tax_rate: float
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== CATEGORY SCHEMAS ====================

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "📦"
    color: Optional[str] = "#6366f1"


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    store_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== PRODUCT SCHEMAS ====================

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    
    selling_price: float
    cost_price: Optional[float] = 0.0
    mrp: Optional[float] = None
    discount_percent: Optional[float] = 0.0
    
    tax_rate: Optional[float] = 0.0
    hsn_code: Optional[str] = None
    
    current_stock: Optional[int] = 0
    min_stock_alert: Optional[int] = 10
    unit: Optional[str] = "pieces"
    
    expiry_date: Optional[datetime] = None
    batch_number: Optional[str] = None
    manufacturer: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    selling_price: Optional[float] = None
    current_stock: Optional[int] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    store_id: Optional[int] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== BILL ITEM SCHEMAS ====================

class BillItemCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    product_sku: Optional[str] = None
    unit_price: float
    quantity: float
    discount_percent: Optional[float] = 0.0
    tax_rate: Optional[float] = 0.0


class BillItemResponse(BaseModel):
    id: int
    product_id: Optional[int]
    product_name: str
    product_sku: Optional[str]
    unit_price: float
    quantity: float
    discount_percent: float
    tax_rate: float
    subtotal: float
    discount_amount: float
    tax_amount: float
    total: float

    class Config:
        from_attributes = True


# ==================== BILL SCHEMAS ====================

class BillCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: PaymentMethodEnum = PaymentMethodEnum.CASH
    amount_paid: Optional[float] = None
    items: List[BillItemCreate]
    local_id: Optional[str] = None  # For offline sync


class BillResponse(BaseModel):
    id: int
    store_id: int
    bill_number: str
    bill_date: datetime
    
    customer_name: Optional[str]
    customer_phone: Optional[str]
    
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    
    payment_method: PaymentMethodEnum
    amount_paid: float
    change_amount: float
    
    status: BillStatusEnum
    is_printed: bool
    print_count: int
    
    items: List[BillItemResponse]
    
    created_at: datetime

    class Config:
        from_attributes = True


class BillSummary(BaseModel):
    """Quick bill summary for lists"""
    id: int
    bill_number: str
    total_amount: float
    status: BillStatusEnum
    payment_method: PaymentMethodEnum
    customer_name: Optional[str]
    customer_phone: Optional[str] = None
    items_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== OCR SCHEMAS ====================

class OCRResult(BaseModel):
    raw_text: str
    extracted_items: List[dict]
    extracted_total: Optional[float]
    extracted_date: Optional[str]
    overall_confidence: float
    confidence_level: str  # high, medium, low
    suggestions: List[str]


class OCRProcessRequest(BaseModel):
    image_base64: str


class HandwrittenBillResponse(BaseModel):
    id: int
    image_path: str
    overall_confidence: float
    confidence_level: str
    extracted_total: Optional[float]
    extracted_items: Optional[List[dict]]
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== ANALYTICS SCHEMAS ====================

class DashboardStats(BaseModel):
    today_revenue: float
    today_bills: int
    today_items_sold: int
    avg_bill_value: float
    
    yesterday_revenue: float
    revenue_change_percent: float
    
    low_stock_products: int
    expiring_soon_products: int
    
    payment_breakdown: dict
    hourly_sales: List[dict]
    top_products: List[dict]


class SalesReport(BaseModel):
    period: str  # today, week, month
    total_revenue: float
    total_bills: int
    total_items: int
    avg_bill_value: float
    
    daily_breakdown: List[dict]
    category_breakdown: List[dict]
    payment_breakdown: dict


# ==================== PRINT SCHEMAS ====================

class PrintRequest(BaseModel):
    bill_id: int
    printer_name: Optional[str] = None


class PrintStatus(BaseModel):
    job_id: int
    status: str
    message: str
    attempts: int


# ==================== SYNC SCHEMAS ====================

class SyncRequest(BaseModel):
    offline_bills: List[BillCreate]
    last_sync_time: Optional[datetime] = None


class SyncResponse(BaseModel):
    synced_count: int
    failed_count: int
    errors: List[dict]
    server_time: datetime
