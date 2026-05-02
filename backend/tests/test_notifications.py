"""
KadaiGPT - Unit Tests for Notifications API
Run with: pytest tests/test_notifications.py -v
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
        "email": f"test_notif_{datetime.now().timestamp()}@test.com",
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


class TestEmailSettings:
    """Tests for email settings endpoints"""
    
    def test_get_email_settings_unauthorized(self, client):
        """Test getting email settings without auth"""
        response = client.get("/api/v1/notifications/email/settings")
        assert response.status_code == 401
    
    def test_get_email_settings(self, client, auth_headers):
        """Test getting email settings"""
        response = client.get(
            "/api/v1/notifications/email/settings",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "settings" in data
        assert "email_service_enabled" in data
    
    def test_update_email_settings(self, client, auth_headers):
        """Test updating email settings"""
        settings = {
            "daily_summary": True,
            "low_stock_alerts": True,
            "payment_reminders": False,
            "weekly_report": True,
            "email": "test@example.com"
        }
        
        response = client.put(
            "/api/v1/notifications/email/settings",
            headers=auth_headers,
            json=settings
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["settings"]["daily_summary"] is True
        assert data["settings"]["payment_reminders"] is False


class TestEmailSending:
    """Tests for email sending endpoints"""
    
    def test_send_test_email(self, client, auth_headers):
        """Test sending a test email"""
        response = client.post(
            "/api/v1/notifications/email/test",
            headers=auth_headers,
            json={
                "email": "test@example.com",
                "template": "welcome"
            }
        )
        # May fail if email service not configured, but endpoint should work
        assert response.status_code in [200, 503]
    
    def test_send_daily_summary_no_email(self, client, auth_headers):
        """Test sending daily summary without email configured"""
        response = client.post(
            "/api/v1/notifications/email/daily-summary",
            headers=auth_headers
        )
        # Expect 400 if no email, 200 or 503 otherwise
        assert response.status_code in [200, 400, 503]


class TestNotificationHistory:
    """Tests for notification history"""
    
    def test_get_notification_history(self, client, auth_headers):
        """Test getting notification history"""
        response = client.get(
            "/api/v1/notifications/history",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications" in data
        assert "total" in data
    
    def test_get_notification_history_with_limit(self, client, auth_headers):
        """Test getting notification history with custom limit"""
        response = client.get(
            "/api/v1/notifications/history?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["notifications"]) <= 5


class TestNotificationStatus:
    """Tests for notification service status"""
    
    def test_get_notification_status(self, client):
        """Test getting notification service status"""
        response = client.get("/api/v1/notifications/status")
        assert response.status_code == 200
        data = response.json()
        
        assert "email" in data
        assert "whatsapp" in data
        assert "sms" in data
        
        # Check email status structure
        assert "available" in data["email"]
        assert "configured" in data["email"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
