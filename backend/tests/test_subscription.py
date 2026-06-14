"""
KadaiGPT - Unit Tests for Subscription & Billing API (incl. Razorpay checkout)
Run with: pytest tests/test_subscription.py -v
"""

import hashlib
import hmac
import sys
import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.config import settings
from app.services.razorpay_service import razorpay_service


TEST_KEY_ID = "rzp_test_dummy_key"
TEST_KEY_SECRET = "test_dummy_secret"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Register a brand-new store/user so each test starts on the FREE tier."""
    register_data = {
        "email": f"test_sub_{datetime.now().timestamp()}@test.com",
        "password": "testpass123",
        "full_name": "Test Owner",
        "store_name": "Test Subscription Store",
    }
    response = client.post("/api/v1/auth/register", json=register_data)
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def razorpay_configured(monkeypatch):
    """Pretend Razorpay is configured with test credentials, and stub order
    creation so checkout tests don't make real calls to the Razorpay API."""
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", TEST_KEY_ID)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", TEST_KEY_SECRET)

    async def fake_create_order(amount_inr, receipt, notes=None):
        return {
            "id": f"order_{receipt}",
            "amount": round(amount_inr * 100),
            "currency": "INR",
            "receipt": receipt,
            "status": "created",
            "notes": notes or {},
        }

    monkeypatch.setattr(razorpay_service, "create_order", fake_create_order)
    return settings


def _sign(order_id, payment_id, secret=TEST_KEY_SECRET):
    body = f"{order_id}|{payment_id}".encode()
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _checkout_and_verify(client, headers, tier, billing_cycle="monthly", payment_id="pay_test"):
    """Helper: run a full checkout -> verify-payment cycle and return the verify response."""
    checkout = client.post(
        "/api/v1/subscription/checkout",
        headers=headers,
        json={"tier": tier, "billing_cycle": billing_cycle},
    )
    assert checkout.status_code == 200, checkout.text
    order = checkout.json()
    signature = _sign(order["order_id"], payment_id)
    return client.post(
        "/api/v1/subscription/verify-payment",
        headers=headers,
        json={
            "razorpay_order_id": order["order_id"],
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
            "tier": tier,
            "billing_cycle": billing_cycle,
        },
    ), order


class TestSubscriptionTiers:
    """GET /subscription/tiers (public)"""

    def test_get_tiers_public(self, client):
        response = client.get("/api/v1/subscription/tiers")
        assert response.status_code == 200
        data = response.json()
        assert "tiers" in data

        tiers = {t["tier"]: t for t in data["tiers"]}
        assert set(tiers) == {"free", "smart", "pro", "enterprise"}
        assert tiers["free"]["price_monthly"] == 0
        assert tiers["smart"]["price_monthly"] == 299
        assert tiers["pro"]["price_monthly"] == 799
        assert tiers["enterprise"]["price_monthly"] == -1

    def test_tiers_have_expected_shape(self, client):
        response = client.get("/api/v1/subscription/tiers")
        for tier in response.json()["tiers"]:
            assert isinstance(tier["features"], list)
            assert "max_bills_per_month" in tier
            assert "max_stores" in tier
            assert "name" in tier


class TestPaymentConfig:
    """GET /subscription/payment-config (public)"""

    def test_payment_config_not_configured(self, client):
        # No RAZORPAY_KEY_ID/SECRET in this test environment
        response = client.get("/api/v1/subscription/payment-config")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["key_id"] is None

    def test_payment_config_configured(self, client, razorpay_configured):
        response = client.get("/api/v1/subscription/payment-config")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is True
        assert data["key_id"] == TEST_KEY_ID


class TestSubscriptionDetails:
    """GET /subscription/details (auth required)"""

    def test_details_requires_auth(self, client):
        response = client.get("/api/v1/subscription/details")
        assert response.status_code == 401

    def test_new_store_defaults_to_free(self, client, auth_headers):
        response = client.get("/api/v1/subscription/details", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["subscription"]["tier"] == "free"
        assert data["subscription"]["status"] == "active"
        assert data["subscription"]["is_trial"] is False
        assert "usage" in data
        assert len(data["available_tiers"]) == 4


class TestUsageAndFeatureChecks:
    """GET /subscription/usage and /subscription/check-feature/{key}"""

    def test_get_usage(self, client, auth_headers):
        response = client.get("/api/v1/subscription/usage", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "bills_created" in data
        assert "bills_limit" in data
        assert data["bills_limit"] == 100  # FREE tier limit

    def test_feature_not_included_on_free_suggests_upgrade(self, client, auth_headers):
        response = client.get("/api/v1/subscription/check-feature/whatsapp_integration", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["allowed"] is False
        assert data["current_tier"] == "free"
        assert data["tier_required"] == "smart"
        assert "upgrade_message" in data

    def test_feature_included_on_free(self, client, auth_headers):
        response = client.get("/api/v1/subscription/check-feature/basic_billing", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["allowed"] is True


class TestCheckoutValidation:
    """POST /subscription/checkout — validation and graceful-fallback behavior"""

    def test_checkout_requires_auth(self, client):
        response = client.post(
            "/api/v1/subscription/checkout",
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        assert response.status_code == 401

    def test_checkout_not_configured_returns_503(self, client, auth_headers):
        response = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"].lower()

    def test_checkout_invalid_tier(self, client, auth_headers, razorpay_configured):
        response = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "ultra", "billing_cycle": "monthly"},
        )
        assert response.status_code == 400
        assert "Invalid tier" in response.json()["detail"]

    def test_checkout_free_tier_rejected(self, client, auth_headers, razorpay_configured):
        response = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "free", "billing_cycle": "monthly"},
        )
        assert response.status_code == 400
        assert "doesn't require checkout" in response.json()["detail"]

    def test_checkout_enterprise_custom_pricing_rejected(self, client, auth_headers, razorpay_configured):
        response = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "enterprise", "billing_cycle": "monthly"},
        )
        assert response.status_code == 400
        assert "custom pricing" in response.json()["detail"]

    def test_checkout_invalid_billing_cycle(self, client, auth_headers, razorpay_configured):
        response = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "weekly"},
        )
        assert response.status_code == 400
        assert "billing_cycle" in response.json()["detail"]


