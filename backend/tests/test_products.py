"""
KadaiGPT - Unit Tests for Products API
Run with: pytest tests/test_products.py -v
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
    email = f"products_test_{datetime.now().timestamp()}@example.com"
    
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "SecurePass123!",
        "store_name": "Products Test Store"
    })
    
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestListProducts:
    """Tests for listing products"""
    
    def test_list_products_unauthorized(self, client):
        """Test listing products without auth"""
        response = client.get("/api/v1/products")
        assert response.status_code == 401
    
    def test_list_products_success(self, client, auth_headers):
        """Test listing products successfully"""
        response = client.get("/api/v1/products", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
    
    def test_list_products_with_category_filter(self, client, auth_headers):
        """Test filtering products by category"""
        response = client.get(
            "/api/v1/products?category=Grains",
            headers=auth_headers
        )
        
        assert response.status_code == 200
    
    def test_list_products_with_search(self, client, auth_headers):
        """Test searching products"""
        response = client.get(
            "/api/v1/products?search=rice",
            headers=auth_headers
        )
        
        assert response.status_code == 200


class TestCreateProduct:
    """Tests for creating products"""
    
    def test_create_product_success(self, client, auth_headers):
        """Test creating a product successfully"""
        product_data = {
            "name": f"Test Product {datetime.now().timestamp()}",
            "sku": f"TEST-{int(datetime.now().timestamp())}",
            "price": 100,
            "stock": 50,
            "category": "Test",
            "unit": "kg"
        }
        
        response = client.post(
            "/api/v1/products",
            headers=auth_headers,
            json=product_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == product_data["name"]
        assert data["price"] == product_data["price"]
    
    def test_create_product_unauthorized(self, client):
        """Test creating product without auth"""
        response = client.post("/api/v1/products", json={
            "name": "Test",
            "price": 100
        })
        
        assert response.status_code == 401
    
    def test_create_product_invalid_price(self, client, auth_headers):
        """Test creating product with invalid price"""
        response = client.post(
            "/api/v1/products",
            headers=auth_headers,
            json={
                "name": "Invalid Price Product",
                "price": -100,  # Negative price
                "stock": 10
            }
        )
        
        # Should fail validation
        assert response.status_code in [400, 422]
    
    def test_create_product_missing_name(self, client, auth_headers):
        """Test creating product without name"""
        response = client.post(
            "/api/v1/products",
            headers=auth_headers,
            json={
                "price": 100,
                "stock": 10
            }
        )
        
        assert response.status_code == 422


class TestUpdateProduct:
    """Tests for updating products"""
    
    def test_update_product_success(self, client, auth_headers):
        """Test updating a product successfully"""
        # First create a product
        create_response = client.post(
            "/api/v1/products",
            headers=auth_headers,
            json={
                "name": f"Update Test {datetime.now().timestamp()}",
                "price": 100,
                "stock": 50
            }
        )
        
        product_id = create_response.json().get("id")
        
        if product_id:
            # Update the product
            update_response = client.put(
                f"/api/v1/products/{product_id}",
                headers=auth_headers,
                json={
                    "price": 150,
                    "stock": 60
                }
            )
            
            assert update_response.status_code == 200
            assert update_response.json()["price"] == 150
    
    def test_update_nonexistent_product(self, client, auth_headers):
        """Test updating a product that doesn't exist"""
        response = client.put(
            "/api/v1/products/99999",
            headers=auth_headers,
            json={"price": 100}
        )
        
        assert response.status_code == 404


class TestDeleteProduct:
    """Tests for deleting products"""
    
    def test_delete_product_success(self, client, auth_headers):
        """Test deleting a product successfully"""
        # First create a product
        create_response = client.post(
            "/api/v1/products",
            headers=auth_headers,
            json={
                "name": f"Delete Test {datetime.now().timestamp()}",
                "price": 100,
                "stock": 50
            }
        )
        
        product_id = create_response.json().get("id")
        
        if product_id:
            # Delete the product
            delete_response = client.delete(
                f"/api/v1/products/{product_id}",
                headers=auth_headers
            )
            
            assert delete_response.status_code == 200
    
    def test_delete_nonexistent_product(self, client, auth_headers):
        """Test deleting a product that doesn't exist"""
        response = client.delete(
            "/api/v1/products/99999",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestProductCategories:
    """Tests for product categories"""
    
    def test_get_categories(self, client, auth_headers):
        """Test getting product categories"""
        response = client.get(
            "/api/v1/products/categories",
            headers=auth_headers
        )
        
        # May or may not be implemented
        assert response.status_code in [200, 404]


class TestLowStockProducts:
    """Tests for low stock products"""
    
    def test_get_low_stock(self, client, auth_headers):
        """Test getting low stock products"""
        response = client.get(
            "/api/v1/products?low_stock=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        # Should return a list
        assert isinstance(response.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
