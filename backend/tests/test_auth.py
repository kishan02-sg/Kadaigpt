"""
KadaiGPT - Unit Tests for Authentication API
Run with: pytest tests/test_auth.py -v
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


class TestRegistration:
    """Tests for user registration"""
    
    def test_register_success(self, client):
        """Test successful registration"""
        unique_email = f"test_{datetime.now().timestamp()}@example.com"
        
        response = client.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "SecurePass123!",
            "store_name": "Test Kirana Store"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == unique_email
    
    def test_register_invalid_email(self, client):
        """Test registration with invalid email"""
        response = client.post("/api/v1/auth/register", json={
            "email": "invalid-email",
            "password": "SecurePass123!",
            "store_name": "Test Store"
        })
        
        assert response.status_code == 422
    
    def test_register_weak_password(self, client):
        """Test registration with weak password"""
        response = client.post("/api/v1/auth/register", json={
            "email": f"test_{datetime.now().timestamp()}@example.com",
            "password": "123",  # Too short
            "store_name": "Test Store"
        })
        
        # Should fail validation or be rejected
        assert response.status_code in [400, 422]
    
    def test_register_duplicate_email(self, client):
        """Test registration with existing email"""
        email = f"duplicate_{datetime.now().timestamp()}@example.com"
        
        # First registration
        client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Store 1"
        })
        
        # Second registration with same email
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "Store 2"
        })
        
        assert response.status_code == 400
    
    def test_register_missing_fields(self, client):
        """Test registration with missing fields"""
        response = client.post("/api/v1/auth/register", json={
            "email": "test@example.com"
            # Missing password and store_name
        })
        
        assert response.status_code == 422


class TestLogin:
    """Tests for user login"""
    
    @pytest.fixture
    def registered_user(self, client):
        """Create a registered user for login tests"""
        email = f"login_test_{datetime.now().timestamp()}@example.com"
        password = "SecurePass123!"
        
        client.post("/api/v1/auth/register", json={
            "email": email,
            "password": password,
            "store_name": "Login Test Store"
        })
        
        return {"email": email, "password": password}
    
    def test_login_success(self, client, registered_user):
        """Test successful login"""
        response = client.post("/api/v1/auth/login", data={
            "username": registered_user["email"],
            "password": registered_user["password"]
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_wrong_password(self, client, registered_user):
        """Test login with wrong password"""
        response = client.post("/api/v1/auth/login", data={
            "username": registered_user["email"],
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post("/api/v1/auth/login", data={
            "username": "nonexistent@example.com",
            "password": "AnyPassword123!"
        })
        
        assert response.status_code == 401
    
    def test_login_missing_fields(self, client):
        """Test login with missing fields"""
        response = client.post("/api/v1/auth/login", data={
            "username": "test@example.com"
            # Missing password
        })
        
        assert response.status_code == 422


class TestCurrentUser:
    """Tests for getting current user"""
    
    def test_get_current_user_success(self, client):
        """Test getting current user with valid token"""
        # Register and get token
        email = f"me_test_{datetime.now().timestamp()}@example.com"
        register_response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "SecurePass123!",
            "store_name": "My Store"
        })
        
        token = register_response.json()["access_token"]
        
        # Get current user
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
    
    def test_get_current_user_no_token(self, client):
        """Test getting current user without token"""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
    
    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401
    
    def test_get_current_user_malformed_header(self, client):
        """Test getting current user with malformed auth header"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "InvalidFormat token"}
        )
        
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
