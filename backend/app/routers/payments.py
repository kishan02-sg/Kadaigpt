"""
KadaiGPT - Payments Router (Razorpay checkout-QR UPI verification)

Turns "UPI" at checkout from a trust-me label into a verified payment:
the backend creates a real, single-use Razorpay QR for the exact bill
amount, and the `qr_code.credited` webhook is the ONLY thing that can flip
the bill from PENDING_PAYMENT to COMPLETED.

Endpoints:
  POST /api/v1/payments/webhook                  (no auth - Razorpay server)
  GET  /api/v1/bills/{id}/payment-status         (auth - checkout polling)
  POST /api/v1/bills/{id}/payment/close          (auth - timeout/cancel)
  POST /api/v1/bills/{id}/payment/override       (auth - cashier fallback)

Security notes (see judge gates):
  - The webhook is HMAC-SHA256 signed with RAZORPAY_WEBHOOK_SECRET, a
    genuinely separate secret from RAZORPAY_KEY_SECRET. Any request with a
    missing/wrong signature is rejected with 400 and does nothing.
  - A client can never claim a bill as paid. The only paths to COMPLETED
    are the webhook (verified) or the override endpoint, which CHANGES the
    payment method (e.g. to CASH) and records Payment.status='overridden' -
    it never fakes a Razorpay confirmation.
  - Razorpay retries webhooks; the unique constraint on payments.razorpay_
    payment_id plus an explicit existence check make processing idempotent.
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.routers.audit import log_audit_event
from app.routers.auth import get_current_active_user
from app.services.razorpay_service import razorpay_service

logger = logging.getLogger(__name__)

# No prefix here: the webhook lives at /payments/webhook while the
# checkout endpoints must sit under /bills/... (the frontend polls
# /bills/{id}/payment-status). main.py mounts everything under /api/v1.
router = APIRouter(tags=["Payments"])


# ==================== WEBHOOK (no auth - Razorpay servers only) ====================

@router.post("/payments/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Razorpay webhook events for checkout QR codes.

    Only `qr_code.credited` is acted on. The HMAC signature check is
    non-negotiable: a forged POST is rejected with 400 and does nothing.
    """
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        # Fail closed: without the secret we cannot authenticate Razorpay,
        # so we refuse to process anything.
        logger.warning("[Payments] webhook received but RAZORPAY_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=503, detail="Webhooks not configured")

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # HMAC-SHA256 of the RAW body with the webhook secret.
    expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        logger.warning("[Payments] webhook signature verification FAILED — rejecting")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event = payload.get("event")

    # Non-payment events (qr_code.created / qr_code.closed etc.) are no-ops.
    if event != "qr_code.credited":
        return {"status": "ok"}

    try:
        qr_code_id = payload["payload"]["qr_code"]["entity"]["id"]
        payment_id = payload["payload"]["payment"]["entity"]["id"]
        amount_paid_paise = payload["payload"]["payment"]["entity"].get("amount") or 0
    except (KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Malformed webhook payload")

    await _credit_payment(db, qr_code_id, payment_id, amount_paid_paise / 100)
    return {"status": "ok"}


async def _credit_payment(db: AsyncSession, qr_code_id: str, payment_id: str, amount_paid: float) -> None:
    """Mark a QR payment as paid and complete its bill — idempotently.

    A replayed/retried webhook for an already-processed payment returns
    without touching anything (checked by razorpay_payment_id); a concurrent
    retry racing the first one hits the unique constraint and is treated as
    already-processed too.
    """
    # Idempotency check 1: this exact payment already recorded?
    existing = await db.execute(
        text("SELECT id FROM payments WHERE razorpay_payment_id = :pid"),
        {"pid": payment_id},
    )
    if existing.mappings().first():
        logger.info(f"[Payments] payment {payment_id} already processed — skipping (idempotent)")
        return

    # Find the Payment row this QR belongs to.
    pay_row = await db.execute(
        text("SELECT id, bill_id, amount, status, razorpay_payment_id FROM payments "
             "WHERE razorpay_qr_code_id = :qid"),
        {"qid": qr_code_id},
    )
    pay = pay_row.mappings().first()
    if pay is None:
        logger.warning(f"[Payments] no payment row for QR {qr_code_id} — ignoring (unknown QR)")
        return
    if pay["razorpay_payment_id"]:
        # Already credited (a single_use QR should only ever yield one payment;
        # never overwrite the first recorded payment_id).
        logger.info(f"[Payments] QR {qr_code_id} already credited via {pay['razorpay_payment_id']} — skipping")
        return

    bill_row = await db.execute(
        text("SELECT id, status FROM bills WHERE id = :bid"),
        {"bid": pay["bill_id"]},
    )
    bill = bill_row.mappings().first()

    now = datetime.utcnow()
    try:
        # Record the payment as paid regardless of bill state (audit trail is
        # honest: the money DID arrive). Only flip a PENDING_PAYMENT bill.
        await db.execute(
            text("UPDATE payments SET status = 'paid', razorpay_payment_id = :pid, "
                 "paid_at = :now WHERE id = :id"),
            {"pid": payment_id, "now": now, "id": pay["id"]},
        )
        if bill and bill["status"] == "PENDING_PAYMENT":
            await db.execute(
                text("UPDATE bills SET status = 'COMPLETED' WHERE id = :bid"),
                {"bid": bill["id"]},
            )
            logger.info(f"[Payments] bill {bill['id']} confirmed paid via webhook (₹{amount_paid})")
        elif bill:
            logger.warning(
                f"[Payments] payment {payment_id} arrived for bill {bill['id']} "
                f"in status {bill['status']} — recorded but bill not flipped"
            )
        await db.commit()
    except IntegrityError:
        # Idempotency check 2: a concurrent retry won the race and inserted
        # the same razorpay_payment_id between our check and this commit.
        await db.rollback()
        logger.info(f"[Payments] payment {payment_id} raced with a retry — treated as processed")
        return


# ==================== CHECKOUT-SIDE ENDPOINTS (auth required) ====================

async def _get_store_bill(db: AsyncSession, bill_id: int, store_id: int) -> dict | None:
    """Store-scoped bill lookup via raw SQL (no ORM lazy-loading)."""
    result = await db.execute(
        text("SELECT id, bill_number, status, payment_method, total_amount FROM bills "
             "WHERE id = :id AND store_id = :store_id"),
        {"id": bill_id, "store_id": store_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


def _payment_info(pay: dict) -> dict:
    return {
        "id": pay["id"],
        "status": pay["status"],
        "amount": pay["amount"],
        "qr_image_url": pay["qr_image_url"],
        "razorpay_qr_code_id": pay["razorpay_qr_code_id"],
        "expires_at": pay["expires_at"],
        "paid_at": pay["paid_at"],
        "razorpay_payment_id": pay["razorpay_payment_id"],
    }


@router.get("/bills/{bill_id}/payment-status")
async def get_payment_status(
    bill_id: int,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll endpoint for the checkout screen: is the UPI payment confirmed yet?"""
    bill = await _get_store_bill(db, bill_id, current_user.store_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")

    pay_row = await db.execute(
        text("SELECT id, status, amount, qr_image_url, razorpay_qr_code_id, expires_at, "
             "paid_at, razorpay_payment_id FROM payments WHERE bill_id = :bid ORDER BY id DESC LIMIT 1"),
        {"bid": bill_id},
    )
    pay = pay_row.mappings().first()

    return {
        "bill_id": bill["id"],
        "bill_number": bill["bill_number"],
        "bill_status": bill["status"],
        "payment": _payment_info(dict(pay)) if pay else None,
    }


async def _restock_bill_items(db: AsyncSession, bill_id: int, store_id: int) -> None:
    """Return sold stock to inventory (used when a checkout is cancelled)."""
    items = await db.execute(
        text("SELECT product_id, quantity FROM bill_items "
             "WHERE bill_id = :bid AND product_id IS NOT NULL"),
        {"bid": bill_id},
    )
    for item in items.mappings().all():
        await db.execute(
            text("UPDATE products SET current_stock = current_stock + :qty "
                 "WHERE id = :pid AND store_id = :store_id"),
            {"qty": item["quantity"], "pid": item["product_id"], "store_id": store_id},
        )


async def _close_qr_best_effort(db: AsyncSession, bill_id: int) -> None:
    """Close the QR on Razorpay's side (best-effort — DB state is what counts)."""
    pay_row = await db.execute(
        text("SELECT razorpay_qr_code_id FROM payments "
             "WHERE bill_id = :bid AND status = 'pending' AND razorpay_qr_code_id IS NOT NULL "
             "ORDER BY id DESC LIMIT 1"),
        {"bid": bill_id},
    )
    pay = pay_row.mappings().first()
    if not pay or not pay["razorpay_qr_code_id"]:
        return
    try:
        await razorpay_service.close_qr_code(pay["razorpay_qr_code_id"])
        logger.info(f"[Payments] QR {pay['razorpay_qr_code_id']} closed on Razorpay")
    except Exception as e:
        logger.warning(f"[Payments] QR close failed (best-effort): {type(e).__name__}: {e}")


@router.post("/bills/{bill_id}/payment/close")
async def close_payment(
    bill_id: int,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Expire/cancel a checkout that was never paid.

    Idempotent: closing an already-cancelled/expired checkout is a no-op.
    Closes the Razorpay QR so it can't be paid late, marks the Payment
    'expired', restores the reserved stock, and cancels the bill.
    """
    bill = await _get_store_bill(db, bill_id, current_user.store_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill["status"] != "PENDING_PAYMENT":
        # Already resolved (paid / cancelled / completed) — nothing to do.
        return {"bill_id": bill_id, "bill_status": bill["status"], "closed": False}

    await _close_qr_best_effort(db, bill_id)
    await db.execute(
        text("UPDATE payments SET status = 'expired', note = 'cashier closed checkout' "
             "WHERE bill_id = :bid AND status = 'pending'"),
        {"bid": bill_id},
    )
    await _restock_bill_items(db, bill_id, current_user.store_id)
    await db.execute(
        text("UPDATE bills SET status = 'CANCELLED' WHERE id = :bid"),
        {"bid": bill_id},
    )
    await log_audit_event(
        db,
        store_id=current_user.store_id,
        user_id=current_user.id,
        action="cancel_pending_payment",
        entity_type="bill",
        entity_id=bill_id,
        new_values={"bill_number": bill["bill_number"], "reason": "payment_not_received"},
        ip_address="app",
    )
    await db.commit()
    return {"bill_id": bill_id, "bill_status": "CANCELLED", "closed": True}


class OverridePaymentRequest(BaseModel):
    """Cashier fallback: record the sale under a non-UPI method.

    This does NOT claim a Razorpay confirmation — the payment record is
    marked 'overridden' so reports can always tell verified payments apart
    from manual ones.
    """
    payment_method: str  # CASH | CARD | CREDIT
    note: str = ""


@router.post("/bills/{bill_id}/payment/override")
async def override_payment(
    bill_id: int,
    request: OverridePaymentRequest,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Convert a stuck UPI checkout to cash/card/credit at the cashier's call.

    Escape hatch for a QR nobody paid: closes the QR, marks the payment
    'overridden', and completes the bill under the chosen method. The audit
    trail (Payment.status != 'paid') keeps verified and manual sales apart.
    """
    method = (request.payment_method or "").upper()
    if method not in ("CASH", "CARD", "CREDIT"):
        raise HTTPException(status_code=400, detail="payment_method must be CASH, CARD or CREDIT")

    bill = await _get_store_bill(db, bill_id, current_user.store_id)
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill["status"] != "PENDING_PAYMENT":
        raise HTTPException(status_code=409, detail=f"Bill is already {bill['status']}")

    await _close_qr_best_effort(db, bill_id)
    await db.execute(
        text("UPDATE payments SET status = 'overridden', note = :note "
             "WHERE bill_id = :bid AND status = 'pending'"),
        {"bid": bill_id, "note": (request.note or f"recorded as {method} by cashier")[:255]},
    )
    await db.execute(
        text("UPDATE bills SET status = 'COMPLETED', payment_method = :method WHERE id = :bid"),
        {"bid": bill_id, "method": method},
    )
    await log_audit_event(
        db,
        store_id=current_user.store_id,
        user_id=current_user.id,
        action="payment_override",
        entity_type="bill",
        entity_id=bill_id,
        new_values={
            "bill_number": bill["bill_number"],
            "from": "UPI",
            "to": method,
            "note": request.note,
        },
        ip_address="app",
    )
    await db.commit()
    return {"bill_id": bill_id, "bill_status": "COMPLETED", "payment_method": method}
