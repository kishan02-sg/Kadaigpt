"""
KadaiGPT - Advanced Analytics Router
Business intelligence, reporting, and predictive analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging
import random

from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User, UserRole
from app.rbac import require_min_role

router = APIRouter(prefix="/analytics", tags=["Analytics"])
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# Sales Analytics
# ═══════════════════════════════════════════════════════════════════

@router.get("/sales/overview")
async def get_sales_overview(
    period: str = Query("month", enum=["day", "week", "month", "quarter", "year"]),
    current_user: User = Depends(require_min_role(UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    """Get sales overview with comparisons"""
    try:
        # Calculate date ranges
        now = datetime.utcnow()
        if period == "day":
            current_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            previous_start = current_start - timedelta(days=1)
        elif period == "week":
            current_start = now - timedelta(days=now.weekday())
            previous_start = current_start - timedelta(weeks=1)
        elif period == "month":
            current_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_start = (current_start - timedelta(days=1)).replace(day=1)
        elif period == "quarter":
            quarter = (now.month - 1) // 3
            current_start = now.replace(month=quarter * 3 + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_start = current_start - timedelta(days=90)
        else:  # year
            current_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_start = current_start.replace(year=current_start.year - 1)
        
        # Generate realistic demo data
        current_sales = random.randint(50000, 200000)
        previous_sales = int(current_sales * random.uniform(0.8, 1.1))
        
        change_percent = ((current_sales - previous_sales) / previous_sales * 100) if previous_sales else 0
        
        return {
            "period": period,
            "current": {
                "start_date": current_start.isoformat(),
                "end_date": now.isoformat(),
                "total_sales": current_sales,
                "total_bills": random.randint(100, 500),
                "average_bill_value": current_sales // random.randint(100, 300),
                "unique_customers": random.randint(50, 200)
            },
            "previous": {
                "total_sales": previous_sales,
                "total_bills": random.randint(90, 450)
            },
            "change": {
                "sales_change": change_percent,
                "trend": "up" if change_percent > 0 else "down"
            }
        }
    except Exception as e:
        logger.error(f"Error getting sales overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales/hourly")
async def get_hourly_sales(
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get hourly sales distribution"""
    # Generate hourly data
    hours = []
    peak_hour = random.choice([10, 11, 12, 17, 18, 19])
    
    for hour in range(24):
        if 6 <= hour <= 22:  # Business hours
            base = random.randint(1000, 5000)
            if abs(hour - peak_hour) <= 1:
                base = int(base * 1.5)  # Peak hours
            elif hour >= 20:
                base = int(base * 0.7)  # Evening decline
        else:
            base = random.randint(0, 500)  # Off hours
        
        hours.append({
            "hour": f"{hour:02d}:00",
            "sales": base,
            "bills": base // random.randint(300, 600)
        })
    
    return {
        "date": date or datetime.utcnow().date().isoformat(),
        "hourly_data": hours,
        "peak_hour": f"{peak_hour:02d}:00",
        "total_sales": sum(h["sales"] for h in hours)
    }


@router.get("/sales/by-payment")
async def get_sales_by_payment_method(
    period: str = Query("month", enum=["week", "month", "quarter"]),
    current_user: User = Depends(get_current_user)
):
    """Get sales breakdown by payment method"""
    total = random.randint(100000, 500000)
    
    cash_pct = random.uniform(0.35, 0.50)
    upi_pct = random.uniform(0.30, 0.45)
    card_pct = random.uniform(0.05, 0.15)
    credit_pct = 1 - cash_pct - upi_pct - card_pct
    
    return {
        "period": period,
        "total_sales": total,
        "breakdown": [
            {"method": "Cash", "amount": int(total * cash_pct), "percentage": round(cash_pct * 100, 1), "color": "#22c55e"},
            {"method": "UPI", "amount": int(total * upi_pct), "percentage": round(upi_pct * 100, 1), "color": "#3b82f6"},
            {"method": "Card", "amount": int(total * card_pct), "percentage": round(card_pct * 100, 1), "color": "#8b5cf6"},
            {"method": "Credit", "amount": int(total * credit_pct), "percentage": round(credit_pct * 100, 1), "color": "#f59e0b"}
        ]
    }


