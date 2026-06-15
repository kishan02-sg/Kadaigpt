"""
KadaiGPT - Platform Admin Stores Tests
Covers GET /api/v1/admin/stores (list/search/filters), GET /stores/{id}
(detail incl. users + counts + subscription), GET /stores/{id}/users, and
the suspend/activate lifecycle (status state machine + AuditTrail), including
the suspension chokepoint on the affected store's /auth/login and /auth/me.

Run with: pytest tests/test_admin_stores.py -v
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
from app.models import AuditTrail, Store, User
from app.routers.auth import get_password_hash


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_headers(client):
    """Create a UserRole.ADMIN account directly via the ORM, log in, return auth headers."""
    ts = datetime.now().timestamp()
    email = f"admin_stores_{ts}@test.com"
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

    response = client.post("/api/v1/admin/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def owner_store(client):
    """Register a fresh OWNER (+ store), return email/password/token/store_id."""
    ts = datetime.now().timestamp()
    email = f"admin_stores_owner_{ts}@example.com"
    password = "SecurePass123!"
    store_name = f"Admin Stores Test Store {ts}"
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Admin Stores Owner",
        "store_name": store_name,
    })
    assert response.status_code == 200, response.text
    data = response.json()
    token = data["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text

    return {
        "email": email,
        "password": password,
        "token": token,
        "store_id": me.json()["store_id"],
        "store_name": store_name,
    }


def _get_store(store_id):
    async def _query():
        async with async_session_maker() as db:
            result = await db.execute(select(Store).where(Store.id == store_id))
            return result.scalar_one_or_none()

    store = asyncio.run(_query())
    asyncio.run(engine.dispose())
    return store


def _last_audit(store_id, action):
    async def _query():
        async with async_session_maker() as db:
            result = await db.execute(
                select(AuditTrail)
                .where(AuditTrail.store_id == store_id, AuditTrail.action == action)
                .order_by(AuditTrail.id.desc())
            )
            return result.scalars().first()

    entry = asyncio.run(_query())
    asyncio.run(engine.dispose())
    return entry


class TestListStoresRBAC:
    def test_unauthenticated(self, client):
        response = client.get("/api/v1/admin/stores")
        assert response.status_code == 401

    def test_non_admin_forbidden(self, client, owner_store):
        response = client.get(
            "/api/v1/admin/stores",
            headers={"Authorization": f"Bearer {owner_store['token']}"},
        )
        assert response.status_code == 403


class TestListStores:
    def test_search_by_name_finds_store(self, client, admin_headers, owner_store):
        response = client.get(
            "/api/v1/admin/stores",
            params={"search": owner_store["store_name"]},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        ids = [s["id"] for s in data["stores"]]
        assert owner_store["store_id"] in ids

        entry = next(s for s in data["stores"] if s["id"] == owner_store["store_id"])
        assert entry["owner"]["email"] == owner_store["email"]
        assert entry["user_count"] >= 1
        assert entry["status"] == "active"
        assert entry["subscription"]["tier"] == "free"

    def test_search_no_match_returns_empty(self, client, admin_headers):
        response = client.get(
            "/api/v1/admin/stores",
            params={"search": "no-such-store-xyz-99999"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["stores"] == []

    def test_status_filter(self, client, admin_headers, owner_store):
        response = client.get(
            "/api/v1/admin/stores",
            params={"search": owner_store["store_name"], "status": "active"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        ids = [s["id"] for s in response.json()["stores"]]
        assert owner_store["store_id"] in ids

        response = client.get(
            "/api/v1/admin/stores",
            params={"search": owner_store["store_name"], "status": "suspended"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["stores"] == []


class TestStoreDetail:
    def test_detail_includes_owner_users_and_counts(self, client, admin_headers, owner_store):
        response = client.get(f"/api/v1/admin/stores/{owner_store['store_id']}", headers=admin_headers)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"] == owner_store["store_id"]

        emails = [u["email"] for u in data["users"]]
        assert owner_store["email"] in emails

        owner_entry = next(u for u in data["users"] if u["email"] == owner_store["email"])
        assert owner_entry["role"] == "OWNER"

        assert data["counts"]["products"] == 0
        assert data["counts"]["bills"] == 0
        assert data["counts"]["users"] >= 1
        assert data["subscription"]["tier"] == "free"

    def test_detail_404_for_unknown_store(self, client, admin_headers):
        response = client.get("/api/v1/admin/stores/999999999", headers=admin_headers)
        assert response.status_code == 404

    def test_store_users_endpoint(self, client, admin_headers, owner_store):
        response = client.get(f"/api/v1/admin/stores/{owner_store['store_id']}/users", headers=admin_headers)
        assert response.status_code == 200, response.text
        emails = [u["email"] for u in response.json()]
        assert owner_store["email"] in emails

    def test_store_users_404_for_unknown_store(self, client, admin_headers):
        response = client.get("/api/v1/admin/stores/999999999/users", headers=admin_headers)
        assert response.status_code == 404


class TestSuspendActivate:
    def test_suspend_sets_status_and_audit(self, client, admin_headers, owner_store):
        store_id = owner_store["store_id"]
        response = client.post(f"/api/v1/admin/stores/{store_id}/suspend", headers=admin_headers)
        assert response.status_code == 200, response.text
        assert response.json() == {"id": store_id, "status": "suspended"}

        assert _get_store(store_id).status == "suspended"

        audit = _last_audit(store_id, "admin_store_suspended")
        assert audit is not None
        assert audit.old_values == {"status": "active"}
        assert audit.new_values == {"status": "suspended"}

    def test_suspended_store_owner_login_forbidden(self, client, admin_headers, owner_store):
        store_id = owner_store["store_id"]
        suspend = client.post(f"/api/v1/admin/stores/{store_id}/suspend", headers=admin_headers)
        assert suspend.status_code == 200

        login = client.post("/api/v1/auth/login", data={
            "username": owner_store["email"], "password": owner_store["password"],
        })
        assert login.status_code == 403

    def test_suspended_store_existing_token_forbidden_on_me(self, client, admin_headers, owner_store):
        store_id = owner_store["store_id"]
        suspend = client.post(f"/api/v1/admin/stores/{store_id}/suspend", headers=admin_headers)
        assert suspend.status_code == 200

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner_store['token']}"})
        assert me.status_code == 403

    def test_idempotent_resuspend(self, client, admin_headers, owner_store):
        store_id = owner_store["store_id"]
        first = client.post(f"/api/v1/admin/stores/{store_id}/suspend", headers=admin_headers)
        assert first.status_code == 200

        second = client.post(f"/api/v1/admin/stores/{store_id}/suspend", headers=admin_headers)
        assert second.status_code == 200
        assert second.json()["status"] == "suspended"
        assert _get_store(store_id).status == "suspended"

    def test_activate_reverses_suspension(self, client, admin_headers, owner_store):
        store_id = owner_store["store_id"]
        suspend = client.post(f"/api/v1/admin/stores/{store_id}/suspend", headers=admin_headers)
        assert suspend.status_code == 200

        response = client.post(f"/api/v1/admin/stores/{store_id}/activate", headers=admin_headers)
        assert response.status_code == 200, response.text
        assert response.json() == {"id": store_id, "status": "active"}
        assert _get_store(store_id).status == "active"

        audit = _last_audit(store_id, "admin_store_active")
        assert audit is not None
        assert audit.old_values == {"status": "suspended"}
        assert audit.new_values == {"status": "active"}

        login = client.post("/api/v1/auth/login", data={
            "username": owner_store["email"], "password": owner_store["password"],
        })
        assert login.status_code == 200

    def test_suspend_404_for_unknown_store(self, client, admin_headers):
        response = client.post("/api/v1/admin/stores/999999999/suspend", headers=admin_headers)
        assert response.status_code == 404

    def test_activate_404_for_unknown_store(self, client, admin_headers):
        response = client.post("/api/v1/admin/stores/999999999/activate", headers=admin_headers)
        assert response.status_code == 404

    def test_suspend_non_admin_forbidden(self, client, owner_store):
        response = client.post(
            f"/api/v1/admin/stores/{owner_store['store_id']}/suspend",
            headers={"Authorization": f"Bearer {owner_store['token']}"},
        )
        assert response.status_code == 403

    def test_suspend_unauthenticated(self, client, owner_store):
        response = client.post(f"/api/v1/admin/stores/{owner_store['store_id']}/suspend")
        assert response.status_code == 401
