"""
KadaiGPT - Platform Admin Users Tests
Covers GET /api/v1/admin/users (cross-store list/search/filters, never
serializes password_hash), GET /users/{id} (detail + recent LoginHistory),
and activate/deactivate (token revocation on deactivate, AuditTrail rows,
and the guard against deactivating the last active ADMIN).

Run with: pytest tests/test_admin_users.py -v
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
from app.database import async_session_maker, engine
from app.constants.roles import UserRole
from app.models import AuditTrail, User
from app.routers.auth import get_password_hash


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _only_one_admin():
    """Each test starts with no ADMIN accounts, so the `admin` fixture's
    account is the only one — making the "last active admin" guard
    order-independent across pytest sessions against a persistent local.db."""
    async def _cleanup():
        async with async_session_maker() as db:
            await db.execute(text("DELETE FROM users WHERE role = 'ADMIN'"))
            await db.commit()

    asyncio.run(_cleanup())
    asyncio.run(engine.dispose())


@pytest.fixture
def admin(client):
    """Create a UserRole.ADMIN account directly via the ORM, log in, return id/email/headers."""
    ts = datetime.now().timestamp()
    email = f"admin_users_{ts}@test.com"
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
            await db.refresh(user)
            return user.id

    user_id = asyncio.run(_create())
    asyncio.run(engine.dispose())

    response = client.post("/api/v1/admin/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text

    return {
        "id": user_id,
        "email": email,
        "headers": {"Authorization": f"Bearer {response.json()['access_token']}"},
    }


@pytest.fixture
def owner(client):
    """Register a fresh OWNER (+ store) and log in, returning id/email/password/token/store_id."""
    ts = datetime.now().timestamp()
    email = f"admin_users_owner_{ts}@example.com"
    password = "SecurePass123!"
    register = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Admin Users Owner",
        "store_name": f"Admin Users Test Store {ts}",
    })
    assert register.status_code == 200, register.text

    login = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text

    return {
        "id": me.json()["id"],
        "email": email,
        "password": password,
        "token": token,
        "store_id": me.json()["store_id"],
    }


def _last_audit(user_id, action):
    async def _query():
        async with async_session_maker() as db:
            result = await db.execute(
                select(AuditTrail)
                .where(
                    AuditTrail.entity_type == "user",
                    AuditTrail.entity_id == user_id,
                    AuditTrail.action == action,
                )
                .order_by(AuditTrail.id.desc())
            )
            return result.scalars().first()

    entry = asyncio.run(_query())
    asyncio.run(engine.dispose())
    return entry


class TestListUsersRBAC:
    def test_unauthenticated(self, client):
        response = client.get("/api/v1/admin/users")
        assert response.status_code == 401

    def test_non_admin_forbidden(self, client, owner):
        response = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {owner['token']}"})
        assert response.status_code == 403


class TestListUsers:
    def test_search_finds_user_no_password_hash(self, client, admin, owner):
        response = client.get(
            "/api/v1/admin/users",
            params={"search": owner["email"]},
            headers=admin["headers"],
        )
        assert response.status_code == 200, response.text
        data = response.json()
        ids = [u["id"] for u in data["users"]]
        assert owner["id"] in ids

        for u in data["users"]:
            assert "password_hash" not in u

        entry = next(u for u in data["users"] if u["id"] == owner["id"])
        assert entry["role"] == "OWNER"
        assert entry["store_id"] == owner["store_id"]
        assert entry["store_name"] is not None

    def test_role_filter(self, client, admin, owner):
        response = client.get(
            "/api/v1/admin/users",
            params={"search": owner["email"], "role": "owner"},
            headers=admin["headers"],
        )
        assert response.status_code == 200, response.text
        ids = [u["id"] for u in response.json()["users"]]
        assert owner["id"] in ids

        response = client.get(
            "/api/v1/admin/users",
            params={"search": owner["email"], "role": "cashier"},
            headers=admin["headers"],
        )
        assert response.status_code == 200, response.text
        assert response.json()["users"] == []

    def test_invalid_role_filter_returns_400(self, client, admin):
        response = client.get("/api/v1/admin/users", params={"role": "not-a-role"}, headers=admin["headers"])
        assert response.status_code == 400

    def test_store_id_filter(self, client, admin, owner):
        response = client.get(
            "/api/v1/admin/users",
            params={"store_id": owner["store_id"]},
            headers=admin["headers"],
        )
        assert response.status_code == 200, response.text
        ids = [u["id"] for u in response.json()["users"]]
        assert owner["id"] in ids

    def test_is_active_filter(self, client, admin, owner):
        response = client.get(
            "/api/v1/admin/users",
            params={"search": owner["email"], "is_active": True},
            headers=admin["headers"],
        )
        assert response.status_code == 200, response.text
        ids = [u["id"] for u in response.json()["users"]]
        assert owner["id"] in ids

        response = client.get(
            "/api/v1/admin/users",
            params={"search": owner["email"], "is_active": False},
            headers=admin["headers"],
        )
        assert response.status_code == 200, response.text
        assert response.json()["users"] == []


class TestUserDetail:
    def test_detail_includes_recent_logins_no_password_hash(self, client, admin, owner):
        response = client.get(f"/api/v1/admin/users/{owner['id']}", headers=admin["headers"])
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"] == owner["id"]
        assert "password_hash" not in data
        assert "recent_logins" in data
        assert any(lh["success"] is True and lh["login_method"] == "password" for lh in data["recent_logins"])

    def test_detail_404_for_unknown_user(self, client, admin):
        response = client.get("/api/v1/admin/users/999999999", headers=admin["headers"])
        assert response.status_code == 404

    def test_detail_non_admin_forbidden(self, client, owner):
        response = client.get(f"/api/v1/admin/users/{owner['id']}", headers={"Authorization": f"Bearer {owner['token']}"})
        assert response.status_code == 403


class TestActivateDeactivate:
    def test_deactivate_revokes_token_and_audit(self, client, admin, owner):
        response = client.post(f"/api/v1/admin/users/{owner['id']}/deactivate", headers=admin["headers"])
        assert response.status_code == 200, response.text
        assert response.json() == {"id": owner["id"], "is_active": False}

        # Old token now rejected (revoked via tokens_valid_after)
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner['token']}"})
        assert me.status_code == 401

        audit = _last_audit(owner["id"], "admin_user_deactivate")
        assert audit is not None
        assert audit.old_values == {"is_active": True}
        assert audit.new_values == {"is_active": False}

    def test_activate_reverses_deactivation(self, client, admin, owner):
        deactivate = client.post(f"/api/v1/admin/users/{owner['id']}/deactivate", headers=admin["headers"])
        assert deactivate.status_code == 200

        response = client.post(f"/api/v1/admin/users/{owner['id']}/activate", headers=admin["headers"])
        assert response.status_code == 200, response.text
        assert response.json() == {"id": owner["id"], "is_active": True}

        audit = _last_audit(owner["id"], "admin_user_activate")
        assert audit is not None
        assert audit.new_values == {"is_active": True}

        # A fresh login now works again
        login = client.post("/api/v1/auth/login", data={"username": owner["email"], "password": owner["password"]})
        assert login.status_code == 200

    def test_deactivate_404_for_unknown_user(self, client, admin):
        response = client.post("/api/v1/admin/users/999999999/deactivate", headers=admin["headers"])
        assert response.status_code == 404

    def test_activate_404_for_unknown_user(self, client, admin):
        response = client.post("/api/v1/admin/users/999999999/activate", headers=admin["headers"])
        assert response.status_code == 404

    def test_cannot_deactivate_last_active_admin(self, client, admin):
        response = client.post(f"/api/v1/admin/users/{admin['id']}/deactivate", headers=admin["headers"])
        assert response.status_code == 400

    def test_can_deactivate_admin_when_another_active_admin_exists(self, client, admin):
        ts = datetime.now().timestamp()

        async def _create_second_admin():
            async with async_session_maker() as db:
                user = User(
                    store_id=None,
                    email=f"admin_users_second_{ts}@test.com",
                    full_name="Second Platform Admin",
                    password_hash=get_password_hash("AdminPass123!"),
                    role=UserRole.ADMIN,
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
                return user.id

        second_admin_id = asyncio.run(_create_second_admin())
        asyncio.run(engine.dispose())

        response = client.post(f"/api/v1/admin/users/{second_admin_id}/deactivate", headers=admin["headers"])
        assert response.status_code == 200, response.text
        assert response.json() == {"id": second_admin_id, "is_active": False}

    def test_deactivate_non_admin_forbidden(self, client, owner):
        response = client.post(
            f"/api/v1/admin/users/{owner['id']}/deactivate",
            headers={"Authorization": f"Bearer {owner['token']}"},
        )
        assert response.status_code == 403

    def test_deactivate_unauthenticated(self, client, owner):
        response = client.post(f"/api/v1/admin/users/{owner['id']}/deactivate")
        assert response.status_code == 401
