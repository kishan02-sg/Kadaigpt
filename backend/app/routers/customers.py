"""
KadaiGPT - Customers Router
Manage customer credit book (Khata) and customer relationships
Now using DATABASE for persistence!
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import Optional, List
from pydantic import BaseModel, validator
from datetime import datetime
import re

from app.database import get_db
from app.models import User, Customer
from app.routers.auth import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])


# ==================== SCHEMAS ====================

class CustomerCreate(BaseModel):
    """Schema for creating a customer"""
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    credit: Optional[float] = 0.0
    loyalty_points: Optional[int] = 0
    total_purchases: Optional[float] = 0.0

    @validator('phone')
    def validate_phone(cls, v):
        cleaned = re.sub(r'\D', '', v)
        if len(cleaned) != 10:
            raise ValueError('Phone number must be exactly 10 digits')
        if not re.match(r'^[6-9]', cleaned):
            raise ValueError('Phone number must start with 6, 7, 8, or 9')
        return cleaned


class CustomerUpdate(BaseModel):
    """Schema for updating a customer"""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    credit: Optional[float] = None
    loyalty_points: Optional[int] = None
    total_purchases: Optional[float] = None
    last_purchase: Optional[str] = None

    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r'\D', '', v)
        if len(cleaned) != 10:
            raise ValueError('Phone number must be exactly 10 digits')
        if not re.match(r'^[6-9]', cleaned):
            raise ValueError('Phone number must start with 6, 7, 8, or 9')
        return cleaned


class CustomerPayment(BaseModel):
    """Schema for recording a payment"""
    amount: float


class CustomerCredit(BaseModel):
    """Schema for adding credit"""
    amount: float
    notes: Optional[str] = None


# ==================== ROUTES ====================

@router.get("/stats/summary", response_model=dict)
async def get_customer_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get customer statistics from database"""
    try:
        # Try with deleted_at filter first
        try:
            query = select(Customer).where(
                Customer.store_id == current_user.store_id,
                Customer.deleted_at.is_(None)
            )
            result = await db.execute(query)
            customers = result.scalars().all()
        except Exception:
            # deleted_at column may not exist in DB yet - rollback and retry without it
            await db.rollback()
            query = select(Customer).where(Customer.store_id == current_user.store_id)
            result = await db.execute(query)
            customers = result.scalars().all()
        
        total_customers = len(customers)
        total_credit = sum(getattr(c, 'credit', 0) or 0 for c in customers)
        customers_with_credit = sum(1 for c in customers if (getattr(c, 'credit', 0) or 0) > 0)
        total_business = sum(getattr(c, 'total_purchases', 0) or 0 for c in customers)
        
        return {
            "total_customers": total_customers,
            "total_credit": total_credit,
            "customers_with_credit": customers_with_credit,
            "total_business": total_business
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error fetching customer stats: {e}")
        return {
            "total_customers": 0,
            "total_credit": 0,
            "customers_with_credit": 0,
            "total_business": 0
        }


@router.get("", response_model=List[dict])
async def get_customers(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    has_credit: Optional[bool] = Query(None, description="Filter by credit status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all customers for the current user's store from database"""
    try:
        # Build base query
        base_filters = [Customer.store_id == current_user.store_id]
        
        # Try with deleted_at filter first, fallback without it
        try:
            query = select(Customer).where(*base_filters, Customer.deleted_at.is_(None))
            # Test the query works
            result = await db.execute(query.limit(0))
            # It works, rebuild with all filters
            query = select(Customer).where(*base_filters, Customer.deleted_at.is_(None))
        except Exception:
            await db.rollback()
            query = select(Customer).where(*base_filters)
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Customer.name.ilike(search_term),
                    Customer.phone.ilike(search_term)
                )
            )
        
        # Apply credit filter
        if has_credit is not None:
            if has_credit:
                query = query.where(Customer.credit > 0)
            else:
                query = query.where(Customer.credit == 0)
        
        query = query.order_by(desc(Customer.created_at))
        result = await db.execute(query)
        customers = result.scalars().all()
        
        return [
            {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "email": getattr(c, 'email', None),
                "address": getattr(c, 'address', None),
                "credit": getattr(c, 'credit', 0) or 0,
                "total_purchases": getattr(c, 'total_purchases', 0) or 0,
                "loyalty_points": getattr(c, 'loyalty_points', 0) or 0,
                "last_purchase": c.last_purchase.isoformat() if getattr(c, 'last_purchase', None) else None,
                "is_paid": (getattr(c, 'credit', 0) or 0) == 0,
                "created_at": c.created_at.isoformat() if getattr(c, 'created_at', None) else None
            }
            for c in customers
        ]
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error fetching customers: {e}")
        # Return empty list instead of 500 error
        return []


@router.post("", response_model=dict)
async def create_customer(
    customer: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new customer in database"""
    # Check if phone already exists
    existing = await db.execute(
        select(Customer).where(
            Customer.store_id == current_user.store_id,
            Customer.phone == customer.phone
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer with this phone already exists"
        )
    
    # Create new customer
    new_customer = Customer(
        store_id=current_user.store_id,
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        address=customer.address,
        credit=customer.credit or 0.0,
        loyalty_points=customer.loyalty_points or 0,
        total_purchases=customer.total_purchases or 0.0,
        last_purchase=datetime.utcnow() if customer.total_purchases else None
    )
    
    db.add(new_customer)
    await db.commit()
    await db.refresh(new_customer)
    
    return {
        "id": new_customer.id,
        "name": new_customer.name,
        "phone": new_customer.phone,
        "email": new_customer.email,
        "address": new_customer.address,
        "credit": new_customer.credit,
        "total_purchases": new_customer.total_purchases,
        "loyalty_points": new_customer.loyalty_points,
        "last_purchase": new_customer.last_purchase.isoformat() if new_customer.last_purchase else None,
        "is_paid": new_customer.credit == 0,
        "created_at": new_customer.created_at.isoformat()
    }


@router.get("/{customer_id}", response_model=dict)
async def get_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific customer by ID from database"""
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        )
    )
    customer = result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "credit": customer.credit,
        "total_purchases": customer.total_purchases,
        "loyalty_points": customer.loyalty_points,
        "last_purchase": customer.last_purchase.isoformat() if customer.last_purchase else None,
        "is_paid": customer.credit == 0,
        "created_at": customer.created_at.isoformat()
    }


