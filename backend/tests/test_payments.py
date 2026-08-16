"""
KadaiGPT - Tests for the Razorpay checkout-QR UPI verification flow.

Covers:
  - Manual-trust UPI flow when Razorpay is NOT configured (bill COMPLETED, no QR)
  - QR checkout when configured (bill held PENDING_PAYMENT, payment row created)
  - Webhook: forged / unsigned / unconfigured-secret all fail closed
  - Webhook: genuine event flips bill to COMPLETED, idempotent on replay
  - payment-status polling endpoint
  - close (expire/cancel) restores stock and cancels the bill
  - override records the sale under cash and never fakes a Razorpay confirmation
  - graceful fallback when QR creation fails

Run with: pytest tests/test_payments.py -v
"""

import hashlib
import hmac
import json
import sys
import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.config import settings
from app.services.razorpay_service import razorpay_service

TEST_KEY_ID = "rzp_test_qr_key"
TEST_KEY_SECRET = "test_qr_secret"
TEST_WEBHOOK_SECRET = "test_webhook_secret_xyz"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Register a brand-new store/user per test (independent, low auth rate-limit load)."""
    register_data = {
        "email": f"test_pay_{datetime.now().timestamp()}@test.com",
        "password": "testpass123",
        "full_name": "Test Owner",
        "store_name": "Test Pay Store",
    }
    response = client.post("/api/v1/auth/register", json=register_data)
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def razorpay_configured(monkeypatch):
    """Pretend Razorpay is configured and stub QR calls so no real API is hit."""
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", TEST_KEY_ID)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", TEST_KEY_SECRET)
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)

    async def fake_create_qr_code(amount_inr, bill_number, notes=None):
        _QR_COUNTER["n"] += 1
        return {
            "id": f"qr_test_{_QR_COUNTER['n']}",
            "image_url": f"https://rzp.io/i/qr{_QR_COUNTER['n']}",
            "payment_amount": round(amount_inr * 100),
            "status": "active",
        }

    async def fake_close_qr_code(qr_code_id):
        return {"id": qr_code_id, "status": "closed"}

    monkeypatch.setattr(razorpay_service, "create_qr_code", fake_create_qr_code)
    monkeypatch.setattr(razorpay_service, "close_qr_code", fake_close_qr_code)
    return settings


@pytest.fixture
def webhook_secret_only(monkeypatch):
    """Webhook secret set, but key ID/secret NOT (webhook must still verify)."""
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", None)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", None)
    return settings


# Module-level counter so every bill in the session gets a unique fake QR id
# (qr_test_1, qr_test_2, ...), mirroring Razorpay's globally-unique ids. A
# per-test counter would collide: the webhook looks a QR up globally, so an
# earlier test's identical id would steal the webhook.
_QR_COUNTER = {"n": 0}


def _make_bill(client, headers, payment_method="UPI", product_name="QR Rice 5kg"):
    """Create a product + a bill; returns (response, product_id)."""
    prod = client.post(
        "/api/v1/products",
        headers=headers,
        json={"name": product_name, "selling_price": 45, "current_stock": 10, "tax_rate": 5},
    )
    assert prod.status_code in (200, 201), prod.text
    product_id = prod.json()["id"]

    resp = client.post(
        "/api/v1/bills",
        headers=headers,
        json={
            "payment_method": payment_method,
            "amount_paid": 4500,
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "unit_price": 45,
                    "quantity": 1,
                    "tax_rate": 5,
                }
            ],
        },
    )
    return resp, product_id


def _sign_webhook(body: bytes, secret=TEST_WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _credited_payload(qr_code_id: str, payment_id: str, amount_paise: int = 4500) -> dict:
    return {
        "entity": "event",
        "account_id": "acc_test",
        "event": "qr_code.credited",
        "contains": ["payment", "qr_code"],
        "payload": {
            "payment": {"entity": {"id": payment_id, "amount": amount_paise, "status": "captured", "method": "upi"}},
            "qr_code": {"entity": {"id": qr_code_id, "entity": "qr_code", "status": "active"}},
        },
        "created_at": 1623914419,
    }


def _qr_id(resp) -> str:
    """Pull the QR id out of a create-bill response (used to build webhooks)."""
    return resp.json()["payment"]["razorpay_qr_code_id"]


def _post_webhook(client, payload: dict, secret=TEST_WEBHOOK_SECRET, signature: str | None = None):
    body = json.dumps(payload).encode()
    sig = signature if signature is not None else _sign_webhook(body, secret)
    return client.post(
        "/api/v1/payments/webhook",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )


# ==================== MANUAL FLOW (Razorpay NOT configured) ====================

class TestManualUpiFallback:
    """Without Razorpay, UPI keeps the old manual-trust flow — bill completes
    immediately and the response carries no payment/QR payload."""

    def test_upi_bill_completes_immediately_without_razorpay(self, client, auth_headers):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["status"] == "COMPLETED"
        assert data.get("payment") is None

    def test_payment_status_has_no_payment_record(self, client, auth_headers):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]
        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["payment"] is None


# ==================== QR CHECKOUT (Razorpay configured) ====================

class TestQrCheckout:
    def test_upi_bill_gets_qr_and_stays_pending(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["status"] == "PENDING_PAYMENT"
        assert data["payment"] is not None
        assert data["payment"]["status"] == "pending"
        assert data["payment"]["amount"] == 47.25  # 45 + 5% GST
        assert data["payment"]["qr_image_url"].startswith("https://rzp.io/i/qr")
        assert data["payment"]["razorpay_qr_code_id"].startswith("qr_test_")

    def test_non_upi_bill_not_affected(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="CASH")
        assert resp.status_code == 201, resp.text
        assert resp.json()["status"] == "COMPLETED"
        assert resp.json().get("payment") is None

    def test_qr_creation_failure_falls_back_to_manual(self, client, auth_headers, razorpay_configured, monkeypatch):
        async def boom(amount_inr, bill_number, notes=None):
            raise RuntimeError("Razorpay unreachable")

        monkeypatch.setattr(razorpay_service, "create_qr_code", boom)
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        assert resp.status_code == 201, resp.text
        data = resp.json()
        # Graceful: bill still created and completed (manual trust flow), no QR.
        assert data["status"] == "COMPLETED"
        assert data.get("payment") is None


# ==================== WEBHOOK ====================

class TestWebhookSecurity:
    def test_no_signature_rejected(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]
        payload = _credited_payload(_qr_id(resp), "pay_forged")

        r = client.post(
            "/api/v1/payments/webhook",
            content=json.dumps(payload),
            headers={"Content-Type": "application/json"},  # no signature header
        )
        assert r.status_code == 400

        # Nothing changed.
        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.json()["bill_status"] == "PENDING_PAYMENT"
        assert status_resp.json()["payment"]["status"] == "pending"

    def test_wrong_signature_rejected(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]
        payload = _credited_payload(_qr_id(resp), "pay_forged")

        r = _post_webhook(client, payload, signature="deadbeef" * 8)
        assert r.status_code == 400

        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.json()["bill_status"] == "PENDING_PAYMENT"

    def test_webhook_without_secret_configured_fails_closed(self, client, auth_headers):
        # No RAZORPAY_WEBHOOK_SECRET at all -> 503, nothing processed.
        payload = _credited_payload("qr_x", "pay_x")
        r = _post_webhook(client, payload, secret="ignored")
        assert r.status_code == 503

    def test_webhook_secret_works_without_key_credentials(self, client, auth_headers, webhook_secret_only):
        # Verification only needs the webhook secret; unknown QR is a no-op 200.
        payload = _credited_payload("qr_unknown", "pay_unknown")
        r = _post_webhook(client, payload)
        assert r.status_code == 200


class TestWebhookCrediting:
    def test_genuine_webhook_completes_bill(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]

        r = _post_webhook(client, _credited_payload(_qr_id(resp), "pay_ok_1"))
        assert r.status_code == 200

        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        body = status_resp.json()
        assert body["bill_status"] == "COMPLETED"
        assert body["payment"]["status"] == "paid"
        assert body["payment"]["razorpay_payment_id"] == "pay_ok_1"
        assert body["payment"]["paid_at"] is not None

    def test_replayed_webhook_is_idempotent(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]

        payload = _credited_payload(_qr_id(resp), "pay_retry_1")
        first = _post_webhook(client, payload)
        assert first.status_code == 200
        second = _post_webhook(client, payload)  # Razorpay retry
        assert second.status_code == 200

        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.json()["bill_status"] == "COMPLETED"
        assert status_resp.json()["payment"]["status"] == "paid"
        assert status_resp.json()["payment"]["razorpay_payment_id"] == "pay_retry_1"

    def test_second_payment_on_same_qr_does_not_overwrite(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]

        assert _post_webhook(client, _credited_payload(_qr_id(resp), "pay_first")).status_code == 200
        # A different payment for the same QR must NOT clobber the first id.
        assert _post_webhook(client, _credited_payload(_qr_id(resp), "pay_second")).status_code == 200

        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.json()["payment"]["razorpay_payment_id"] == "pay_first"

    def test_unknown_qr_is_noop(self, client, auth_headers, razorpay_configured):
        r = _post_webhook(client, _credited_payload("qr_never_created", "pay_ghost"))
        assert r.status_code == 200  # don't make Razorpay retry forever


# ==================== POLLING / CLOSE / OVERRIDE ====================

class TestCheckoutLifecycle:
    def test_payment_status_requires_auth(self, client):
        assert client.get("/api/v1/bills/1/payment-status").status_code == 401

    def test_close_expires_qr_and_restores_stock(self, client, auth_headers, razorpay_configured):
        resp, product_id = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]

        # Stock was decremented at bill creation (10 -> 9).
        prod = client.get(f"/api/v1/products/{product_id}", headers=auth_headers).json()
        assert prod["current_stock"] == 9

        close = client.post(f"/api/v1/bills/{bill_id}/payment/close", headers=auth_headers)
        assert close.status_code == 200
        assert close.json()["closed"] is True

        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.json()["bill_status"] == "CANCELLED"
        assert status_resp.json()["payment"]["status"] == "expired"

        # Stock restored.
        prod = client.get(f"/api/v1/products/{product_id}", headers=auth_headers).json()
        assert prod["current_stock"] == 10

        # Idempotent: closing again is a no-op, no double restock.
        again = client.post(f"/api/v1/bills/{bill_id}/payment/close", headers=auth_headers)
        assert again.status_code == 200
        assert again.json()["closed"] is False
        prod = client.get(f"/api/v1/products/{product_id}", headers=auth_headers).json()
        assert prod["current_stock"] == 10

    def test_override_records_as_cash_and_never_claims_razorpay(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]

        ov = client.post(
            f"/api/v1/bills/{bill_id}/payment/override",
            headers=auth_headers,
            json={"payment_method": "CASH", "note": "customer paid by cash"},
        )
        assert ov.status_code == 200
        assert ov.json()["bill_status"] == "COMPLETED"
        assert ov.json()["payment_method"] == "CASH"

        status_resp = client.get(f"/api/v1/bills/{bill_id}/payment-status", headers=auth_headers)
        assert status_resp.json()["bill_status"] == "COMPLETED"
        # Crucially NOT 'paid' — the audit trail can tell verified from manual.
        assert status_resp.json()["payment"]["status"] == "overridden"
        assert status_resp.json()["payment"]["razorpay_payment_id"] is None

    def test_override_rejects_invalid_method(self, client, auth_headers, razorpay_configured):
        resp, _ = _make_bill(client, auth_headers, payment_method="UPI")
        bill_id = resp.json()["id"]
        r = client.post(
            f"/api/v1/bills/{bill_id}/payment/override",
            headers=auth_headers,
            json={"payment_method": "UPI"},  # can't "override" into the same method
        )
        assert r.status_code == 400
