"""
KadaiGPT - Data Backup & Export Router
Export store data to JSON/CSV for backup and portability
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta
import json

from app.database import get_db
from app.models import (
    User, Store, Product, Bill, BillItem, Customer, 
    Category, DailySummary
)
from app.routers.auth import get_current_active_user

router = APIRouter(prefix="/backup", tags=["Data Backup"])


@router.get("/export")
async def export_store_data(
    include_bills: bool = Query(True, description="Include bills in export"),
    include_products: bool = Query(True, description="Include products"),
    include_customers: bool = Query(True, description="Include customers"),
    days: int = Query(90, ge=1, le=365, description="Export bills from last N days"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export all store data as JSON for backup.
    This is a complete backup that can be used for migration or disaster recovery.
    """
    store_id = current_user.store_id
    export_data = {
        "export_info": {
            "exported_at": datetime.utcnow().isoformat(),
            "exported_by": current_user.email,
            "store_id": store_id,
            "kadaigpt_version": "2.0.0",
            "format_version": "1.0",
        },
        "store": None,
        "categories": [],
        "products": [],
        "customers": [],
        "bills": [],
        "daily_summaries": [],
    }
    
    # Store info
    store_result = await db.execute(select(Store).where(Store.id == store_id))
    store = store_result.scalar_one_or_none()
    if store:
        export_data["store"] = {
            "name": store.name,
            "address": store.address,
            "phone": store.phone,
            "gst_number": store.gst_number,
            "business_type": store.business_type,
            "currency": store.currency,
            "tax_rate": store.tax_rate,
        }
    
    # Categories
    cat_result = await db.execute(select(Category).where(Category.store_id == store_id))
    for cat in cat_result.scalars().all():
        export_data["categories"].append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "icon": cat.icon,
            "color": cat.color,
        })
    
    # Products
    if include_products:
        prod_result = await db.execute(
            select(Product).where(Product.store_id == store_id)
        )
        for p in prod_result.scalars().all():
            export_data["products"].append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "category_id": p.category_id,
                "selling_price": p.selling_price,
                "cost_price": p.cost_price,
                "mrp": p.mrp,
                "current_stock": p.current_stock,
                "min_stock_alert": p.min_stock_alert,
                "unit": p.unit,
                "tax_rate": p.tax_rate,
                "hsn_code": p.hsn_code,
                "is_active": p.is_active,
                "manufacturer": p.manufacturer,
            })
    
    # Customers
    if include_customers:
        cust_result = await db.execute(
            select(Customer).where(Customer.store_id == store_id)
        )
        for c in cust_result.scalars().all():
            export_data["customers"].append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "email": c.email,
                "address": c.address,
                "credit": c.credit,
                "total_purchases": c.total_purchases,
                "loyalty_points": c.loyalty_points,
            })
    
    # Bills (with items)
    if include_bills:
        cutoff = datetime.utcnow() - timedelta(days=days)
        bill_result = await db.execute(
            select(Bill)
            .where(Bill.store_id == store_id, Bill.created_at >= cutoff)
            .order_by(Bill.created_at.desc())
        )
        for bill in bill_result.scalars().all():
            # Get items for this bill
            items_result = await db.execute(
                select(BillItem).where(BillItem.bill_id == bill.id)
            )
            items = []
            for item in items_result.scalars().all():
                items.append({
                    "product_name": item.product_name,
                    "product_sku": item.product_sku,
                    "unit_price": item.unit_price,
                    "quantity": item.quantity,
                    "discount_percent": item.discount_percent,
                    "tax_rate": item.tax_rate,
                    "subtotal": item.subtotal,
                    "total": item.total,
                })
            
            export_data["bills"].append({
                "id": bill.id,
                "bill_number": bill.bill_number,
                "bill_date": bill.bill_date.isoformat() if bill.bill_date else None,
                "customer_name": bill.customer_name,
                "customer_phone": bill.customer_phone,
                "subtotal": bill.subtotal,
                "discount_amount": bill.discount_amount,
                "tax_amount": bill.tax_amount,
                "total_amount": bill.total_amount,
                "payment_method": bill.payment_method.value if hasattr(bill.payment_method, 'value') else str(bill.payment_method),
                "amount_paid": bill.amount_paid,
                "change_amount": bill.change_amount,
                "status": bill.status.value if hasattr(bill.status, 'value') else str(bill.status),
                "items": items,
                "created_at": bill.created_at.isoformat() if bill.created_at else None,
            })
    
    # Daily Summaries
    summary_cutoff = datetime.utcnow() - timedelta(days=days)
    try:
        summary_result = await db.execute(
            select(DailySummary)
            .where(DailySummary.store_id == store_id, DailySummary.summary_date >= summary_cutoff.date())
            .order_by(DailySummary.summary_date.desc())
        )
        for s in summary_result.scalars().all():
            export_data["daily_summaries"].append({
                "date": s.summary_date.isoformat() if s.summary_date else None,
                "total_revenue": s.total_revenue,
                "total_bills": s.total_bills,
                "total_items_sold": s.total_items_sold,
            })
    except Exception:
        pass  # Daily summaries table may not exist yet
    
    # Add counts
    export_data["export_info"]["counts"] = {
        "categories": len(export_data["categories"]),
        "products": len(export_data["products"]),
        "customers": len(export_data["customers"]),
        "bills": len(export_data["bills"]),
        "daily_summaries": len(export_data["daily_summaries"]),
    }
    
    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=kadaigpt_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )


@router.get("/stats")
async def get_backup_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get database statistics for the store (useful for monitoring)."""
    store_id = current_user.store_id
    
    # Count records
    product_count = await db.execute(
        select(func.count(Product.id)).where(Product.store_id == store_id)
    )
    bill_count = await db.execute(
        select(func.count(Bill.id)).where(Bill.store_id == store_id)
    )
    customer_count = await db.execute(
        select(func.count(Customer.id)).where(Customer.store_id == store_id)
    )
    
    # Recent activity
    recent_bills = await db.execute(
        select(func.count(Bill.id))
        .where(Bill.store_id == store_id, Bill.created_at >= datetime.utcnow() - timedelta(days=7))
    )
    
    return {
        "store_id": store_id,
        "total_products": product_count.scalar() or 0,
        "total_bills": bill_count.scalar() or 0,
        "total_customers": customer_count.scalar() or 0,
        "bills_last_7_days": recent_bills.scalar() or 0,
        "last_checked": datetime.utcnow().isoformat(),
    }
