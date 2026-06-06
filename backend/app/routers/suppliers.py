"""
KadaiGPT - Suppliers Router
Manage suppliers and purchase orders
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import random

from app.database import get_db
from app.models import User, Store
from app.constants.roles import UserRole
from app.routers.auth import get_current_user
from app.rbac import require_role

# Supplier management is restricted to inventory-managing roles (not cashiers).
require_supplier_manager = require_role(
    UserRole.OWNER, UserRole.MANAGER, UserRole.INVENTORY_MANAGER
)

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


# ==================== SCHEMAS ====================

class SupplierCreate(BaseModel):
    """Schema for creating a supplier"""
    name: str
    contact: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    category: str = "General"


class SupplierUpdate(BaseModel):
    """Schema for updating a supplier"""
    name: Optional[str] = None
    contact: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None


class PurchaseOrderItem(BaseModel):
    """Item in a purchase order"""
    product_name: str
    quantity: float
    unit: str
    unit_price: float


class PurchaseOrderCreate(BaseModel):
    """Schema for creating a purchase order"""
    supplier_id: int
    items: List[PurchaseOrderItem]
    notes: Optional[str] = None


class SupplierPayment(BaseModel):
    """Schema for recording payment to supplier"""
    amount: float
    notes: Optional[str] = None


# In-memory storage (will be replaced with database model)
_supplier_storage = {}
_order_storage = {}


def get_user_suppliers(user_id: int) -> list:
    """Get suppliers for a specific user"""
    if user_id not in _supplier_storage:
        _supplier_storage[user_id] = []
    return _supplier_storage[user_id]


def save_user_suppliers(user_id: int, suppliers: list):
    """Save suppliers for a specific user"""
    _supplier_storage[user_id] = suppliers


def get_user_orders(user_id: int) -> list:
    """Get purchase orders for a specific user"""
    if user_id not in _order_storage:
        _order_storage[user_id] = []
    return _order_storage[user_id]


def save_user_orders(user_id: int, orders: list):
    """Save purchase orders for a specific user"""
    _order_storage[user_id] = orders


# ==================== ROUTES ====================

# IMPORTANT: Specific routes must come before /{supplier_id} routes

@router.get("/stats/summary", response_model=dict)
async def get_supplier_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get supplier statistics
    """
    suppliers = get_user_suppliers(current_user.id)
    orders = get_user_orders(current_user.id)
    
    total_suppliers = len(suppliers)
    total_pending = sum(s['pending_amount'] for s in suppliers)
    pending_orders = sum(1 for o in orders if o['status'] == 'pending')
    total_orders = len(orders)
    
    return {
        "total_suppliers": total_suppliers,
        "total_pending": total_pending,
        "pending_orders": pending_orders,
        "total_orders": total_orders
    }


