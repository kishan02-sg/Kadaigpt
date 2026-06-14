"""
KadaiGPT - Staff Auth & RBAC Tests
Covers create-staff and staff-login for manager, cashier, and
inventory_manager roles, plus role-gated endpoint access.

Run with: pytest tests/test_rbac.py -v
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def owner_headers(client):
    """Register a fresh owner, return auth headers"""
    ts = datetime.now().timestamp()
    response = client.post("/api/v1/auth/register", json={
        "email": f"rbac_owner_{ts}@example.com",
        "password": "SecurePass123!",
        "full_name": "RBAC Owner",
        "store_name": "RBAC Test Store",
    })
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


def _create_staff(client, headers, role, full_name, phone=None):
    payload = {"full_name": full_name, "role": role}
    if phone:
        payload["phone"] = phone
    return client.post("/api/v1/auth/create-staff", json=payload, headers=headers)


def _staff_headers(client, staff_id, password):
    response = client.post("/api/v1/auth/staff-login", json={
        "staff_id": staff_id,
        "password": password,
    })
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestCreateStaffAllRoles:
    """POST /auth/create-staff for manager, cashier, inventory_manager"""

    @pytest.mark.parametrize("role", ["manager", "cashier", "inventory_manager"])
    def test_create_staff_success(self, client, owner_headers, role):
        response = _create_staff(client, owner_headers, role, f"Test {role.title()}")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == role
        assert data["staff_id"].startswith("KDG-")
        assert "temporary_password" in data

    def test_create_staff_invalid_role(self, client, owner_headers):
        response = _create_staff(client, owner_headers, "superadmin", "Bad Role")
        assert response.status_code == 400

    def test_create_staff_unauthenticated(self, client):
        response = client.post("/api/v1/auth/create-staff", json={
            "full_name": "X", "role": "cashier"
        })
        assert response.status_code == 401


class TestManagerCannotCreateManager:
    """Manager-created-by-owner attempting to create another manager -> 403"""

    def test_manager_cannot_create_manager(self, client, owner_headers):
        create_resp = _create_staff(client, owner_headers, "manager", "Manager One")
        manager_headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )

        resp = _create_staff(client, manager_headers, "manager", "Manager Two")
        assert resp.status_code == 403

    def test_manager_can_create_cashier_and_inventory_manager(self, client, owner_headers):
        create_resp = _create_staff(client, owner_headers, "manager", "Manager Three")
        manager_headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )

        for role in ["cashier", "inventory_manager"]:
            resp = _create_staff(client, manager_headers, role, f"Sub {role}")
            assert resp.status_code == 200


class TestStaffLoginAllRoles:
    """POST /auth/staff-login + GET /auth/me for each role"""

    @pytest.mark.parametrize("role", ["manager", "cashier", "inventory_manager"])
    def test_staff_login_success(self, client, owner_headers, role):
        create_resp = _create_staff(client, owner_headers, role, f"Login {role}")
        staff_id = create_resp.json()["staff_id"]
        temp_pw = create_resp.json()["temporary_password"]

        login_resp = client.post("/api/v1/auth/staff-login", json={
            "staff_id": staff_id, "password": temp_pw
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

        token = data["access_token"]
        me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["role"].upper() == role.upper()

    def test_staff_login_wrong_password(self, client, owner_headers):
        create_resp = _create_staff(client, owner_headers, "cashier", "Wrong PW Cashier")
        staff_id = create_resp.json()["staff_id"]

        resp = client.post("/api/v1/auth/staff-login", json={
            "staff_id": staff_id, "password": "wrongpassword"
        })
        assert resp.status_code == 401

    def test_staff_login_nonexistent_staff_id(self, client):
        resp = client.post("/api/v1/auth/staff-login", json={
            "staff_id": "KDG-0000", "password": "whatever"
        })
        assert resp.status_code == 401


class TestRoleGatedEndpoints:
    """require_role / require_min_role checks per staff role"""

    def test_cashier_cannot_create_category(self, client, owner_headers):
        """POST /products/categories requires owner/manager/inventory_manager"""
        create_resp = _create_staff(client, owner_headers, "cashier", "Cat Cashier")
        cashier_headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )
        resp = client.post("/api/v1/products/categories", json={
            "name": "Should Fail"
        }, headers=cashier_headers)
        assert resp.status_code == 403

    def test_inventory_manager_can_create_category(self, client, owner_headers):
        create_resp = _create_staff(client, owner_headers, "inventory_manager", "Cat Inv")
        inv_headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )
        resp = client.post("/api/v1/products/categories", json={
            "name": f"Inv Category {datetime.now().timestamp()}"
        }, headers=inv_headers)
        assert resp.status_code == 201

    @pytest.mark.parametrize("role", ["cashier", "inventory_manager"])
    def test_staff_below_manager_cannot_view_sales_overview(self, client, owner_headers, role):
        """GET /analytics/sales/overview requires require_min_role(MANAGER)"""
        create_resp = _create_staff(client, owner_headers, role, f"Analytics {role}")
        headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )
        resp = client.get("/api/v1/analytics/sales/overview", headers=headers)
        assert resp.status_code == 403

    def test_manager_can_view_sales_overview(self, client, owner_headers):
        create_resp = _create_staff(client, owner_headers, "manager", "Analytics Manager")
        headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )
        resp = client.get("/api/v1/analytics/sales/overview", headers=headers)
        assert resp.status_code == 200

    @pytest.mark.parametrize("role", ["cashier", "inventory_manager"])
    def test_any_staff_can_view_hourly_sales(self, client, owner_headers, role):
        """GET /analytics/sales/hourly only requires get_current_user (any role)"""
        create_resp = _create_staff(client, owner_headers, role, f"Hourly {role}")
        headers = _staff_headers(
            client, create_resp.json()["staff_id"], create_resp.json()["temporary_password"]
        )
        resp = client.get("/api/v1/analytics/sales/hourly", headers=headers)
        assert resp.status_code == 200