@router.put("/{customer_id}", response_model=dict)
async def update_customer(
    customer_id: int,
    customer_update: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a customer in database"""
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        )
    )
    customer = result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Update fields if provided
    if customer_update.name is not None:
        customer.name = customer_update.name
    if customer_update.phone is not None:
        customer.phone = customer_update.phone
    if customer_update.email is not None:
        customer.email = customer_update.email
    if customer_update.address is not None:
        customer.address = customer_update.address
    if customer_update.credit is not None:
        customer.credit = customer_update.credit
    if customer_update.loyalty_points is not None:
        customer.loyalty_points = customer_update.loyalty_points
    if customer_update.total_purchases is not None:
        customer.total_purchases = customer_update.total_purchases
    if customer_update.last_purchase is not None:
        customer.last_purchase = datetime.fromisoformat(customer_update.last_purchase.replace('Z', '+00:00'))
    
    await db.commit()
    await db.refresh(customer)
    
    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "credit": customer.credit,
        "total_purchases": customer.total_purchases,
        "loyalty_points": customer.loyalty_points,
        "last_purchase": customer.last_purchase.isoformat() if customer.last_purchase else None,
        "is_paid": customer.credit == 0,
        "created_at": customer.created_at.isoformat()
    }


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a customer from database"""
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        )
    )
    customer = result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    await db.delete(customer)
    await db.commit()
    
    return {"message": "Customer deleted successfully"}


@router.post("/{customer_id}/payment", response_model=dict)
async def record_payment(
    customer_id: int,
    payment: CustomerPayment,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a payment from customer (reduces credit)"""
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        )
    )
    customer = result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Reduce credit by payment amount
    customer.credit = max(0, (customer.credit or 0) - payment.amount)
    
    await db.commit()
    await db.refresh(customer)
    
    return {
        "id": customer.id,
        "name": customer.name,
        "credit": customer.credit,
        "message": f"Payment of ₹{payment.amount} recorded"
    }


@router.post("/{customer_id}/credit", response_model=dict)
async def add_credit(
    customer_id: int,
    credit: CustomerCredit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add credit to customer account"""
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        )
    )
    customer = result.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Add to credit
    customer.credit = (customer.credit or 0) + credit.amount
    
    await db.commit()
    await db.refresh(customer)
    
    return {
        "id": customer.id,
        "name": customer.name,
        "credit": customer.credit,
        "message": f"Credit of ₹{credit.amount} added"
    }