class TestCheckoutAndVerifyFlow:
    """Full checkout -> Razorpay Checkout.js -> verify-payment flow (Razorpay mocked)"""

    def test_checkout_order_shape(self, client, auth_headers, razorpay_configured):
        response = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        assert response.status_code == 200
        order = response.json()
        assert order["tier"] == "smart"
        assert order["tier_name"] == "Smart"
        assert order["amount"] == 29900  # paise
        assert order["currency"] == "INR"
        assert order["key_id"] == TEST_KEY_ID
        assert order["order_id"]

    def test_full_upgrade_flow(self, client, auth_headers, razorpay_configured):
        verify, _ = _checkout_and_verify(client, auth_headers, "smart")
        assert verify.status_code == 200
        data = verify.json()
        assert "Upgraded to Smart" in data["message"]
        assert data["subscription"]["tier"] == "smart"
        assert data["subscription"]["status"] == "active"

        details = client.get("/api/v1/subscription/details", headers=auth_headers)
        assert details.json()["subscription"]["tier"] == "smart"

    def test_verify_payment_idempotent(self, client, auth_headers, razorpay_configured):
        first, order = _checkout_and_verify(client, auth_headers, "smart", payment_id="pay_idem")
        assert first.status_code == 200

        # Re-submitting the same (order_id, payment_id, signature) should not error
        signature = _sign(order["order_id"], "pay_idem")
        second = client.post(
            "/api/v1/subscription/verify-payment",
            headers=auth_headers,
            json={
                "razorpay_order_id": order["order_id"],
                "razorpay_payment_id": "pay_idem",
                "razorpay_signature": signature,
                "tier": "smart",
                "billing_cycle": "monthly",
            },
        )
        assert second.status_code == 200
        assert "already processed" in second.json()["message"].lower()

    def test_verify_payment_bad_signature(self, client, auth_headers, razorpay_configured):
        checkout = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        order = checkout.json()
        verify = client.post(
            "/api/v1/subscription/verify-payment",
            headers=auth_headers,
            json={
                "razorpay_order_id": order["order_id"],
                "razorpay_payment_id": "pay_bad_sig",
                "razorpay_signature": "not-a-real-signature",
                "tier": "smart",
                "billing_cycle": "monthly",
            },
        )
        assert verify.status_code == 400
        assert "verification failed" in verify.json()["detail"].lower()

    def test_verify_payment_unknown_order(self, client, auth_headers, razorpay_configured):
        signature = _sign("order_does_not_exist", "pay_unknown")
        verify = client.post(
            "/api/v1/subscription/verify-payment",
            headers=auth_headers,
            json={
                "razorpay_order_id": "order_does_not_exist",
                "razorpay_payment_id": "pay_unknown",
                "razorpay_signature": signature,
                "tier": "smart",
                "billing_cycle": "monthly",
            },
        )
        assert verify.status_code == 404

    def test_double_checkout_creates_distinct_orders(self, client, auth_headers, razorpay_configured):
        """Two checkout calls in quick succession must each get a unique order/invoice."""
        first = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        second = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert first.json()["order_id"] != second.json()["order_id"]

    def test_downgrade_checkout_rejected(self, client, auth_headers, razorpay_configured):
        # Upgrade to PRO first
        verify, _ = _checkout_and_verify(client, auth_headers, "pro", payment_id="pay_pro")
        assert verify.status_code == 200

        # Buying SMART (a lower tier) afterwards should be rejected as a downgrade
        downgrade = client.post(
            "/api/v1/subscription/checkout",
            headers=auth_headers,
            json={"tier": "smart", "billing_cycle": "monthly"},
        )
        assert downgrade.status_code == 400
        assert "downgrade" in downgrade.json()["detail"].lower()


class TestCancelSubscription:
    """POST /subscription/cancel"""

    def test_cancel_without_subscription(self, client, auth_headers):
        response = client.post("/api/v1/subscription/cancel", headers=auth_headers, json={})
        assert response.status_code == 400

    def test_cancel_after_upgrade(self, client, auth_headers, razorpay_configured):
        verify, _ = _checkout_and_verify(client, auth_headers, "smart", payment_id="pay_cancel")
        assert verify.status_code == 200

        cancel = client.post(
            "/api/v1/subscription/cancel",
            headers=auth_headers,
            json={"reason": "too expensive"},
        )
        assert cancel.status_code == 200
        assert "cancel" in cancel.json()["message"].lower()

        details = client.get("/api/v1/subscription/details", headers=auth_headers)
        assert details.json()["subscription"]["status"] == "cancelled"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
