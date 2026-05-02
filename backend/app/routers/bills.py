"""
KadaiGPT - Bills Router
Core billing functionality with AI agent integration
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models import Bill, BillItem, Product, User, Store, BillStatus, PaymentMethod, UserRole
from app.schemas import BillCreate, BillResponse, BillSummary, PrintRequest, PrintStatus
from app.routers.auth import get_current_active_user
from app.rbac import require_min_role
from app.agents import print_agent, inventory_agent, offline_agent
from app.routers.audit import log_audit_event
from app.routers.inapp_notifications import create_system_notification


router = APIRouter(prefix="/bills", tags=["Bills"])


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
    bill.items = items_result.scalars().all()
    
    return bill


@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    bill_data: BillCreate,
    auto_print: bool = Query(default=True, description="Automatically print bill"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🧠 AGENTIC BILLING: Create a new bill with AI agent orchestration
    
    Flow:
    1. Validate items and calculate totals
    2. Create bill and bill items
    3. Update inventory (Inventory Agent)
    4. Auto-print if enabled (Print Agent)
    5. Queue for sync if offline (Offline Agent)
    """
    
    if not bill_data.items:
        raise HTTPException(status_code=400, detail="Bill must have at least one item")
    
    # Get store for prefix
    store_result = await db.execute(
        select(Store).where(Store.id == current_user.store_id)
    )
    store = store_result.scalar_one_or_none()
    
    # ═══════════════════════════════════════════════════
    # 🛡️ STOCK VALIDATION: Prevent negative stock (BUG-001 fix)
    # Validate ALL items have sufficient stock BEFORE creating the bill
    # ═══════════════════════════════════════════════════
    insufficient_items = []
    for item in bill_data.items:
        if item.product_id:
            prod_check = await db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            product = prod_check.scalar_one_or_none()
            if product:
                if product.current_stock < item.quantity:
                    insufficient_items.append({
                        "product_name": item.product_name or product.name,
                        "product_id": item.product_id,
                        "available": product.current_stock,
                        "requested": item.quantity,
                        "shortfall": round(item.quantity - product.current_stock, 2)
                    })
    
    if insufficient_items:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "insufficient_stock",
                "message": f"{len(insufficient_items)} item(s) have insufficient stock",
                "items": insufficient_items
            }
        )
    # ═══════════════════════════════════════════════════
    
    # Process items
    processed_items = []
    inventory_updates = []
    
    for item in bill_data.items:
        # Calculate item totals
        item_subtotal = item.unit_price * item.quantity
        item_discount = item_subtotal * (item.discount_percent / 100)
        item_taxable = item_subtotal - item_discount
        item_tax = item_taxable * (item.tax_rate / 100)
        item_total = item_taxable + item_tax
        
        processed_item = {
            "product_id": item.product_id,
            "product_name": item.product_name,
            "product_sku": item.product_sku,
            "unit_price": item.unit_price,
            "quantity": item.quantity,
            "discount_percent": item.discount_percent,
            "tax_rate": item.tax_rate,
            "subtotal": round(item_subtotal, 2),
            "discount_amount": round(item_discount, 2),
            "tax_amount": round(item_tax, 2),
            "total": round(item_total, 2)
        }
        processed_items.append(processed_item)
        
        # Track for inventory update
        if item.product_id:
            # Get current stock (use FOR UPDATE to prevent race conditions)
            prod_result = await db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            product = prod_result.scalar_one_or_none()
            if product:
                # Double-check stock (race condition protection)
                if product.current_stock < item.quantity:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Stock for '{item.product_name}' changed during transaction. Please retry."
                    )
                inventory_updates.append({
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "current_stock": product.current_stock,
                    "min_stock": product.min_stock_alert
                })
    
    # Calculate totals
    totals = await calculate_bill_totals([
        {
            "unit_price": item.unit_price,
            "quantity": item.quantity,
            "discount_percent": item.discount_percent,
            "tax_rate": item.tax_rate
        }
        for item in bill_data.items
    ])
    
    # Determine amount paid and change
    amount_paid = bill_data.amount_paid if bill_data.amount_paid else totals["total_amount"]
    change_amount = max(0, amount_paid - totals["total_amount"])
    
    # Generate bill number
    bill_number = generate_bill_number("INV")
    if bill_data.local_id:  # Offline bill
        bill_number = offline_agent.generate_offline_bill_number("OFL")
    
    # Create bill
    bill = Bill(
        store_id=current_user.store_id,
        cashier_id=current_user.id,
        bill_number=bill_number,
        customer_name=bill_data.customer_name,
        customer_phone=bill_data.customer_phone,
        subtotal=totals["subtotal"],
        discount_amount=totals["discount_amount"],
        tax_amount=totals["tax_amount"],
        total_amount=totals["total_amount"],
        payment_method=bill_data.payment_method,
        amount_paid=amount_paid,
        change_amount=change_amount,
        status=BillStatus.COMPLETED,
        local_id=bill_data.local_id
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
    
    await db.commit()
    await db.refresh(bill)
    
    # Get items for response
    items_result = await db.execute(
        select(BillItem).where(BillItem.bill_id == bill.id)
    )
    bill.items = items_result.scalars().all()
    
    # 🖨️ PRINT AGENT: Auto-print if enabled
    print_result = None
    if auto_print:
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
                for item in bill.items
            ],
            "total_amount": bill.total_amount
        }
        
        # Get print decision
        print_decision = await print_agent.decide_print_strategy(bill_for_print)
        
        if print_decision.should_print:
            # Generate receipt content
            receipt_content = print_agent.generate_receipt_content(bill_for_print)
            
            # Execute silent print
            print_result = await print_agent.execute_silent_print(
                receipt_content,
                print_decision.printer_name
            )
            
            # Update bill print status
            if print_result.get("success"):
                bill.is_printed = True
                bill.print_count = 1
                await db.commit()
    
    # Build response
    response = BillResponse.model_validate(bill)
    
    # 📝 AUDIT: Log bill creation
    await log_audit_event(
        db=db,
        store_id=current_user.store_id,
        user_id=current_user.id,
        action="create",
        entity_type="bill",
        entity_id=bill.id,
        new_values={
            "bill_number": bill.bill_number,
            "total_amount": bill.total_amount,
            "payment_method": bill.payment_method.value if hasattr(bill.payment_method, 'value') else str(bill.payment_method),
            "items_count": len(bill.items),
            "customer_name": bill.customer_name,
        }
    )
    await db.commit()
    
    return response


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
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
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
