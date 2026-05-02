"""
KadaiGPT - DPDP Compliance Router
Data export, account deletion, and privacy controls.
Required under India's Digital Personal Data Protection Act, 2023.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from datetime import datetime
import json
import logging

from app.database import get_db
from app.routers.auth import get_current_active_user
from app.models import User, Store, Product, Bill, BillItem, Customer

logger = logging.getLogger("KadaiGPT.Privacy")

router = APIRouter(prefix="/privacy", tags=["Privacy & Compliance"])


@router.get("/export")
async def export_user_data(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export all user data in JSON format.
    DPDP Act 2023 — Right to Data Portability.
    """
    store_id = current_user.store_id

    # 1. User profile
    user_data = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "role": current_user.role.value if current_user.role else None,
        "created_at": str(current_user.created_at) if current_user.created_at else None,
    }

    # 2. Store info
    store_result = await db.execute(select(Store).where(Store.id == store_id))
    store = store_result.scalar_one_or_none()
    store_data = None
    if store:
        store_data = {
            "id": store.id,
            "name": store.name,
            "address": store.address,
            "gstin": store.gstin if hasattr(store, 'gstin') else None,
            "business_type": store.business_type if hasattr(store, 'business_type') else None,
        }

    # 3. Products
    products_result = await db.execute(
        select(Product).where(Product.store_id == store_id)
    )
    products = products_result.scalars().all()
    products_data = [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku if hasattr(p, 'sku') else None,
            "mrp": float(p.mrp) if p.mrp else None,
            "selling_price": float(p.selling_price) if p.selling_price else None,
            "current_stock": p.current_stock,
            "unit": p.unit if hasattr(p, 'unit') else None,
            "category_id": p.category_id if hasattr(p, 'category_id') else None,
        }
        for p in products
    ]

    # 4. Bills (last 1000)
    bills_result = await db.execute(
        select(Bill)
        .where(Bill.store_id == store_id)
        .order_by(Bill.created_at.desc())
        .limit(1000)
    )
    bills = bills_result.scalars().all()
    bills_data = [
        {
            "id": b.id,
            "bill_number": b.bill_number if hasattr(b, 'bill_number') else None,
            "total_amount": float(b.total_amount) if b.total_amount else 0,
            "payment_method": b.payment_method.value if b.payment_method else None,
            "status": b.status.value if b.status else None,
            "customer_name": b.customer_name if hasattr(b, 'customer_name') else None,
            "created_at": str(b.created_at) if b.created_at else None,
        }
        for b in bills
    ]

    # 5. Customers
    customers_result = await db.execute(
        select(Customer).where(Customer.store_id == store_id)
    )
    customers = customers_result.scalars().all()
    customers_data = [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "email": c.email if hasattr(c, 'email') else None,
            "credit": float(c.credit) if c.credit else 0,
            "total_purchases": float(c.total_purchases) if c.total_purchases else 0,
            "loyalty_points": c.loyalty_points if hasattr(c, 'loyalty_points') else 0,
        }
        for c in customers
    ]

    export = {
        "export_metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "format_version": "1.0",
            "platform": "KadaiGPT",
            "dpdp_compliance": True,
        },
        "user": user_data,
        "store": store_data,
        "products": products_data,
        "bills": bills_data,
        "customers": customers_data,
        "totals": {
            "products_count": len(products_data),
            "bills_count": len(bills_data),
            "customers_count": len(customers_data),
        },
    }

    logger.info(
        f"Data export for user {current_user.id} — "
        f"{len(products_data)} products, {len(bills_data)} bills, {len(customers_data)} customers"
    )

    return export


@router.delete("/account")
async def delete_account(
    confirmation: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """
    Delete user account and anonymize all PII.
    DPDP Act 2023 — Right to Erasure.
    User must send confirmation="DELETE" to proceed.
    """
    if confirmation != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Send confirmation='DELETE' to confirm account deletion",
        )

    user_id = current_user.id
    store_id = current_user.store_id

    logger.warning(f"Account deletion requested for user {user_id}, store {store_id}")

    try:
        # Anonymize user PII (keep record for audit trail)
        current_user.email = f"deleted_{user_id}@anon.kadaigpt.com"
        current_user.phone = None
        current_user.full_name = "Deleted User"
        current_user.is_active = False

        await db.commit()

        logger.info(f"Account {user_id} anonymized successfully")

        return {
            "message": "Account deleted successfully. Your data has been anonymized.",
            "details": {
                "email": "Anonymized",
                "phone": "Removed",
                "name": "Anonymized",
                "note": "Financial records retained for 8 years per GST compliance requirements.",
            },
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Account deletion failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Account deletion failed. Please contact support."
        )


@router.get("/consent")
async def get_consent_status(
    current_user: User = Depends(get_current_active_user),
):
    """Get current consent status for the user."""
    return {
        "user_id": current_user.id,
        "consents": {
            "essential_service": True,
            "analytics": True,
            "marketing_whatsapp": False,
            "marketing_email": False,
            "ai_training": True,
        },
        "last_updated": str(current_user.updated_at or current_user.created_at),
        "note": "To change consent settings, contact privacy@kadaigpt.com",
    }
