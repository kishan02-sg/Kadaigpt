"""
KadaiGPT - Dashboard Stats Router
Provides real-time statistics for the dashboard

FIXED: All column references now match actual model definitions
- Bill.store_id (not user_id)
- Product.store_id (not user_id)
- Product.current_stock (not stock)
- Product.min_stock_alert (not min_stock)
- Product.selling_price (not price)
- Bill.total_amount (not total)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db
from app.models import User, Bill, Product, BillStatus
from app.routers.auth import get_current_active_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard statistics for the current user's store
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    try:
        # Get today's completed bills for the store
        bills_result = await db.execute(
            select(Bill)
            .where(
                and_(
                    Bill.store_id == current_user.store_id,
                    Bill.status == BillStatus.COMPLETED,
                    Bill.bill_date >= today
                )
            )
        )
        today_bills = bills_result.scalars().all()
        
        # Get all active products for the store
        products_result = await db.execute(
            select(Product)
            .where(
                and_(
                    Product.store_id == current_user.store_id,
                    Product.is_active == True
                )
            )
        )
        products = products_result.scalars().all()
        
        # Calculate stats using correct column names
        today_sales = sum(float(bill.total_amount or 0) for bill in today_bills)
        today_bills_count = len(today_bills)
        avg_bill_value = today_sales / today_bills_count if today_bills_count > 0 else 0
        low_stock_count = sum(
            1 for p in products 
            if (p.current_stock or 0) <= (p.min_stock_alert or 10)
        )
        
        # Yesterday's stats for comparison
        yesterday = today - timedelta(days=1)
        yesterday_result = await db.execute(
            select(func.sum(Bill.total_amount)).where(
                and_(
                    Bill.store_id == current_user.store_id,
                    Bill.status == BillStatus.COMPLETED,
                    Bill.bill_date >= yesterday,
                    Bill.bill_date < today
                )
            )
        )
        yesterday_sales = float(yesterday_result.scalar() or 0)
        
        # Revenue change
        revenue_change = 0
        if yesterday_sales > 0:
            revenue_change = round(((today_sales - yesterday_sales) / yesterday_sales) * 100, 1)
        
        return {
            "todaySales": round(today_sales, 2),
            "todayBills": today_bills_count,
            "avgBillValue": round(avg_bill_value, 2),
            "lowStockCount": low_stock_count,
            "totalProducts": len(products),
            "yesterdaySales": round(yesterday_sales, 2),
            "revenueChange": revenue_change,
            "lastUpdated": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"[Dashboard] Stats error: {e}")
        return {
            "todaySales": 0,
            "todayBills": 0,
            "avgBillValue": 0,
            "lowStockCount": 0,
            "totalProducts": 0,
            "yesterdaySales": 0,
            "revenueChange": 0,
            "lastUpdated": datetime.now().isoformat(),
            "error": str(e)
        }


@router.get("/activity")
async def get_activity_feed(
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent activity feed for the dashboard
    """
    activities = []
    
    try:
        # Get recent bills for the store
        bills_result = await db.execute(
            select(Bill)
            .where(Bill.store_id == current_user.store_id)
            .order_by(Bill.created_at.desc())
            .limit(5)
        )
        recent_bills = bills_result.scalars().all()
        
        for bill in recent_bills:
            time_ago = get_time_ago(bill.created_at)
            activities.append({
                "id": f"bill_{bill.id}",
                "type": "sale",
                "message": f"Bill #{bill.bill_number} - ₹{bill.total_amount:.0f}",
                "time": time_ago,
                "amount": float(bill.total_amount or 0),
                "payment": bill.payment_method.value if bill.payment_method else "cash"
            })
        
        # Get low stock products for the store
        products_result = await db.execute(
            select(Product)
            .where(
                and_(
                    Product.store_id == current_user.store_id,
                    Product.is_active == True,
                    Product.current_stock <= Product.min_stock_alert
                )
            )
            .limit(5)
        )
        low_stock = products_result.scalars().all()
        
        for product in low_stock:
            activities.append({
                "id": f"stock_{product.id}",
                "type": "stock",
                "message": f"Low stock: {product.name} ({product.current_stock} left)",
                "time": "now"
            })
        
        return activities[:limit]
    except Exception as e:
        print(f"[Dashboard] Activity error: {e}")
        return []


def get_time_ago(dt: datetime) -> str:
    """Convert datetime to human-readable time ago string"""
    if not dt:
        return "unknown"
    
    now = datetime.now()
    # Handle timezone-aware datetimes
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    
    diff = now - dt
    seconds = diff.total_seconds()
    
    if seconds < 0:
        return "just now"
    elif seconds < 60:
        return "just now"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} min ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    else:
        days = int(seconds / 86400)
        return f"{days} day{'s' if days > 1 else ''} ago"


@router.get("/insights")
async def get_ai_insights(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get AI-generated insights for the business
    """
    insights = []
    
    try:
        # Get product data for the store
        products_result = await db.execute(
            select(Product)
            .where(
                and_(
                    Product.store_id == current_user.store_id,
                    Product.is_active == True
                )
            )
        )
        products = products_result.scalars().all()
        
        # Low stock insight
        low_stock_products = [
            p for p in products 
            if (p.current_stock or 0) <= (p.min_stock_alert or 10)
        ]
        if low_stock_products:
            names = ', '.join(p.name for p in low_stock_products[:3])
            insights.append({
                "icon": "📦",
                "title": "Stock Alert",
                "text": f"{len(low_stock_products)} products low: {names}",
                "priority": "high"
            })
        
        # High value inventory using correct field names
        if products:
            total_value = sum(
                (p.current_stock or 0) * (p.selling_price or 0) 
                for p in products
            )
            high_value = sorted(
                products, 
                key=lambda p: (p.current_stock or 0) * (p.selling_price or 0), 
                reverse=True
            )[:3]
            insights.append({
                "icon": "💰",
                "title": "Inventory Value",
                "text": f"Total inventory worth ₹{total_value:,.0f}. Top: {high_value[0].name if high_value else 'N/A'}",
                "priority": "medium"
            })
        
        # Sales insight
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        bills_result = await db.execute(
            select(func.count(Bill.id), func.sum(Bill.total_amount))
            .where(
                and_(
                    Bill.store_id == current_user.store_id,
                    Bill.status == BillStatus.COMPLETED,
                    Bill.bill_date >= today
                )
            )
        )
        row = bills_result.one()
        bill_count = row[0] or 0
        bill_total = float(row[1] or 0)
        
        if bill_count > 0:
            insights.append({
                "icon": "📈",
                "title": "Today's Sales",
                "text": f"{bill_count} bills worth ₹{bill_total:,.0f} today",
                "priority": "medium"
            })
        
        # Pro tip
        insights.append({
            "icon": "💡",
            "title": "Pro Tip",
            "text": "Use voice commands or scan handwritten bills with OCR to save time!",
            "priority": "low"
        })
        
        return {"insights": insights}
    except Exception as e:
        print(f"[Dashboard] Insights error: {e}")
        return {
            "insights": [
                {
                    "icon": "🚀",
                    "title": "Welcome to KadaiGPT",
                    "text": "Add products and create bills to see AI-powered insights!",
                    "priority": "low"
                }
            ]
        }
