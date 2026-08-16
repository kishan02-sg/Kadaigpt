"""
KadaiGPT - Razorpay payment gateway integration (subscription checkout)

Activates when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set; otherwise
`is_configured` is False and the subscription checkout endpoint returns a
clear "payments not configured" error instead of failing obscurely.

Implemented directly against the Razorpay REST API via httpx (Basic Auth)
rather than the `razorpay` PyPI package, to keep backend/requirements.txt
minimal for Vercel's bundle size limit.

Docs:
  Orders API: https://razorpay.com/docs/api/orders/
  Payment verification: https://razorpay.com/docs/payments/server-integration/python/build-integration/#step-5-verify-the-payment-signature
  QR Codes API: https://razorpay.com/docs/api/qr-codes/
  QR webhook events: https://razorpay.com/docs/webhooks/qr-codes/
"""

import hmac
import hashlib
import logging

import httpx

from app.config import settings

logger = logging.getLogger("KadaiGPT.Razorpay")

ORDERS_ENDPOINT = "https://api.razorpay.com/v1/orders"
QR_CODES_ENDPOINT = "https://api.razorpay.com/v1/payments/qr_codes"


class RazorpayService:
    @property
    def is_configured(self) -> bool:
        return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

    async def create_qr_code(self, amount_inr: float, bill_number: str, notes: dict | None = None) -> dict:
        """Create a one-time, single-use dynamic UPI QR for a specific bill.

        Razorpay's QR Codes API is the product built for daily collection:
        the customer scans the QR with any UPI app, pays exactly the fixed
        amount, and Razorpay fires a `qr_code.credited` webhook the instant
        the money lands. Returns the QR entity (id, image_url, ...).

        Raises RuntimeError if Razorpay isn't configured or the API fails.
        """
        if not self.is_configured:
            raise RuntimeError("Razorpay is not configured")

        payload = {
            "type": "upi_qr",
            "name": f"KadaiGPT Bill {bill_number}",
            "usage": "single_use",
            "fixed_amount": True,
            "payment_amount": round(amount_inr * 100),  # paise
            "notes": notes or {"bill_number": bill_number},
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    QR_CODES_ENDPOINT,
                    json=payload,
                    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                )
            if resp.status_code // 100 != 2:
                logger.warning(f"[Razorpay] QR creation failed ({resp.status_code}): {resp.text[:300]}")
                raise RuntimeError("Failed to create Razorpay QR code")
            return resp.json()
        except httpx.HTTPError as e:
            logger.warning(f"[Razorpay] QR creation error: {type(e).__name__}: {e}")
            raise RuntimeError("Failed to reach Razorpay")

    async def close_qr_code(self, qr_code_id: str) -> dict:
        """Close/deactivate a QR so it can't be scanned (or paid) again.

        Used when a checkout QR expires or the cashier cancels/overrides the
        payment — a closed single_use QR rejects any further payment.

        Raises RuntimeError on API failure; callers should treat close as
        best-effort (log and continue) since the DB state is what counts.
        """
        if not self.is_configured:
            raise RuntimeError("Razorpay is not configured")
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.patch(
                    f"{QR_CODES_ENDPOINT}/{qr_code_id}/close",
                    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                )
            if resp.status_code // 100 != 2:
                logger.warning(f"[Razorpay] QR close failed ({resp.status_code}): {resp.text[:300]}")
                raise RuntimeError("Failed to close Razorpay QR code")
            return resp.json()
        except httpx.HTTPError as e:
            logger.warning(f"[Razorpay] QR close error: {type(e).__name__}: {e}")
            raise RuntimeError("Failed to reach Razorpay")

    async def create_order(self, amount_inr: float, receipt: str, notes: dict | None = None) -> dict:
        """Create a Razorpay order for `amount_inr` rupees. Returns the order dict.

        Raises RuntimeError if Razorpay isn't configured or the API call fails.
        """
        if not self.is_configured:
            raise RuntimeError("Razorpay is not configured")

        payload = {
            "amount": round(amount_inr * 100),  # paise
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
            "notes": notes or {},
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    ORDERS_ENDPOINT,
                    json=payload,
                    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                )
            if resp.status_code // 100 != 2:
                logger.warning(f"[Razorpay] order creation failed ({resp.status_code}): {resp.text[:300]}")
                raise RuntimeError("Failed to create Razorpay order")
            return resp.json()
        except httpx.HTTPError as e:
            logger.warning(f"[Razorpay] order creation error: {type(e).__name__}: {e}")
            raise RuntimeError("Failed to reach Razorpay")

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """Verify the HMAC-SHA256 signature Razorpay returns after checkout."""
        if not self.is_configured:
            return False
        body = f"{order_id}|{payment_id}".encode()
        expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


# Singleton
razorpay_service = RazorpayService()
