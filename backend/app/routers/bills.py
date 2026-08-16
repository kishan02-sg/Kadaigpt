"""
KadaiGPT - Bills Router
Core billing functionality with AI agent integration
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from app.services.whatsapp_bot import whatsapp_bot
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import uuid
import logging

from app.config import settings
from app.database import get_db
from app.models import Bill, BillItem, Product, User, Store, Customer, BillStatus, PaymentMethod, UserRole, Payment
from app.schemas import BillCreate, BillResponse, BillSummary, PrintRequest, PrintStatus, PaymentInfo
from app.services.razorpay_service import razorpay_service

logger = logging.getLogger(__name__)
from app.routers.auth import get_current_active_user
from app.rbac import require_min_role
from app.agents import print_agent, inventory_agent, offline_agent
from app.routers.audit import log_audit_event
from app.routers.inapp_notifications import create_system_notification


router = APIRouter(prefix="/bills", tags=["Bills"])


class BillCreationError(Exception):
    """User-actionable failure raised by create_bill_core.

    Raised instead of HTTPException so both the HTTP endpoint and the
    WhatsApp/Telegram bots can call the same logic: the endpoint maps it to
    an HTTP response, the bots map it to a chat message.
    """

    def __init__(self, message: str, code: str = "bill_error", items: Optional[list] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.items = items or []


def generate_bill_number(store_prefix: str = "INV") -> str:
    """Generate unique bill number"""
    date_part = datetime.now().strftime("%Y%m%d")
    unique_part = uuid.uuid4().hex[:4].upper()
    return f"{store_prefix}-{date_part}-{unique_part}"


async def calculate_bill_totals(items: List[dict]) -> dict:
    """Calculate bill totals from items"""
    subtotal = 0.0
    total_discount = 0.0
    total_tax = 0.0
    
    for item in items:
        item_subtotal = item["unit_price"] * item["quantity"]
        item_discount = item_subtotal * (item.get("discount_percent", 0) / 100)
        item_taxable = item_subtotal - item_discount
        item_tax = item_taxable * (item.get("tax_rate", 0) / 100)
        
        subtotal += item_subtotal
        total_discount += item_discount
        total_tax += item_tax
    
    total = subtotal - total_discount + total_tax
    
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(total_discount, 2),
        "tax_amount": round(total_tax, 2),
        "total_amount": round(total, 2)
    }


@router.get("", response_model=List[BillSummary])
async def list_bills(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    status: Optional[BillStatus] = None,
    payment_method: Optional[PaymentMethod] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all bills with filtering"""
    query = select(Bill).where(Bill.store_id == current_user.store_id)
    
    if date_from:
        query = query.where(Bill.bill_date >= date_from)
    
    if date_to:
        query = query.where(Bill.bill_date <= date_to)
    
    if status:
        query = query.where(Bill.status == status)
    
    if payment_method:
        query = query.where(Bill.payment_method == payment_method)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            Bill.bill_number.ilike(search_term) |
            Bill.customer_name.ilike(search_term) |
            Bill.customer_phone.ilike(search_term)
        )
    
    query = query.order_by(Bill.bill_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bills = result.scalars().all()
    
    # Transform to summary
    summaries = []
    for bill in bills:
        # Get items count
        items_result = await db.execute(
            select(func.count(BillItem.id)).where(BillItem.bill_id == bill.id)
        )
        items_count = items_result.scalar() or 0
        
        summaries.append(BillSummary(
            id=bill.id,
            bill_number=bill.bill_number,
            total_amount=bill.total_amount,
            status=bill.status,
            payment_method=bill.payment_method,
            customer_name=bill.customer_name,
            customer_phone=bill.customer_phone,
            items_count=items_count,
            created_at=bill.created_at
        ))
    
    return summaries


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific bill with items"""
    result = await db.execute(
        select(Bill)
        .options(selectinload(Bill.items))
        .where(
            and_(
                Bill.id == bill_id,
                Bill.store_id == current_user.store_id
            )
        )
    )
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    return bill


async def _build_bill_response(db: AsyncSession, bill_id: int) -> BillResponse:
    """Fetch a bill + items via raw SQL and build the response (no ORM lazy loading)."""
    from sqlalchemy import text

    bill_row = await db.execute(
        text("SELECT id, store_id, bill_number, bill_date, customer_name, customer_phone, "
             "subtotal, discount_amount, tax_amount, total_amount, payment_method, "
             "amount_paid, change_amount, status, is_printed, print_count, created_at "
             "FROM bills WHERE id = :bill_id"),
        {"bill_id": bill_id}
    )
    b = bill_row.mappings().first()
    if b is None:
        raise BillCreationError("Bill not found", code="not_found")

    items_row = await db.execute(
        text("SELECT id, product_id, product_name, product_sku, unit_price, quantity, "
             "discount_percent, tax_rate, subtotal, discount_amount, tax_amount, total "
             "FROM bill_items WHERE bill_id = :bill_id"),
        {"bill_id": bill_id}
    )
    raw_items = [dict(row) for row in items_row.mappings().all()]

    return BillResponse(
        id=b["id"],
        store_id=b["store_id"],
        bill_number=b["bill_number"],
        bill_date=b["bill_date"] or b["created_at"] or datetime.utcnow(),
        customer_name=b["customer_name"],
        customer_phone=b["customer_phone"],
        subtotal=b["subtotal"],
        discount_amount=b["discount_amount"],
        tax_amount=b["tax_amount"],
        total_amount=b["total_amount"],
        payment_method=b["payment_method"],
        amount_paid=b["amount_paid"],
        change_amount=b["change_amount"],
        status=b["status"],
        is_printed=b["is_printed"] or False,
        print_count=b["print_count"] or 0,
        items=raw_items,
        created_at=b["created_at"] or datetime.utcnow(),
    )


async def create_bill_core(
    db: AsyncSession,
    store_id: int,
    cashier_id: Optional[int],
    items: List[dict],
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    payment_method: PaymentMethod = PaymentMethod.CASH,
    amount_paid: Optional[float] = None,
    local_id: Optional[str] = None,
    source: str = "app",
    background_tasks: Optional[BackgroundTasks] = None,
    initiate_upi_qr: bool = False,
) -> BillResponse:
    """Create a bill + items, update inventory and customer credit.

    Single source of truth for bill creation — used by both the HTTP endpoint
    and the WhatsApp/Telegram bots. `source` ("app" | "whatsapp" | "telegram")
    is recorded in the audit trail; app-originated bills additionally get the
    WhatsApp auto-send background task (bot-originated bills don't, since the
    bot is already in a conversation with the shop owner).

    Items are dicts with the same shape as BillItemCreate:
    {"product_id", "product_name", "product_sku", "unit_price", "quantity",
     "discount_percent", "tax_rate"}. product_id is optional — items typed
    free-form by a bot user (no product_id) skip stock validation/decrement.

    Raises BillCreationError on user-actionable failures (empty bill,
    insufficient stock, stock changed mid-transaction).
    """
    if not items:
        raise BillCreationError("Bill must have at least one item", code="empty_bill")

    # ── Offline-sync dedup ──────────────────────────────────────────────────
    # A retried sync request (e.g. the POST succeeded but the response was
    # lost during a flaky reconnect) must not create a second bill. When a
    # local_id is supplied, reuse the existing bill if one already exists.
    if local_id:
        existing = await db.execute(
            select(Bill).where(
                Bill.store_id == store_id,
                Bill.local_id == local_id,
            )
        )
        existing_bill = existing.scalar_one_or_none()
        if existing_bill:
            import logging as _logging
            _logging.getLogger(__name__).info(
                f"local_id {local_id} already synced as bill {existing_bill.id} — returning existing"
            )
            return await _build_bill_response(db, existing_bill.id)

    # Get store for prefix
    store_result = await db.execute(
        select(Store).where(Store.id == store_id)
    )
    store = store_result.scalar_one_or_none()

    # ═══════════════════════════════════════════════════
    # 🛡️ STOCK VALIDATION: Prevent negative stock (BUG-001 fix)
    # Validate ALL items have sufficient stock BEFORE creating the bill
    # ═══════════════════════════════════════════════════
    insufficient_items = []
    for item in items:
        if item.get("product_id"):
            prod_check = await db.execute(
                select(Product).where(
                    Product.id == item["product_id"],
                    Product.store_id == store_id,
                )
            )
            product = prod_check.scalar_one_or_none()
            if product:
                if product.current_stock < item["quantity"]:
                    insufficient_items.append({
                        "product_name": item.get("product_name") or product.name,
                        "product_id": item["product_id"],
                        "available": product.current_stock,
                        "requested": item["quantity"],
                        "shortfall": round(item["quantity"] - product.current_stock, 2)
                    })

    if insufficient_items:
        raise BillCreationError(
            f"{len(insufficient_items)} item(s) have insufficient stock",
            code="insufficient_stock",
            items=insufficient_items,
        )
    # ═══════════════════════════════════════════════════

    # Process items
    processed_items = []
    inventory_updates = []

    for item in items:
        # Calculate item totals
        item_subtotal = item["unit_price"] * item["quantity"]
        item_discount = item_subtotal * (item.get("discount_percent") or 0) / 100
        item_taxable = item_subtotal - item_discount
        item_tax = item_taxable * (item.get("tax_rate") or 0) / 100
        item_total = item_taxable + item_tax

        processed_item = {
            "product_id": item.get("product_id"),
            "product_name": item["product_name"],
            "product_sku": item.get("product_sku"),
            "unit_price": item["unit_price"],
            "quantity": item["quantity"],
            "discount_percent": item.get("discount_percent") or 0,
            "tax_rate": item.get("tax_rate") or 0,
            "subtotal": round(item_subtotal, 2),
            "discount_amount": round(item_discount, 2),
            "tax_amount": round(item_tax, 2),
            "total": round(item_total, 2)
        }
        processed_items.append(processed_item)

        # Track for inventory update
        if item.get("product_id"):
            prod_result = await db.execute(
                select(Product).where(
                    Product.id == item["product_id"],
                    Product.store_id == store_id,
                )
            )
            product = prod_result.scalar_one_or_none()
            if product:
                # Double-check stock (race condition protection)
                if product.current_stock < item["quantity"]:
                    raise BillCreationError(
                        f"Stock for '{item['product_name']}' changed during transaction. Please retry.",
                        code="stock_changed",
                    )
                inventory_updates.append({
                    "product_id": item["product_id"],
                    "product_name": item["product_name"],
                    "quantity": item["quantity"],
                    "current_stock": product.current_stock,
                    "min_stock": product.min_stock_alert
                })

    # Calculate totals
    totals = await calculate_bill_totals([
        {
            "unit_price": item["unit_price"],
            "quantity": item["quantity"],
            "discount_percent": item.get("discount_percent") or 0,
            "tax_rate": item.get("tax_rate") or 0
        }
        for item in items
    ])

    # Determine amount paid and change
    amount_paid = amount_paid if amount_paid else totals["total_amount"]
    change_amount = max(0, amount_paid - totals["total_amount"])

    # Generate bill number
    bill_number = generate_bill_number("INV")
    if local_id:  # Offline bill
        bill_number = offline_agent.generate_offline_bill_number("OFL")

    # Create bill
    bill = Bill(
        store_id=store_id,
        cashier_id=cashier_id,
        bill_number=bill_number,
        customer_name=customer_name,
        customer_phone=customer_phone,
        subtotal=totals["subtotal"],
        discount_amount=totals["discount_amount"],
        tax_amount=totals["tax_amount"],
        total_amount=totals["total_amount"],
        payment_method=payment_method,
        amount_paid=amount_paid,
        change_amount=change_amount,
        status=BillStatus.COMPLETED,
        local_id=local_id
    )

    db.add(bill)
    await db.flush()  # Get bill ID

    # Create bill items
    for item_data in processed_items:
        bill_item = BillItem(
            bill_id=bill.id,
            **item_data
        )
        db.add(bill_item)

    # 📦 INVENTORY AGENT: Update stock
    if inventory_updates:
        stock_result = await inventory_agent.deduct_stock_from_sale(inventory_updates, db)

        # Update products in database
        for update in inventory_updates:
            await db.execute(
                Product.__table__.update()
                .where(Product.id == update["product_id"])
                .values(current_stock=Product.current_stock - update["quantity"])
            )

    # Capture bill_id before commit (flush already gave us the id)
    bill_id = bill.id

    # Audit trail (same as app-originated bills)
    await log_audit_event(
        db,
        store_id=store_id,
        user_id=cashier_id,
        action="create",
        entity_type="bill",
        entity_id=bill_id,
        new_values={
            "bill_number": bill_number,
            "total_amount": totals["total_amount"],
            "payment_method": payment_method.value if hasattr(payment_method, "value") else str(payment_method),
            "source": source,
            "items_count": len(items),
        },
        ip_address=source,
    )

    try:
        await db.commit()
    except IntegrityError:
        # Race condition: a concurrent sync attempt inserted the same
        # local_id between our existence check and this commit (the unique
        # constraint on (store_id, local_id) caught it). Roll back our
        # attempt — including its inventory decrement and audit row — and
        # return the bill the other attempt committed.
        await db.rollback()
        existing = await db.execute(
            select(Bill).where(
                Bill.store_id == store_id,
                Bill.local_id == local_id,
            )
        )
        existing_bill = existing.scalar_one_or_none()
        if existing_bill:
            return await _build_bill_response(db, existing_bill.id)
        raise

    # Build the response via raw SQL (no ORM lazy loading — MissingGreenlet fix)
    response = await _build_bill_response(db, bill_id)

    # ⭐ LOYALTY POINTS + CREDIT/DUE: update the customer record
    if customer_phone:
        try:
            points_earned = int(totals["total_amount"] / 10)
            # A "Due"/Credit bill is unpaid — add the full amount to the customer's
            # outstanding credit (khata) so it reflects on the Customers page.
            due_amount = totals["total_amount"] if payment_method == PaymentMethod.CREDIT else 0
            # Use a bound timestamp instead of NOW() — NOW() is Postgres-only and
            # errors on SQLite, which silently broke this whole block locally.
            now_ts = datetime.utcnow()

            cust_row = await db.execute(
                text("SELECT id, name, loyalty_points, total_purchases FROM customers "
                     "WHERE store_id = :store_id AND phone = :phone"),
                {"store_id": store_id, "phone": customer_phone}
            )
            existing = cust_row.mappings().first()

            if existing:
                await db.execute(
                    text("UPDATE customers SET loyalty_points = loyalty_points + :pts, "
                         "total_purchases = COALESCE(total_purchases, 0) + :total, "
                         "credit = COALESCE(credit, 0) + :due, "
                         "last_purchase = :now WHERE id = :cid"),
                    {"pts": points_earned, "total": totals["total_amount"], "due": due_amount,
                     "now": now_ts, "cid": existing["id"]}
                )
                await db.commit()
            else:
                await db.execute(
                    text("INSERT INTO customers (store_id, name, phone, loyalty_points, total_purchases, last_purchase, credit) "
                         "VALUES (:store_id, :name, :phone, :pts, :total, :now, :due)"),
                    {
                        "store_id": store_id,
                        "name": customer_name or "Walk-in",
                        "phone": customer_phone,
                        "pts": points_earned,
                        "total": totals["total_amount"],
                        "due": due_amount,
                        "now": now_ts,
                    }
                )
                await db.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Loyalty FAILED: {type(e).__name__}: {e}")
            try:
                await db.rollback()
            except Exception:
                pass

    # 💳 UPI CHECKOUT: when Razorpay is configured and the cashier picked UPI,
    # create a real single-use QR for the exact amount and hold the bill in
    # PENDING_PAYMENT until the qr_code.credited webhook confirms it. On any
    # failure here the bill stays COMPLETED and the checkout falls back to the
    # manual-trust UPI flow (static ID shown, cashier confirms by eye).
    payment_info = None
    if initiate_upi_qr and razorpay_service.is_configured:
        payment_info = await _initiate_upi_payment(db, bill_id, totals["total_amount"], bill_number)
        if payment_info is None:
            logger.warning(
                f"[Payments] QR initiation failed for bill {bill_number} — "
                "keeping COMPLETED (manual UPI fallback)"
            )
    if payment_info is not None:
        response.payment = payment_info
        # The response was built before the QR flip — reflect the pending state.
        response.status = BillStatus.PENDING_PAYMENT

    # 📲 Auto-send the bill on WhatsApp (only for app-originated bills with a
    # provider configured and a customer phone). Runs in the background so it
    # never delays the response. Bot-originated bills skip this — the bot is
    # already replying to the shop owner in the same conversation.
    if (
        source == "app"
        and background_tasks is not None
        and customer_phone
        and whatsapp_bot.is_configured
    ):
        store_name = (store.name if store else None) or "KadaiGPT Store"
        wa_msg = _format_bill_whatsapp(
            {
                "bill_number": response.bill_number,
                "total_amount": response.total_amount,
                "payment_method": (
                    response.payment_method.value
                    if hasattr(response.payment_method, "value")
                    else str(response.payment_method)
                ),
            },
            [dict(it) for it in response.items],
            store_name,
        )
        background_tasks.add_task(whatsapp_bot.send_message, customer_phone, wa_msg)

    return response


async def _initiate_upi_payment(
    db: AsyncSession,
    bill_id: int,
    amount_inr: float,
    bill_number: str,
) -> Optional[PaymentInfo]:
    """Create a Razorpay checkout QR + Payment row; hold the bill pending.

    Returns PaymentInfo on success (bill flipped to PENDING_PAYMENT, QR shown
    to the customer). Returns None on ANY failure — the bill stays COMPLETED
    and the checkout falls back to the manual-trust UPI flow. All DB work is
    raw SQL: the ORM Bill instance is expired after create_bill_core's commit,
    and touching it here would trigger a MissingGreenlet lazy-load.
    """
    try:
        qr = await razorpay_service.create_qr_code(
            amount_inr, bill_number, notes={"bill_id": str(bill_id)}
        )
    except Exception as e:
        logger.warning(f"[Payments] create_qr_code failed for bill {bill_number}: {type(e).__name__}: {e}")
        return None

    qr_code_id = qr.get("id")
    qr_image_url = qr.get("image_url")
    if not qr_code_id:
        logger.warning(f"[Payments] Razorpay QR response missing 'id' for bill {bill_number}: {qr}")
        return None

    now = datetime.utcnow()
    expires_at = now + timedelta(seconds=settings.upi_payment_timeout_seconds)
    try:
        await db.execute(
            text("INSERT INTO payments (bill_id, razorpay_qr_code_id, amount, status, "
                 "qr_image_url, expires_at) VALUES (:bid, :qid, :amt, 'pending', :url, :exp)"),
            {"bid": bill_id, "qid": qr_code_id, "amt": amount_inr,
             "url": qr_image_url, "exp": expires_at},
        )
        await db.execute(
            text("UPDATE bills SET status = 'PENDING_PAYMENT' WHERE id = :bid"),
            {"bid": bill_id},
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"[Payments] payment row failed for bill {bill_number}: {type(e).__name__}: {e}")
        try:
            await db.rollback()
        except Exception:
            pass
        return None

    return PaymentInfo(
        id=0,  # filled by the payment-status endpoint; the frontend keys off bill id
        status="pending",
        amount=amount_inr,
        qr_image_url=qr_image_url,
        razorpay_qr_code_id=qr_code_id,
        expires_at=expires_at,
    )


@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    bill_data: BillCreate,
    background_tasks: BackgroundTasks,
    auto_print: bool = Query(default=True, description="Automatically print bill"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🧠 AGENTIC BILLING: Create a new bill with AI agent orchestration

    Thin wrapper around create_bill_core (single source of truth shared with
    the WhatsApp/Telegram bots). UPI bills get a real Razorpay checkout QR
    when the gateway is configured (initiate_upi_qr=True).
    """
    try:
        return await create_bill_core(
            db=db,
            store_id=current_user.store_id,
            cashier_id=current_user.id,
            items=[item.model_dump() for item in bill_data.items],
            customer_name=bill_data.customer_name,
            customer_phone=bill_data.customer_phone,
            payment_method=bill_data.payment_method,
            amount_paid=bill_data.amount_paid,
            local_id=bill_data.local_id,
            source="app",
            background_tasks=background_tasks,
            initiate_upi_qr=(bill_data.payment_method == PaymentMethod.UPI),
        )
    except BillCreationError as e:
        if e.code == "insufficient_stock":
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "insufficient_stock",
                    "message": e.message,
                    "items": e.items,
                }
            )
        if e.code == "stock_changed":
            raise HTTPException(status_code=409, detail=e.message)
        raise HTTPException(status_code=400, detail=e.message)