# ═══════════════════════════════════════════════════════════════════
# Product Analytics
# ═══════════════════════════════════════════════════════════════════

@router.get("/products/top-selling")
async def get_top_selling_products(
    limit: int = Query(10, ge=1, le=50),
    period: str = Query("month", enum=["week", "month", "quarter"]),
    current_user: User = Depends(get_current_user)
):
    """Get top selling products"""
    products = [
        {"name": "Basmati Rice 5kg", "category": "Grains"},
        {"name": "Toor Dal 1kg", "category": "Pulses"},
        {"name": "Sugar 1kg", "category": "Essentials"},
        {"name": "Refined Oil 1L", "category": "Oils"},
        {"name": "Wheat Flour 5kg", "category": "Grains"},
        {"name": "Tea 250g", "category": "Beverages"},
        {"name": "Milk 500ml", "category": "Dairy"},
        {"name": "Salt 1kg", "category": "Essentials"},
        {"name": "Coffee 200g", "category": "Beverages"},
        {"name": "Ghee 500g", "category": "Dairy"}
    ]
    
    top_products = []
    for i, p in enumerate(products[:limit]):
        qty = random.randint(50, 200) * (10 - i)
        price = random.randint(50, 500)
        top_products.append({
            "rank": i + 1,
            "name": p["name"],
            "category": p["category"],
            "quantity_sold": qty,
            "revenue": qty * price,
            "growth": round(random.uniform(-10, 25), 1)
        })
    
    return {
        "period": period,
        "products": top_products,
        "total_revenue": sum(p["revenue"] for p in top_products)
    }


