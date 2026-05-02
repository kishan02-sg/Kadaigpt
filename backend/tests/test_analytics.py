"""
KadaiGPT - Unit Tests for Analytics API
Run with: pytest tests/test_analytics.py -v
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Get authentication headers"""
    # Register a test user
    register_data = {
        "email": f"test_{datetime.now().timestamp()}@test.com",
        "password": "testpass123",
        "store_name": "Test Store"
    }
    
    response = client.post("/api/v1/auth/register", json=register_data)
    
    if response.status_code == 200:
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    # Try login if already exists
    login_data = {
        "username": register_data["email"],
        "password": register_data["password"]
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestSalesAnalytics:
    """Tests for sales analytics endpoints"""
    
    def test_sales_overview_unauthorized(self, client):
        """Test sales overview without auth"""
        response = client.get("/api/v1/analytics/sales/overview")
        assert response.status_code == 401
    
    def test_sales_overview_default_period(self, client, auth_headers):
        """Test sales overview with default period"""
        response = client.get(
            "/api/v1/analytics/sales/overview",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "period" in data
        assert data["period"] == "month"
        assert "current" in data
        assert "previous" in data
        assert "change" in data
    
    def test_sales_overview_week_period(self, client, auth_headers):
        """Test sales overview with week period"""
        response = client.get(
            "/api/v1/analytics/sales/overview?period=week",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "week"
    
    def test_sales_overview_day_period(self, client, auth_headers):
        """Test sales overview with day period"""
        response = client.get(
            "/api/v1/analytics/sales/overview?period=day",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "day"
    
    def test_hourly_sales(self, client, auth_headers):
        """Test hourly sales endpoint"""
        response = client.get(
            "/api/v1/analytics/sales/hourly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "hourly_data" in data
        assert len(data["hourly_data"]) == 24
        assert "peak_hour" in data
        assert "total_sales" in data
    
    def test_sales_by_payment(self, client, auth_headers):
        """Test sales by payment method"""
        response = client.get(
            "/api/v1/analytics/sales/by-payment",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "breakdown" in data
        assert len(data["breakdown"]) > 0
        
        # Check payment methods
        methods = [p["method"] for p in data["breakdown"]]
        assert "Cash" in methods
        assert "UPI" in methods


class TestProductAnalytics:
    """Tests for product analytics endpoints"""
    
    def test_top_selling_products(self, client, auth_headers):
        """Test top selling products"""
        response = client.get(
            "/api/v1/analytics/products/top-selling",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "products" in data
        assert "total_revenue" in data
        
        if data["products"]:
            product = data["products"][0]
            assert "name" in product
            assert "quantity_sold" in product
            assert "revenue" in product
    
    def test_top_selling_with_limit(self, client, auth_headers):
        """Test top selling with custom limit"""
        response = client.get(
            "/api/v1/analytics/products/top-selling?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["products"]) <= 5
    
    def test_slow_moving_products(self, client, auth_headers):
        """Test slow moving products"""
        response = client.get(
            "/api/v1/analytics/products/slow-moving",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "products" in data
        assert "recommendations" in data
    
    def test_category_performance(self, client, auth_headers):
        """Test category performance"""
        response = client.get(
            "/api/v1/analytics/products/categories",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        assert "total_revenue" in data
        
        if data["categories"]:
            category = data["categories"][0]
            assert "name" in category
            assert "revenue" in category
            assert "percentage" in category


class TestCustomerAnalytics:
    """Tests for customer analytics endpoints"""
    
    def test_customer_overview(self, client, auth_headers):
        """Test customer overview"""
        response = client.get(
            "/api/v1/analytics/customers/overview",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total_customers" in data
        assert "new_this_month" in data
        assert "repeat_rate" in data
        assert "segments" in data
    
    def test_customer_retention(self, client, auth_headers):
        """Test customer retention"""
        response = client.get(
            "/api/v1/analytics/customers/retention",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "monthly_retention" in data
        assert "churn_rate" in data
        assert "at_risk_customers" in data
        assert "recommendations" in data


class TestInventoryAnalytics:
    """Tests for inventory analytics endpoints"""
    
    def test_inventory_health(self, client, auth_headers):
        """Test inventory health"""
        response = client.get(
            "/api/v1/analytics/inventory/health",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total_products" in data
        assert "total_value" in data
        assert "health_score" in data
        assert "status_breakdown" in data
    
    def test_inventory_predictions(self, client, auth_headers):
        """Test inventory predictions"""
        response = client.get(
            "/api/v1/analytics/inventory/predictions",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "reorder_suggestions" in data
        assert "demand_forecast" in data
        assert "seasonal_insights" in data


class TestFinancialAnalytics:
    """Tests for financial analytics endpoints"""
    
    def test_profit_loss(self, client, auth_headers):
        """Test profit loss statement"""
        response = client.get(
            "/api/v1/analytics/financial/profit-loss",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "revenue" in data
        assert "cost_of_goods_sold" in data
        assert "gross_profit" in data
        assert "net_profit" in data
        assert "net_margin" in data
    
    def test_cashflow(self, client, auth_headers):
        """Test cashflow"""
        response = client.get(
            "/api/v1/analytics/financial/cashflow",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "opening_balance" in data
        assert "inflows" in data
        assert "outflows" in data
        assert "closing_balance" in data


class TestReports:
    """Tests for report endpoints"""
    
    def test_summary_report(self, client, auth_headers):
        """Test summary report"""
        response = client.get(
            "/api/v1/analytics/reports/summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "sales" in data
        assert "customers" in data
        assert "inventory" in data
        assert "financials" in data
        assert "highlights" in data
        assert "action_items" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