def localStorage_store_name(user) -> str:
    """Best-effort store name for messages (falls back gracefully)."""
    try:
        return getattr(getattr(user, "store", None), "name", None) or ""
    except Exception:
        return ""


def _format_bill_whatsapp(b: dict, items: list, store_name: str) -> str:
    """Compose a concise bill message for WhatsApp."""
    lines = [f"🧾 *{store_name}*", f"Bill: {b['bill_number']}", ""]
    for it in items[:20]:
        name = it.get("product_name") or it.get("name") or "Item"
        qty = it.get("quantity", 1)
        amt = it.get("total_price") or it.get("unit_price") or 0
        lines.append(f"• {name} x{qty} — ₹{amt}")
    lines += [
        "",
        f"*Total: ₹{b['total_amount']}*",
        f"Payment: {b['payment_method']}",
        "",
        "Thank you for shopping with us! 🙏",
        "_Powered by KadaiGPT_",
    ]
    return "\n".join(lines)


@router.post("/{bill_id}/print", response_model=PrintStatus)
async def print_bill(
    bill_id: int,
    print_request: PrintRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🖨️ PRINT AGENT: Print or reprint a bill
    """
    result = await db.execute(
        select(Bill).where(
            and_(
                Bill.id == bill_id,
                Bill.store_id == current_user.store_id
            )
        )
    )
    bill = result.scalar_one_or_none()
    
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Get items
    items_result = await db.execute(
        select(BillItem).where(BillItem.bill_id == bill.id)
    )
    items = items_result.scalars().all()
    
    # Get store name
    store_result = await db.execute(
        select(Store).where(Store.id == current_user.store_id)
    )
    store = store_result.scalar_one_or_none()
    
    # Prepare bill data for printing
    bill_for_print = {
        "id": bill.id,
        "bill_number": bill.bill_number,
        "store_name": store.name if store else "KadaiGPT Store",
        "items": [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "total": item.total
            }
            for item in items
        ],
        "total_amount": bill.total_amount
    }
    
    # Get print decision
    print_decision = await print_agent.decide_print_strategy(
        bill_for_print,
        print_request.printer_name
    )
    
    if not print_decision.should_print:
        return PrintStatus(
            job_id=0,
            status="failed",
            message=print_decision.reason,
            attempts=0
        )
    
    # Generate and print
    receipt_content = print_agent.generate_receipt_content(bill_for_print)
    print_result = await print_agent.execute_silent_print(
        receipt_content,
        print_decision.printer_name
    )
    
    # Update bill
    if print_result.get("success"):
        bill.is_printed = True
        bill.print_count += 1
        await db.commit()
    
    return PrintStatus(
        job_id=bill.id,
        status="completed" if print_result.get("success") else "failed",
        message=print_result.get("message", ""),
        attempts=print_result.get("attempts", 1)
    )


@router.post("/{bill_id}/cancel")
async def cancel_bill(
    bill_id: int,
    current_user: User = Depends(require_min_role(UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a bill and restore inventory (Manager/Owner only)"""
    result = await db.execute(
        select(Bill).where(
            and_(
                Bill.id == bill_id,
                Bill.store_id == current_user.store_id
            )
        )
    )
    bill = result.scalar_one_or_none()
    
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if bill.status == BillStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Bill already cancelled")
    
    # Get items to restore inventory
    items_result = await db.execute(
        select(BillItem).where(BillItem.bill_id == bill.id)
    )
    items = items_result.scalars().all()
    
    # Restore inventory
    for item in items:
        if item.product_id:
            await db.execute(
                Product.__table__.update()
                .where(Product.id == item.product_id)
                .values(current_stock=Product.current_stock + item.quantity)
            )
    
    # Update bill status
    bill.status = BillStatus.CANCELLED
    await db.commit()
    
    return {"message": "Bill cancelled and inventory restored"}


# ==================== ANALYTICS ====================

@router.get("/analytics/today")
async def get_today_analytics(
    current_user: User = Depends(require_min_role(UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    """Get today's sales analytics (Manager/Owner only)"""
    IST = timezone(timedelta(hours=5, minutes=30))
    today_start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    today_end = today_start + timedelta(days=1)
    
    # Today's bills
    result = await db.execute(
        select(Bill).where(
            and_(
                Bill.store_id == current_user.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= today_start,
                Bill.bill_date < today_end
            )
        )
    )
    bills = result.scalars().all()
    
    # Calculate metrics
    total_revenue = sum(b.total_amount for b in bills)
    total_bills = len(bills)
    avg_bill_value = total_revenue / total_bills if total_bills > 0 else 0
    
    # Payment breakdown
    payment_breakdown = {}
    for bill in bills:
        method = bill.payment_method.value
        payment_breakdown[method] = payment_breakdown.get(method, 0) + bill.total_amount
    
    # Compare with yesterday
    yesterday_start = today_start - timedelta(days=1)
    yesterday_result = await db.execute(
        select(func.sum(Bill.total_amount)).where(
            and_(
                Bill.store_id == current_user.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= yesterday_start,
                Bill.bill_date < today_start
            )
        )
    )
    yesterday_revenue = yesterday_result.scalar() or 0
    
    revenue_change = 0
    if yesterday_revenue > 0:
        revenue_change = ((total_revenue - yesterday_revenue) / yesterday_revenue) * 100
    
    return {
        "today": {
            "revenue": round(total_revenue, 2),
            "bills": total_bills,
            "avg_bill_value": round(avg_bill_value, 2)
        },
        "yesterday_revenue": round(yesterday_revenue, 2),
        "revenue_change_percent": round(revenue_change, 1),
        "payment_breakdown": payment_breakdown
    }


@router.get("/analytics/hourly")
async def get_hourly_sales(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get hourly sales breakdown for today"""
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    result = await db.execute(
        select(Bill).where(
            and_(
                Bill.store_id == current_user.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= today_start
            )
        )
    )
    bills = result.scalars().all()
    
    # Group by hour
    hourly_data = {}
    for bill in bills:
        hour = bill.bill_date.hour
        if hour not in hourly_data:
            hourly_data[hour] = {"bills": 0, "revenue": 0}
        hourly_data[hour]["bills"] += 1
        hourly_data[hour]["revenue"] += bill.total_amount
    
    # Format for chart
    chart_data = []
    for hour in range(24):
        data = hourly_data.get(hour, {"bills": 0, "revenue": 0})
        chart_data.append({
            "hour": f"{hour:02d}:00",
            "bills": data["bills"],
            "revenue": round(data["revenue"], 2)
        })
    
    return chart_data
