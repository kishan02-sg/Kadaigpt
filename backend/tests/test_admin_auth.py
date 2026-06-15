"""
KadaiGPT - Platform Admin Login & RBAC Tests
Covers POST /api/v1/admin/login (admin-only credential check) and
GET /api/v1/admin/ping (require_role(ADMIN) smoke test), plus the
LoginHistory rows recorded for each attempt.

Run with: pytest tests/test_admin_auth.py -v
"""

import asyncio
import sys
import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import async_session_maker, engine
from app.constants.roles import UserRole
from app.models import LoginHistory, User
from app.routers.auth import get_password_hash


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_user():
    """Create a UserRole.ADMIN account (store_id=None) directly via the ORM."""
    ts = datetime.now().timestamp()
    email = f"admin_auth_{ts}@test.com"
    password = "AdminPass123!"

    async def _create():
        async with async_session_maker() as db:
            user = User(
                store_id=None,
                email=email,
                full_name="Test Platform Admin",
                password_hash=get_password_hash(password),
                role=UserRole.ADMIN,
            )
            db.add(user)
            await db.commit()

    asyncio.run(_create())
    asyncio.run(engine.dispose())
    return {"email": email, "password": password}


@pytest.fixture
def owner_credentials(client):
    """Register a fresh OWNER, return its email/password/token."""
    ts = datetime.now().timestamp()
    email = f"admin_auth_owner_{ts}@example.com"
    password = "SecurePass123!"
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Admin Auth Owner",
        "store_name": "Admin Auth Test Store",
    })
    assert response.status_code == 200, response.text
    return {"email": email, "password": password, "token": response.json()["access_token"]}


def _admin_login(client, email, password):
    return client.post("/api/v1/admin/login", data={"username": email, "password": password})


def _last_login_history(email):
    async def _query():
        async with async_session_maker() as db:
            result = await db.execute(
                select(LoginHistory)
                .where(LoginHistory.email_or_staff_id == email)
                .order_by(LoginHistory.id.desc())
            )
            return result.scalars().first()

    entry = asyncio.run(_query())
    asyncio.run(engine.dispose())
    return entry


class TestAdminLogin:
    def test_admin_login_success(self, client, admin_user):
        response = _admin_login(client, admin_user["email"], admin_user["password"])
        assert response.status_code == 200, response.text
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_admin_login_wrong_password(self, client, admin_user):
        response = _admin_login(client, admin_user["email"], "WrongPass123!")
        assert response.status_code == 401

    def test_admin_login_nonexistent_email(self, client):
        response = _admin_login(client, "nobody@test.com", "whatever123")
        assert response.status_code == 401

    def test_admin_login_rejects_owner_credentials(self, client, owner_credentials):
        response = _admin_login(client, owner_credentials["email"], owner_credentials["password"])
        assert response.status_code == 403


class TestAdminPingRBAC:
    def test_admin_ping_as_admin(self, client, admin_user):
        login = _admin_login(client, admin_user["email"], admin_user["password"])
        token = login.json()["access_token"]

        response = client.get("/api/v1/admin/ping", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "admin": admin_user["email"]}

    def test_admin_ping_as_owner_forbidden(self, client, owner_credentials):
        response = client.get(
            "/api/v1/admin/ping",
            headers={"Authorization": f"Bearer {owner_credentials['token']}"},
        )
        assert response.status_code == 403

    def test_admin_ping_unauthenticated(self, client):
        response = client.get("/api/v1/admin/ping")
        assert response.status_code == 401


class TestAdminLoginHistory:
    def test_successful_admin_login_recorded(self, client, admin_user):
        response = _admin_login(client, admin_user["email"], admin_user["password"])
        assert response.status_code == 200

        entry = _last_login_history(admin_user["email"])
        assert entry is not None
        assert entry.success is True
        assert entry.login_method == "admin"
        assert entry.failure_reason is None

    def test_failed_admin_login_recorded(self, client, admin_user):
        response = _admin_login(client, admin_user["email"], "WrongPass123!")
        assert response.status_code == 401

        entry = _last_login_history(admin_user["email"])
        assert entry is not None
        assert entry.success is False
        assert entry.login_method == "admin"
        assert entry.failure_reason == "bad_password"

    def test_non_admin_login_attempt_recorded(self, client, owner_credentials):
        response = _admin_login(client, owner_credentials["email"], owner_credentials["password"])
        assert response.status_code == 403

        entry = _last_login_history(owner_credentials["email"])
        assert entry is not None
        assert entry.success is False
        assert entry.login_method == "admin"
        assert entry.failure_reason == "not_admin"
