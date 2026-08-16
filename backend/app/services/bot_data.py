"""
KadaiGPT - Shared bot report data queries

Single source of truth for the numbers the WhatsApp and Telegram *owner* bots
answer with (sales, expense, profit, stock, bills, customers, products, GST,
pending payments, daily report). Every query here is scoped to `store_id` so a
bot can never leak another store's data.

Each function takes an open AsyncSession + store_id and returns plain dicts;
the bots format those into chat messages.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Bill, BillItem, Product, Customer, Expense,
    BillStatus, PaymentMethod,
)

logger = logging.getLogger(__name__)


def _ist_day_bounds(days_ago: int = 0):
    """(start, end) for an IST business day, `days_ago` days back."""
    IST = timezone(timedelta(hours=5, minutes=30))
    start = (
        datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        - timedelta(days=days_ago)
    )
    return start, start + timedelta(days=1)


async def get_sales_summary(db: AsyncSession, store_id: int, days: int = 0) -> Dict[str, Any]:
    """Revenue/bill/avg-bill/payment-breakdown for a day (IST), vs the prior day."""
    start, end = _ist_day_bounds(days)
    result = await db.execute(
        select(Bill).where(
            Bill.store_id == store_id,
            Bill.status == BillStatus.COMPLETED,
            Bill.bill_date >= start,
            Bill.bill_date < end,
        )
    )
    bills = result.scalars().all()

    revenue = sum(b.total_amount or 0 for b in bills)
    breakdown: Dict[str, float] = {}
    for b in bills:
        method = (b.payment_method.value if b.payment_method else "CASH") or "CASH"
        breakdown[method] = breakdown.get(method, 0) + (b.total_amount or 0)

    prev_start, _ = _ist_day_bounds(days + 1)
    prev = await db.execute(
        select(func.sum(Bill.total_amount)).where(
            Bill.store_id == store_id,
            Bill.status == BillStatus.COMPLETED,
            Bill.bill_date >= prev_start,
            Bill.bill_date < start,
        )
    )
    prev_rev = prev.scalar() or 0
    change = ((revenue - prev_rev) / prev_rev * 100) if prev_rev else 0.0

    return {
        "revenue": round(revenue, 2),
        "bills": len(bills),
        "avg_bill": round(revenue / len(bills), 2) if bills else 0,
        "payment_breakdown": breakdown,
        "previous_revenue": round(prev_rev, 2),
        "change_percent": round(change, 1),
    }


async def get_expense_summary(db: AsyncSession, store_id: int, days: int = 0) -> Dict[str, Any]:
    """Total expenses + per-category breakdown for a day (IST)."""
    start, end = _ist_day_bounds(days)
    result = await db.execute(
        select(Expense).where(
            Expense.store_id == store_id,
            Expense.expense_date >= start,
            Expense.expense_date < end,
        )
    )
    expenses = result.scalars().all()
    total = sum(e.amount or 0 for e in expenses)
    by_category: Dict[str, float] = {}
    for e in expenses:
        cat = e.category or "other"
        by_category[cat] = by_category.get(cat, 0) + (e.amount or 0)
    return {"total": round(total, 2), "count": len(expenses), "by_category": by_category}


async def get_stock_summary(db: AsyncSession, store_id: int) -> Dict[str, Any]:
    """Inventory health: totals + low/out-of-stock lists."""
    result = await db.execute(
        select(Product).where(
            Product.store_id == store_id,
            Product.is_active == True,  # noqa: E712
        )
    )
    products = result.scalars().all()
    low = [p for p in products if 0 < (p.current_stock or 0) <= (p.min_stock_alert or 0)]
    out = [p for p in products if (p.current_stock or 0) <= 0]
    return {
        "total": len(products),
        "in_stock": len(products) - len(low) - len(out),
        "low": len(low),
        "out": len(out),
        "low_items": [
            {"name": p.name, "stock": p.current_stock or 0, "min": p.min_stock_alert or 0}
            for p in sorted(low + out, key=lambda p: p.current_stock or 0)[:10]
        ],
    }


async def get_recent_bills(db: AsyncSession, store_id: int, limit: int = 5) -> List[Dict[str, Any]]:
    """Most recent bills for the store."""
    result = await db.execute(
        select(Bill)
        .where(Bill.store_id == store_id)
        .order_by(Bill.bill_date.desc())
        .limit(limit)
    )
    return [
        {
            "id": b.id,
            "bill_number": b.bill_number,
            "total": b.total_amount or 0,
            "customer": b.customer_name or "Walk-in",
            "date": b.bill_date,
        }
        for b in result.scalars().all()
    ]


async def get_customers_summary(db: AsyncSession, store_id: int) -> Dict[str, Any]:
    """Customer counts: total, new this month, with outstanding credit."""
    result = await db.execute(
        select(Customer).where(
            Customer.store_id == store_id,
            Customer.deleted_at.is_(None),
        )
    )
    customers = result.scalars().all()
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = [c for c in customers if c.created_at and c.created_at >= month_start]
    with_balance = [c for c in customers if (c.credit or 0) > 0]
    return {
        "total": len(customers),
        "new_this_month": len(new_this_month),
        "with_balance": len(with_balance),
    }


async def get_pending_payments(db: AsyncSession, store_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """Customers with outstanding credit (khata), biggest first."""
    result = await db.execute(
        select(Customer)
        .where(
            Customer.store_id == store_id,
            Customer.deleted_at.is_(None),
            Customer.credit > 0,
        )
        .order_by(Customer.credit.desc())
        .limit(limit)
    )
    return [
        {"id": c.id, "name": c.name, "phone": c.phone, "amount": round(c.credit or 0, 2)}
        for c in result.scalars().all()
    ]


async def get_gst_summary(db: AsyncSession, store_id: int) -> Dict[str, Any]:
    """GST totals for the current month via the GST engine (reuses its math)."""
    from app.services.gst_engine import gst_engine

    now = datetime.now()
    report = await gst_engine.generate_gstr3b(db, store_id, now.year, now.month)
    summary = report.get("summary", {})
    return {
        "period": report.get("period", ""),
        "invoices": summary.get("total_invoices", 0),
        "taxable": summary.get("total_taxable", 0),
        "tax": summary.get("total_tax", 0),
    }


async def get_daily_report(db: AsyncSession, store_id: int) -> Dict[str, Any]:
    """Composite daily report used by both bots."""
    sales = await get_sales_summary(db, store_id)
    expenses = await get_expense_summary(db, store_id)
    stock = await get_stock_summary(db, store_id)
    customers = await get_customers_summary(db, store_id)
    pending = await get_pending_payments(db, store_id)
    return {
        "sales": sales,
        "expenses": expenses,
        "stock": stock,
        "customers": customers,
        "pending_total": round(sum(p["amount"] for p in pending), 2),
        "profit": round(sales["revenue"] - expenses["total"], 2),
    }


async def find_product_by_name(db: AsyncSession, store_id: int, name: str) -> Optional["Product"]:
    """Exact (case-insensitive) product match first, then a contains fallback."""
    from app.models import Product

    result = await db.execute(
        select(Product).where(
            Product.store_id == store_id,
            Product.is_active == True,  # noqa: E712
            Product.name.ilike(name.strip()),
        )
    )
    product = result.scalars().first()
    if product:
        return product

    result = await db.execute(
        select(Product).where(
            Product.store_id == store_id,
            Product.is_active == True,  # noqa: E712
            Product.name.ilike(f"%{name.strip()}%"),
        ).limit(5)
    )
    matches = result.scalars().all()
    return matches[0] if len(matches) == 1 else None