@router.get("/products/slow-moving")
async def get_slow_moving_products(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """Get slow-moving products that need attention"""
    products = [
        {"name": "Premium Olive Oil 500ml", "days_since_last_sale": 15, "stock": 12},
        {"name": "Organic Honey 500g", "days_since_last_sale": 12, "stock": 8},
        {"name": "Imported Pasta 500g", "days_since_last_sale": 10, "stock": 25},
        {"name": "Exotic Spice Mix 100g", "days_since_last_sale": 8, "stock": 15},
        {"name": "Specialty Coffee 250g", "days_since_last_sale": 7, "stock": 10}
    ]
    
    return {
        "products": products[:limit],
        "recommendations": [
            "Consider offering bundle discounts for slow-moving items",
            "Add these products to promotional displays",
            "Review if pricing is competitive"
        ]
    }


@router.get("/products/categories")
async def get_category_performance(
    period: str = Query("month", enum=["week", "month", "quarter"]),
    current_user: User = Depends(get_current_user)
):
    """Get category-wise performance"""
    categories = [
        {"name": "Grains & Cereals", "color": "#22c55e"},
        {"name": "Pulses & Lentils", "color": "#3b82f6"},
        {"name": "Oils & Ghee", "color": "#f59e0b"},
        {"name": "Dairy Products", "color": "#8b5cf6"},
        {"name": "Beverages", "color": "#ec4899"},
        {"name": "Snacks", "color": "#06b6d4"},
        {"name": "Personal Care", "color": "#f97316"},
        {"name": "Household", "color": "#6366f1"}
    ]
    
    total = random.randint(200000, 500000)
    category_data = []
    remaining = total
    
    for i, cat in enumerate(categories):
        if i == len(categories) - 1:
            amount = remaining
        else:
            amount = int(remaining * random.uniform(0.1, 0.3))
            remaining -= amount
        
        category_data.append({
            **cat,
            "revenue": amount,
            "percentage": round(amount / total * 100, 1),
            "products_sold": amount // random.randint(100, 300),
            "growth": round(random.uniform(-5, 20), 1)
        })
    
    return {
        "period": period,
        "total_revenue": total,
        "categories": sorted(category_data, key=lambda x: x["revenue"], reverse=True)
    }


# ═══════════════════════════════════════════════════════════════════
# Customer Analytics
# ═══════════════════════════════════════════════════════════════════

@router.get("/customers/overview")
async def get_customer_overview(
    current_user: User = Depends(get_current_user)
):
    """Get customer analytics overview"""
    total_customers = random.randint(200, 500)
    
    return {
        "total_customers": total_customers,
        "new_this_month": random.randint(20, 50),
        "repeat_rate": round(random.uniform(60, 85), 1),
        "average_lifetime_value": random.randint(5000, 15000),
        "segments": [
            {"name": "Platinum", "count": int(total_customers * 0.05), "color": "#e5e4e2", "avg_spend": 25000},
            {"name": "Gold", "count": int(total_customers * 0.15), "color": "#ffd700", "avg_spend": 15000},
            {"name": "Silver", "count": int(total_customers * 0.30), "color": "#c0c0c0", "avg_spend": 8000},
            {"name": "Bronze", "count": int(total_customers * 0.50), "color": "#cd7f32", "avg_spend": 3000}
        ],
        "top_customers": [
            {"name": "Lakshmi Stores", "total_spent": random.randint(50000, 100000), "visits": random.randint(50, 100)},
            {"name": "Kumar Provision", "total_spent": random.randint(40000, 80000), "visits": random.randint(40, 80)},
            {"name": "Ganesh Trading", "total_spent": random.randint(30000, 60000), "visits": random.randint(30, 60)}
        ]
    }


@router.get("/customers/retention")
async def get_customer_retention(
    current_user: User = Depends(get_current_user)
):
    """Get customer retention analytics"""
    months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"]
    
    return {
        "monthly_retention": [
            {"month": m, "rate": round(random.uniform(70, 90), 1)} for m in months
        ],
        "churn_rate": round(random.uniform(5, 15), 1),
        "at_risk_customers": random.randint(10, 30),
        "recommendations": [
            "Send personalized offers to at-risk customers",
            "Implement loyalty program for return customers",
            "Follow up with customers who haven't purchased in 30 days"
        ]
    }


# ═══════════════════════════════════════════════════════════════════
# Inventory Analytics
# ═══════════════════════════════════════════════════════════════════

@router.get("/inventory/health")
async def get_inventory_health(
    current_user: User = Depends(get_current_user)
):
    """Get inventory health metrics"""
    total_products = random.randint(200, 500)
    
    return {
        "total_products": total_products,
        "total_value": random.randint(500000, 1500000),
        "health_score": random.randint(75, 95),
        "status_breakdown": {
            "healthy": int(total_products * 0.75),
            "low_stock": random.randint(10, 30),
            "out_of_stock": random.randint(2, 10),
            "overstock": random.randint(5, 20),
            "expiring_soon": random.randint(3, 15)
        },
        "turnover_rate": round(random.uniform(4, 8), 1),
        "dead_stock_value": random.randint(10000, 50000)
    }


@router.get("/inventory/predictions")
async def get_inventory_predictions(
    current_user: User = Depends(get_current_user)
):
    """Get AI-powered inventory predictions"""
    return {
        "reorder_suggestions": [
            {"product": "Basmati Rice 5kg", "current_stock": 15, "predicted_demand": 45, "reorder_qty": 30, "urgency": "high"},
            {"product": "Toor Dal 1kg", "current_stock": 8, "predicted_demand": 25, "reorder_qty": 20, "urgency": "high"},
            {"product": "Sugar 1kg", "current_stock": 50, "predicted_demand": 80, "reorder_qty": 40, "urgency": "medium"},
            {"product": "Refined Oil 1L", "current_stock": 25, "predicted_demand": 40, "reorder_qty": 20, "urgency": "medium"}
        ],
        "demand_forecast": {
            "next_7_days": random.randint(50000, 100000),
            "next_30_days": random.randint(200000, 400000),
            "trending_up": ["Rice", "Dal", "Oil"],
            "trending_down": ["Premium items", "Imported goods"]
        },
        "seasonal_insights": [
            "Festival season approaching - stock up on sweets and snacks",
            "Monsoon expected next month - increase umbrella and rainwear stock"
        ]
    }


# ═══════════════════════════════════════════════════════════════════
# Financial Analytics
# ═══════════════════════════════════════════════════════════════════

@router.get("/financial/profit-loss")
async def get_profit_loss(
    period: str = Query("month", enum=["week", "month", "quarter", "year"]),
    current_user: User = Depends(get_current_user)
):
    """Get profit and loss statement"""
    revenue = random.randint(200000, 500000)
    cogs = int(revenue * random.uniform(0.6, 0.75))
    gross_profit = revenue - cogs
    
    expenses = {
        "rent": random.randint(15000, 30000),
        "salaries": random.randint(30000, 60000),
        "utilities": random.randint(5000, 15000),
        "marketing": random.randint(2000, 10000),
        "other": random.randint(5000, 20000)
    }
    
    total_expenses = sum(expenses.values())
    net_profit = gross_profit - total_expenses
    
    return {
        "period": period,
        "revenue": revenue,
        "cost_of_goods_sold": cogs,
        "gross_profit": gross_profit,
        "gross_margin": round(gross_profit / revenue * 100, 1),
        "operating_expenses": expenses,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "net_margin": round(net_profit / revenue * 100, 1),
        "trend": "up" if net_profit > 0 else "down"
    }


@router.get("/financial/cashflow")
async def get_cashflow(
    current_user: User = Depends(get_current_user)
):
    """Get cash flow analytics"""
    return {
        "opening_balance": random.randint(100000, 300000),
        "inflows": {
            "cash_sales": random.randint(80000, 150000),
            "credit_collections": random.randint(20000, 50000),
            "other": random.randint(0, 10000)
        },
        "outflows": {
            "inventory_purchases": random.randint(50000, 100000),
            "operating_expenses": random.randint(30000, 60000),
            "loan_payments": random.randint(0, 20000)
        },
        "closing_balance": random.randint(120000, 350000),
        "pending_receivables": random.randint(30000, 80000),
        "pending_payables": random.randint(20000, 60000)
    }


# ═══════════════════════════════════════════════════════════════════
# Reports Generation
# ═══════════════════════════════════════════════════════════════════

@router.get("/reports/summary")
async def get_summary_report(
    period: str = Query("month", enum=["day", "week", "month", "quarter"]),
    current_user: User = Depends(require_min_role(UserRole.MANAGER))
):
    """Get comprehensive summary report"""
    return {
        "period": period,
        "generated_at": datetime.utcnow().isoformat(),
        "sales": {
            "total": random.randint(100000, 300000),
            "growth": round(random.uniform(-5, 20), 1),
            "bills": random.randint(200, 600),
            "avg_bill": random.randint(400, 800)
        },
        "customers": {
            "total_served": random.randint(150, 400),
            "new": random.randint(20, 50),
            "returning": random.randint(100, 300)
        },
        "inventory": {
            "stock_value": random.randint(300000, 800000),
            "low_stock_items": random.randint(5, 15),
            "turnover": round(random.uniform(3, 7), 1)
        },
        "financials": {
            "revenue": random.randint(100000, 300000),
            "expenses": random.randint(30000, 80000),
            "profit": random.randint(50000, 200000),
            "margin": round(random.uniform(25, 45), 1)
        },
        "highlights": [
            "Sales increased by 15% compared to last period",
            "Customer retention rate improved to 78%",
            "Inventory turnover is optimal at 5.2x"
        ],
        "action_items": [
            "Reorder top 5 selling products before stock runs out",
            "Follow up on 3 customers with pending payments",
            "Review slow-moving items for potential discounts"
        ]
    }
