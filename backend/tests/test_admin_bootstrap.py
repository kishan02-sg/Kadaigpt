"""
KadaiGPT - Platform Admin Bootstrap Tests
Covers POST /api/v1/admin/bootstrap: secret gating (404/401), password
validation, admin creation (store_id=None, role=ADMIN), and the
single-admin idempotency guard (409).

Run with: pytest tests/test_admin_bootstrap.py -v
"""

import asyncio
import sys
import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.config import settings
from app.database import async_session_maker, engine
from app.models import User

BOOTSTRAP_SECRET = "test-bootstrap-secret-123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "AdminPass123!"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def bootstrap_secret(monkeypatch):
    """Configure ADMIN_BOOTSTRAP_SECRET for the duration of the test."""
    monkeypatch.setattr(settings, "admin_bootstrap_secret", BOOTSTRAP_SECRET)
    return BOOTSTRAP_SECRET


@pytest.fixture(autouse=True)
def _no_existing_admin():
    """Each test starts from a clean slate: no ADMIN account exists yet, so
    the 409 "already bootstrapped" guard reflects only this test's own
    actions (re-runnable across pytest sessions against a persistent
    local.db)."""
    async def _cleanup():
        async with async_session_maker() as db:
            await db.execute(text("DELETE FROM users WHERE role = 'ADMIN'"))
            await db.commit()

    asyncio.run(_cleanup())
    asyncio.run(engine.dispose())


def _bootstrap(client, secret=None, **payload_overrides):
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "full_name": "Platform Admin",
    }
    payload.update(payload_overrides)
    headers = {}
    if secret is not None:
        headers["X-Bootstrap-Secret"] = secret
    return client.post("/api/v1/admin/bootstrap", json=payload, headers=headers)


def _get_user(email):
    async def _query():
        async with async_session_maker() as db:
            result = await db.execute(select(User).where(User.email == email))
            return result.scalar_one_or_none()

    user = asyncio.run(_query())
    asyncio.run(engine.dispose())
    return user


class TestBootstrapSecretGating:
    def test_404_when_secret_not_configured(self, client, monkeypatch):
        monkeypatch.setattr(settings, "admin_bootstrap_secret", None)
        response = _bootstrap(client, secret="anything")
        assert response.status_code == 404

    def test_401_on_wrong_secret(self, client, bootstrap_secret):
        response = _bootstrap(client, secret="wrong-secret")
        assert response.status_code == 401

    def test_401_when_secret_header_missing(self, client, bootstrap_secret):
        response = _bootstrap(client, secret=None)
        assert response.status_code == 401


class TestBootstrapValidation:
    def test_weak_password_rejected(self, client, bootstrap_secret):
        # >= 8 chars (passes the Pydantic Field(min_length=8) check) but a
        # common password rejected by validate_password_strength -> 400.
        response = _bootstrap(client, secret=bootstrap_secret, password="password1")
        assert response.status_code == 400

    def test_duplicate_email_rejected(self, client, bootstrap_secret):
        ts = datetime.now().timestamp()
        email = f"existing_user_{ts}@test.com"
        register_resp = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "full_name": "Existing User",
            "store_name": "Existing Store",
        })
        assert register_resp.status_code == 200, register_resp.text

        response = _bootstrap(client, secret=bootstrap_secret, email=email)
        assert response.status_code == 400


class TestBootstrapCreatesAdmin:
    def test_success_creates_admin_with_null_store(self, client, bootstrap_secret):
        response = _bootstrap(client, secret=bootstrap_secret)
        assert response.status_code == 200, response.text
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

        admin = _get_user(ADMIN_EMAIL)
        assert admin is not None
        assert admin.role.value == "ADMIN"
        assert admin.store_id is None

        # The returned token works against an admin-only endpoint
        token = data["access_token"]
        ping = client.get("/api/v1/admin/ping", headers={"Authorization": f"Bearer {token}"})
        assert ping.status_code == 200
        assert ping.json()["admin"] == ADMIN_EMAIL

    def test_repeat_bootstrap_is_409(self, client, bootstrap_secret):
        first = _bootstrap(client, secret=bootstrap_secret)
        assert first.status_code == 200, first.text

        second = _bootstrap(client, secret=bootstrap_secret, email="second-admin@test.com")
        assert second.status_code == 409