@router.get("/orders/list", response_model=List[dict])
async def get_purchase_orders(
    order_status: Optional[str] = Query(None, description="Filter by status"),
    supplier_id: Optional[int] = Query(None, description="Filter by supplier"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all purchase orders
    """
    orders = get_user_orders(current_user.id)
    
    if order_status:
        orders = [o for o in orders if o['status'] == order_status]
    
    if supplier_id:
        orders = [o for o in orders if o['supplier_id'] == supplier_id]
    
    return orders


@router.post("/orders", response_model=dict)
async def create_purchase_order(
    order: PurchaseOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new purchase order
    """
    suppliers = get_user_suppliers(current_user.id)
    supplier = next((s for s in suppliers if s['id'] == order.supplier_id), None)
    
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    orders = get_user_orders(current_user.id)
    
    # Calculate total
    total_amount = sum(item.quantity * item.unit_price for item in order.items)
    
    # Generate order number
    order_number = f"PO-{datetime.utcnow().strftime('%Y')}-{str(len(orders) + 1).zfill(4)}"
    
    new_order = {
        "id": len(orders) + 1 if orders else 1,
        "order_no": order_number,
        "supplier_id": order.supplier_id,
        "supplier_name": supplier['name'],
        "items": [item.dict() for item in order.items],
        "item_count": len(order.items),
        "amount": total_amount,
        "status": "pending",
        "notes": order.notes,
        "date": datetime.utcnow().isoformat(),
        "expected_delivery": None,
        "created_at": datetime.utcnow().isoformat()
    }
    
    orders.insert(0, new_order)
    save_user_orders(current_user.id, orders)
    
    # Update supplier stats
    supplier['total_orders'] += 1
    supplier['pending_amount'] += total_amount
    supplier['last_order'] = datetime.utcnow().isoformat()
    save_user_suppliers(current_user.id, suppliers)
    
    return new_order


@router.put("/orders/{order_id}/status", response_model=dict)
async def update_order_status(
    order_id: int,
    new_status: str = Query(..., description="New status: pending, confirmed, shipped, delivered, cancelled"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update purchase order status
    """
    valid_statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    orders = get_user_orders(current_user.id)
    order_index = next((i for i, o in enumerate(orders) if o['id'] == order_id), None)
    
    if order_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    old_status = orders[order_index]['status']
    orders[order_index]['status'] = new_status
    
    # If delivered, clear pending amount from supplier
    if new_status == "delivered" and old_status != "delivered":
        suppliers = get_user_suppliers(current_user.id)
        supplier = next((s for s in suppliers if s['id'] == orders[order_index]['supplier_id']), None)
        if supplier:
            supplier['pending_amount'] = max(0, supplier['pending_amount'] - orders[order_index]['amount'])
            save_user_suppliers(current_user.id, suppliers)
    
    save_user_orders(current_user.id, orders)
    
    return orders[order_index]


# ==================== SUPPLIER CRUD ROUTES (DB-backed) ====================

def _supplier_to_dict(s) -> dict:
    """Convert Supplier ORM object to dict for API response"""
    return {
        "id": s.id,
        "name": s.name,
        "contact": s.contact,
        "phone": s.phone,
        "email": s.email,
        "address": s.address,
        "category": s.category or "General",
        "rating": 4.0,
        "total_orders": s.total_orders or 0,
        "pending_amount": s.pending_amount or 0.0,
        "total_paid": s.total_paid or 0.0,
        "last_order": s.last_order.isoformat() if s.last_order else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("", response_model=List[dict])
async def get_suppliers(
    search: Optional[str] = Query(None, description="Search by name or category"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all suppliers for the current user's store (DB-backed)"""
    from app.models import Supplier
    
    query = select(Supplier).where(
        Supplier.store_id == current_user.store_id,
        Supplier.is_active == True
    )
    
    if search:
        query = query.where(
            Supplier.name.ilike(f"%{search}%") | Supplier.category.ilike(f"%{search}%")
        )
    if category:
        query = query.where(Supplier.category.ilike(category))
    
    query = query.order_by(desc(Supplier.created_at))
    result = await db.execute(query)
    suppliers = result.scalars().all()
    
    # Fallback: also include any in-memory suppliers for backwards compat
    memory_suppliers = get_user_suppliers(current_user.id)
    db_list = [_supplier_to_dict(s) for s in suppliers]
    
    # Merge: DB suppliers take priority, add memory ones not in DB
    db_phones = {s['phone'] for s in db_list}
    for ms in memory_suppliers:
        if ms.get('phone') not in db_phones:
            db_list.append(ms)
    
    return db_list


@router.post("", response_model=dict)
async def create_supplier(
    supplier: SupplierCreate,
    current_user: User = Depends(require_supplier_manager),
    db: AsyncSession = Depends(get_db)
):
    """Create a new supplier (DB-backed)"""
    from app.models import Supplier
    
    # Check duplicate phone
    existing = await db.execute(
        select(Supplier).where(
            Supplier.store_id == current_user.store_id,
            Supplier.phone == supplier.phone,
            Supplier.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier with this phone already exists"
        )
    
    new_supplier = Supplier(
        store_id=current_user.store_id,
        name=supplier.name,
        contact=supplier.contact,
        phone=supplier.phone,
        email=supplier.email,
        address=supplier.address,
        category=supplier.category,
    )
    db.add(new_supplier)
    await db.commit()
    await db.refresh(new_supplier)
    
    return _supplier_to_dict(new_supplier)


@router.get("/{supplier_id}", response_model=dict)
async def get_supplier(
    supplier_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific supplier by ID (DB-backed)"""
    from app.models import Supplier
    
    result = await db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.store_id == current_user.store_id
        )
    )
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return _supplier_to_dict(supplier)


@router.put("/{supplier_id}", response_model=dict)
async def update_supplier(
    supplier_id: int,
    supplier_update: SupplierUpdate,
    current_user: User = Depends(require_supplier_manager),
    db: AsyncSession = Depends(get_db)
):
    """Update a supplier (DB-backed)"""
    from app.models import Supplier
    
    result = await db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.store_id == current_user.store_id
        )
    )
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    update_data = supplier_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None and hasattr(supplier, key):
            setattr(supplier, key, value)
    
    await db.commit()
    await db.refresh(supplier)
    
    return _supplier_to_dict(supplier)


@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(require_supplier_manager),
    db: AsyncSession = Depends(get_db)
):
    """Soft-delete a supplier (DB-backed)"""
    from app.models import Supplier
    
    result = await db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.store_id == current_user.store_id
        )
    )
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    supplier.is_active = False
    await db.commit()
    
    return {"message": f"Supplier '{supplier.name}' deleted successfully"}


@router.post("/{supplier_id}/payment", response_model=dict)
async def record_supplier_payment(
    supplier_id: int,
    payment: SupplierPayment,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a payment to supplier (DB-backed)"""
    from app.models import Supplier
    
    result = await db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.store_id == current_user.store_id
        )
    )
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    if payment.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be positive"
        )
    
    supplier.pending_amount = max(0, (supplier.pending_amount or 0) - payment.amount)
    supplier.total_paid = (supplier.total_paid or 0) + payment.amount
    await db.commit()
    await db.refresh(supplier)
    
    return {
        "message": f"Payment of ₹{payment.amount} recorded",
        "new_pending": supplier.pending_amount,
        "supplier": _supplier_to_dict(supplier)
    }

