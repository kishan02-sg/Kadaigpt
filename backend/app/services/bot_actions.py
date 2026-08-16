"""
KadaiGPT - Shared bot write actions

WhatsApp and Telegram *owner* bots both create products, bills and purchase
orders from chat conversations. Those writes live here (single source of
truth) instead of being duplicated per bot, and they re-use the same
validation as the HTTP endpoints:

- products  -> duplicate-name check within the store (merge stock, never
               silently duplicate)
- bills     -> create_bill_core (stock validation + inventory update + audit)
- purchase  -> supplier find-or-create + DB PurchaseOrder row + supplier stats
  orders

Every query is scoped to `store_id`.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product, Supplier, PurchaseOrder, Bill
from app.routers.audit import log_audit_event

logger = logging.getLogger(__name__)


# ==================== PRODUCTS ====================

async def create_product_for_store(
    db: AsyncSession,
    store_id: int,
    user_id: Optional[int],
    name: str,
    selling_price: float,
    current_stock: int,
    source: str = "whatsapp",
) -> Tuple[bool, str]:
    """Create a product in the store, or merge stock into an existing one.

    Returns (ok, message). Never creates a silent duplicate: if a product with
    the same name already exists in the store, its stock is topped up instead
    (selling price is left untouched) and the reply says so.
    """
    name = (name or "").strip()
    if not name:
        return False, "⚠️ Product name is required."
    if selling_price is None or selling_price < 0:
        return False, "⚠️ Selling price must be a positive number."
    if current_stock is None or current_stock < 0:
        return False, "⚠️ Stock quantity must be a positive number."

    existing = (
        await db.execute(
            select(Product).where(
                Product.store_id == store_id,
                Product.name.ilike(name),
            )
        )
    ).scalars().first()

    if existing:
        old_stock = existing.current_stock or 0
        existing.current_stock = old_stock + int(current_stock)
        existing.is_active = True
        await log_audit_event(
            db, store_id, user_id, "update", "product", existing.id,
            new_values={"current_stock": existing.current_stock, "source": source},
            ip_address=source,
        )
        await db.commit()
        await db.refresh(existing)
        logger.info(f"[bot:{source}] merged stock into product {existing.id} in store {store_id}")
        return (
            True,
            f"✅ *{existing.name}* already existed, so I added the new stock.\n"
            f"• New stock: {existing.current_stock} units\n"
            f"• Price kept: ₹{existing.selling_price:g}",
        )

    product = Product(
        store_id=store_id,
        name=name,
        selling_price=float(selling_price),
        cost_price=0.0,
        current_stock=int(current_stock),
        min_stock_alert=10,
        unit="pieces",
        is_active=True,
    )
    db.add(product)
    await db.flush()
    await log_audit_event(
        db, store_id, user_id, "create", "product", product.id,
        new_values={"name": name, "selling_price": selling_price,
                    "current_stock": current_stock, "source": source},
        ip_address=source,
    )
    await db.commit()
    await db.refresh(product)
    logger.info(f"[bot:{source}] created product {product.id} in store {store_id}")
    return (
        True,
        f"✅ *{name}* added!\n• Price: ₹{product.selling_price:g}\n• Stock: {product.current_stock} units",
    )


# ==================== PURCHASE ORDERS ====================

async def find_or_create_supplier(
    db: AsyncSession,
    store_id: int,
    name: str,
    phone: Optional[str] = None,
    source: str = "whatsapp",
) -> Supplier:
    """Find a supplier by name within the store, or create one."""
    name = (name or "").strip()
    supplier = (
        await db.execute(
            select(Supplier).where(
                Supplier.store_id == store_id,
                Supplier.name.ilike(name),
                Supplier.is_active == True,  # noqa: E712
            )
        )
    ).scalars().first()
    if supplier:
        return supplier

    supplier = Supplier(
        store_id=store_id,
        name=name,
        contact=None,
        phone=(phone or "").strip() or None,
        category="General",
        is_active=True,
    )
    db.add(supplier)
    await db.flush()
    return supplier


async def create_purchase_order_for_store(
    db: AsyncSession,
    store_id: int,
    user_id: Optional[int],
    supplier_name: str,
    items: List[Dict[str, Any]],
    supplier_phone: Optional[str] = None,
    notes: Optional[str] = None,
    source: str = "whatsapp",
) -> Tuple[bool, str, Optional[PurchaseOrder]]:
    """Create a PurchaseOrder row for a store, creating the supplier if needed.

    items: [{"name": str, "qty": int}] — prices aren't collected in the chat
    flow, so unit_price defaults to 0 (amount is 0 until priced in the app).
    """
    if not items:
        return False, "⚠️ No items in the order.", None

    supplier = await find_or_create_supplier(db, store_id, supplier_name, supplier_phone, source)
    order_items = [
        {
            "product_name": it.get("name", "").strip(),
            "quantity": float(it.get("qty", 1)),
            "unit": it.get("unit", "units"),
            "unit_price": float(it.get("unit_price", 0) or 0),
        }
        for it in items
        if it.get("name")
    ]
    if not order_items:
        return False, "⚠️ No valid items in the order.", None

    amount = sum(it["quantity"] * it["unit_price"] for it in order_items)
    seq = (
        await db.execute(
            select(func.count(PurchaseOrder.id)).where(PurchaseOrder.store_id == store_id)
        )
    ).scalar() or 0
    # order_number is UNIQUE across all stores — include store_id so two
    # stores' first POs (or a re-run against the same DB) can't collide.
    order_number = f"PO-{datetime.utcnow().strftime('%Y')}-{store_id}-{str(seq + 1).zfill(4)}"

    po = PurchaseOrder(
        store_id=store_id,
        supplier_id=supplier.id,
        order_number=order_number,
        items=order_items,
        item_count=len(order_items),
        amount=round(amount, 2),
        status="pending",
        notes=notes,
    )
    db.add(po)
    await db.flush()

    # Supplier stats
    supplier.total_orders = (supplier.total_orders or 0) + 1
    supplier.pending_amount = (supplier.pending_amount or 0) + amount
    supplier.last_order = datetime.utcnow()

    await log_audit_event(
        db, store_id, user_id, "create", "purchase_order", po.id,
        new_values={"order_number": order_number, "supplier_id": supplier.id,
                    "item_count": len(order_items), "amount": round(amount, 2), "source": source},
        ip_address=source,
    )
    await db.commit()
    await db.refresh(po)
    logger.info(f"[bot:{source}] created PO {po.id} for store {store_id}")
    return True, order_number, po


# ==================== BILLS ====================

async def create_bill_for_bot(
    db: AsyncSession,
    store_id: int,
    user_id: Optional[int],
    items: List[Dict[str, Any]],
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    payment_method: Any = None,
    source: str = "whatsapp",
) -> Tuple[bool, str, Optional[Bill]]:
    """Create a bill from free-text chat items via create_bill_core.

    items: [{"name": str, "qty": int, "price": float}] — product_id is matched
    by name within the store so stock is validated/decremented for real
    inventory; unmatched items are billed as-is without touching stock.
    """
    from app.constants.roles import PaymentMethod as PaymentMethodEnum
    from app.routers.bills import create_bill_core, BillCreationError

    method = payment_method or PaymentMethodEnum.CASH
    if not isinstance(method, PaymentMethodEnum):
        try:
            method = PaymentMethodEnum(method)
        except (ValueError, TypeError):
            method = PaymentMethodEnum.CASH

    core_items = []
    for it in items:
        name = (it.get("name") or "").strip()
        if not name:
            continue
        qty = float(it.get("qty", 1) or 1)
        price = float(it.get("price", 0) or 0)
        product = (
            await db.execute(
                select(Product).where(
                    Product.store_id == store_id,
                    Product.is_active == True,  # noqa: E712
                    Product.name.ilike(name),
                )
            )
        ).scalars().first()
        core_items.append({
            "product_id": product.id if product else None,
            "product_name": name,
            "product_sku": product.sku if product else None,
            "unit_price": price,
            "quantity": qty,
            "discount_percent": 0,
            "tax_rate": product.tax_rate if product else 0,
        })

    if not core_items:
        return False, "⚠️ No valid items in the bill.", None

    try:
        bill = await create_bill_core(
            db=db,
            store_id=store_id,
            cashier_id=user_id,
            items=core_items,
            customer_name=customer_name,
            customer_phone=customer_phone,
            payment_method=method,
            source=source,
        )
    except BillCreationError as e:
        if e.code == "insufficient_stock":
            lines = "\n".join(
                f"• {it['product_name']}: only {it['available']:g} in stock (need {it['requested']:g})"
                for it in e.items
            )
            return False, f"⚠️ *Insufficient stock* — bill not created.\n{lines}", None
        return False, f"⚠️ {e.message}", None
    except Exception as exc:  # defensive: never crash the bot on a bad bill
        logger.exception(f"[bot:{source}] bill creation failed: {exc}")
        return False, "⚠️ Something went wrong creating the bill. Please try again.", None

    return True, bill.bill_number, bill
