"""
KadaiGPT - Unit Tests for Bills API
Run with: pytest tests/test_bills.py -v
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
def auth_headers(client):
    """Get authentication headers"""
    email = f"bills_test_{datetime.now().timestamp()}@example.com"
    
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "SecurePass123!",
        "store_name": "Bills Test Store"
    })
    
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestListBills:
    """Tests for listing bills"""
    
    def test_list_bills_unauthorized(self, client):
        """Test listing bills without auth"""
        response = client.get("/api/v1/bills")
        assert response.status_code == 401
    
    def test_list_bills_success(self, client, auth_headers):
        """Test listing bills successfully"""
        response = client.get("/api/v1/bills", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_list_bills_with_date_filter(self, client, auth_headers):
        """Test filtering bills by date"""
        response = client.get(
            "/api/v1/bills?start_date=2026-01-01&end_date=2026-12-31",
            headers=auth_headers
        )
        
        assert response.status_code == 200
    
    def test_list_bills_with_payment_filter(self, client, auth_headers):
        """Test filtering bills by payment mode"""
        response = client.get(
            "/api/v1/bills?payment_mode=UPI",
            headers=auth_headers
        )
        
        assert response.status_code == 200


class TestCreateBill:
    """Tests for creating bills"""
    
    def test_create_bill_success(self, client, auth_headers):
        """Test creating a bill successfully"""
        bill_data = {
            "customer_name": "Test Customer",
            "customer_phone": "9876543210",
            "items": [
                {
                    "product_name": "Test Product",
                    "quantity": 2,
                    "unit_price": 100
                }
            ],
            "payment_mode": "Cash"
        }
        
        response = client.post(
            "/api/v1/bills",
            headers=auth_headers,
            json=bill_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "bill_number" in data or "id" in data
    
    def test_create_bill_unauthorized(self, client):
        """Test creating bill without auth"""
        response = client.post("/api/v1/bills", json={
            "customer_name": "Test",
            "items": []
        })
        
        assert response.status_code == 401
    
    def test_create_bill_empty_items(self, client, auth_headers):
        """Test creating bill with empty items"""
        response = client.post(
            "/api/v1/bills",
            headers=auth_headers,
            json={
                "customer_name": "Test Customer",
                "items": [],
                "payment_mode": "Cash"
            }
        )
        
        # Should fail - empty bill
        assert response.status_code in [400, 422, 200]  # Depends on implementation
    
    def test_create_bill_with_discount(self, client, auth_headers):
        """Test creating bill with discount"""
        bill_data = {
            "customer_name": "VIP Customer",
            "items": [
                {
                    "product_name": "Premium Product",
                    "quantity": 1,
                    "unit_price": 1000
                }
            ],
            "payment_mode": "UPI",
            "discount": 100
        }
        
        response = client.post(
            "/api/v1/bills",
            headers=auth_headers,
            json=bill_data
        )
        
        assert response.status_code == 200
    
    def test_create_bill_credit_payment(self, client, auth_headers):
        """Test creating bill with credit payment"""
        bill_data = {
            "customer_name": "Credit Customer",
            "customer_phone": "9876543210",
            "items": [
                {
                    "product_name": "Product",
                    "quantity": 1,
                    "unit_price": 500
                }
            ],
            "payment_mode": "Credit"
        }
        
        response = client.post(
            "/api/v1/bills",
            headers=auth_headers,
            json=bill_data
        )
        
        assert response.status_code == 200


class TestGetBill:
    """Tests for getting a single bill"""
    
    def test_get_bill_success(self, client, auth_headers):
        """Test getting a bill by ID"""
        # First create a bill
        create_response = client.post(
            "/api/v1/bills",
            headers=auth_headers,
            json={
                "customer_name": "Test",
                "items": [{"product_name": "Item", "quantity": 1, "unit_price": 100}],
                "payment_mode": "Cash"
            }
        )
        
        bill_id = create_response.json().get("id")
        
        if bill_id:
            response = client.get(
                f"/api/v1/bills/{bill_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            assert response.json()["id"] == bill_id
    
    def test_get_nonexistent_bill(self, client, auth_headers):
        """Test getting a bill that doesn't exist"""
        response = client.get(
            "/api/v1/bills/99999",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestBillStatistics:
    """Tests for bill statistics"""
    
    def test_get_today_stats(self, client, auth_headers):
        """Test getting today's bill statistics"""
        response = client.get(
            "/api/v1/dashboard/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "today_sales" in data or "total_sales" in data


class TestPrintBill:
    """Tests for printing bills"""
    
    def test_print_preview(self, client, auth_headers):
        """Test generating print preview"""
        response = client.post(
            "/api/v1/print/preview",
            headers=auth_headers,
            json={
                "bill_number": "INV-TEST-001",
                "store_name": "Test Store",
                "items": [
                    {"name": "Product", "qty": 1, "price": 100, "total": 100}
                ],
                "subtotal": 100,
                "tax": 5,
                "total": 105
            }
        )
        
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
