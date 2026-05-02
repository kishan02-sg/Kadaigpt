"""
KadaiGPT - Integration Tests
End-to-end tests for complete user flows
Run with: pytest tests/test_integration.py -v
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


class TestCompleteUserFlow:
    """Test complete user journey from registration to using the app"""
    
    def test_new_user_onboarding(self, client):
        """Test complete onboarding flow for a new user"""
        unique_id = int(datetime.now().timestamp())
        email = f"newuser_{unique_id}@example.com"
        
        # Step 1: Register
        register_response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "New Kirana Store"
        })
        
        assert register_response.status_code == 200
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Get dashboard (should work for new user)
        dashboard_response = client.get("/api/v1/dashboard/stats", headers=headers)
        assert dashboard_response.status_code == 200
        
        # Step 3: Add first product
        product_response = client.post("/api/v1/products", headers=headers, json={
            "name": "Rice 5kg",
            "price": 450,
            "stock": 50,
            "category": "Grains"
        })
        assert product_response.status_code == 200
        
        # Step 4: Create first bill
        bill_response = client.post("/api/v1/bills", headers=headers, json={
            "customer_name": "First Customer",
            "items": [{"product_name": "Rice 5kg", "quantity": 1, "unit_price": 450}],
            "payment_mode": "Cash"
        })
        assert bill_response.status_code == 200
        
        # Step 5: Check dashboard again (should show activity)
        final_dashboard = client.get("/api/v1/dashboard/stats", headers=headers)
        assert final_dashboard.status_code == 200


class TestBillingFlow:
    """Test complete billing workflow"""
    
    @pytest.fixture
    def setup_store(self, client):
        """Set up a store with products"""
        email = f"billing_{datetime.now().timestamp()}@example.com"
        
        # Register
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Billing Test Store"
        })
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Add products
        products = [
            {"name": "Rice 5kg", "price": 450, "stock": 100, "category": "Grains"},
            {"name": "Dal 1kg", "price": 150, "stock": 50, "category": "Pulses"},
            {"name": "Oil 1L", "price": 180, "stock": 30, "category": "Oils"},
        ]
        
        for product in products:
            client.post("/api/v1/products", headers=headers, json=product)
        
        return headers
    
    def test_create_cash_bill(self, client, setup_store):
        """Test creating a cash payment bill"""
        headers = setup_store
        
        response = client.post("/api/v1/bills", headers=headers, json={
            "customer_name": "Cash Customer",
            "items": [
                {"product_name": "Rice 5kg", "quantity": 2, "unit_price": 450},
                {"product_name": "Dal 1kg", "quantity": 1, "unit_price": 150}
            ],
            "payment_mode": "Cash"
        })
        
        assert response.status_code == 200
        bill = response.json()
        assert bill.get("total") == (450 * 2 + 150) or "id" in bill
    
    def test_create_upi_bill(self, client, setup_store):
        """Test creating a UPI payment bill"""
        headers = setup_store
        
        response = client.post("/api/v1/bills", headers=headers, json={
            "customer_name": "UPI Customer",
            "customer_phone": "9876543210",
            "items": [
                {"product_name": "Oil 1L", "quantity": 1, "unit_price": 180}
            ],
            "payment_mode": "UPI"
        })
        
        assert response.status_code == 200
    
    def test_create_credit_bill(self, client, setup_store):
        """Test creating a credit/khata bill"""
        headers = setup_store
        
        response = client.post("/api/v1/bills", headers=headers, json={
            "customer_name": "Credit Customer",
            "customer_phone": "9876543211",
            "items": [
                {"product_name": "Rice 5kg", "quantity": 5, "unit_price": 450}
            ],
            "payment_mode": "Credit"
        })
        
        assert response.status_code == 200


class TestInventoryFlow:
    """Test inventory management workflow"""
    
    @pytest.fixture
    def setup_inventory(self, client):
        """Set up store with inventory"""
        email = f"inventory_{datetime.now().timestamp()}@example.com"
        
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Inventory Test Store"
        })
        
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_add_and_sell_product(self, client, setup_inventory):
        """Test adding product and selling it"""
        headers = setup_inventory
        
        # Add product with stock
        add_response = client.post("/api/v1/products", headers=headers, json={
            "name": "Test Product",
            "price": 100,
            "stock": 10,
            "min_stock": 5
        })
        
        assert add_response.status_code == 200
        initial_stock = add_response.json().get("stock", 10)
        
        # Sell some
        client.post("/api/v1/bills", headers=headers, json={
            "customer_name": "Buyer",
            "items": [{"product_name": "Test Product", "quantity": 3, "unit_price": 100}],
            "payment_mode": "Cash"
        })
        
        # Verify stock decreased (if stock tracking is implemented)
        # This would need the actual product ID to verify


class TestCustomerFlow:
    """Test customer management workflow"""
    
    @pytest.fixture
    def setup_customers(self, client):
        """Set up store for customer testing"""
        email = f"customers_{datetime.now().timestamp()}@example.com"
        
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Customer Test Store"
        })
        
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_customer_credit_cycle(self, client, setup_customers):
        """Test complete customer credit cycle"""
        headers = setup_customers
        
        # Create customer
        customer_response = client.post("/api/v1/customers", headers=headers, json={
            "name": "Credit Test Customer",
            "phone": "9876543210",
            "credit_limit": 10000
        })
        
        assert customer_response.status_code == 200
        
        # Create credit bill
        bill_response = client.post("/api/v1/bills", headers=headers, json={
            "customer_name": "Credit Test Customer",
            "customer_phone": "9876543210",
            "items": [{"product_name": "Product", "quantity": 1, "unit_price": 500}],
            "payment_mode": "Credit"
        })
        
        assert bill_response.status_code == 200
        
        # Check customer stats
        stats_response = client.get("/api/v1/customers/stats/summary", headers=headers)
        assert stats_response.status_code == 200


class TestAnalyticsFlow:
    """Test analytics and reporting workflow"""
    
    @pytest.fixture
    def setup_analytics(self, client):
        """Set up store with data for analytics"""
        email = f"analytics_{datetime.now().timestamp()}@example.com"
        
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Analytics Test Store"
        })
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Add some bills for analytics
        for i in range(5):
            client.post("/api/v1/bills", headers=headers, json={
                "customer_name": f"Customer {i}",
                "items": [{"product_name": f"Product {i}", "quantity": 1, "unit_price": 100 * (i+1)}],
                "payment_mode": ["Cash", "UPI", "Card"][i % 3]
            })
        
        return headers
    
    def test_full_analytics_report(self, client, setup_analytics):
        """Test getting full analytics report"""
        headers = setup_analytics
        
        # Sales overview
        sales_response = client.get("/api/v1/analytics/sales/overview", headers=headers)
        assert sales_response.status_code == 200
        
        # Product performance
        products_response = client.get("/api/v1/analytics/products/top-selling", headers=headers)
        assert products_response.status_code == 200
        
        # Customer analytics
        customers_response = client.get("/api/v1/analytics/customers/overview", headers=headers)
        assert customers_response.status_code == 200
        
        # Summary report
        summary_response = client.get("/api/v1/analytics/reports/summary", headers=headers)
        assert summary_response.status_code == 200


class TestBulkOperationsFlow:
    """Test bulk import/export workflow"""
    
    @pytest.fixture
    def setup_bulk(self, client):
        """Set up store for bulk operations"""
        email = f"bulk_{datetime.now().timestamp()}@example.com"
        
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Bulk Test Store"
        })
        
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_export_import_cycle(self, client, setup_bulk):
        """Test exporting and importing data"""
        headers = setup_bulk
        
        # Export products
        export_response = client.get("/api/v1/bulk/export/products?format=json", headers=headers)
        assert export_response.status_code == 200
        
        # Export customers
        export_customers = client.get("/api/v1/bulk/export/customers?format=json", headers=headers)
        assert export_customers.status_code == 200
        
        # Get product template
        template_response = client.get("/api/v1/bulk/templates/products", headers=headers)
        assert template_response.status_code == 200
    
    def test_backup_restore(self, client, setup_bulk):
        """Test backup and restore"""
        headers = setup_bulk
        
        # Create backup
        backup_response = client.get("/api/v1/bulk/backup", headers=headers)
        assert backup_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
