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
"""

import hmac
import hashlib
import logging

import httpx

from app.config import settings

logger = logging.getLogger("KadaiGPT.Razorpay")

ORDERS_ENDPOINT = "https://api.razorpay.com/v1/orders"


class RazorpayService:
    @property
    def is_configured(self) -> bool:
        return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

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
