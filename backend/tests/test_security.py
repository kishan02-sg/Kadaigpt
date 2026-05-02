"""
KadaiGPT - Unit Tests for Security Middleware
Run with: pytest tests/test_security.py -v
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.middleware.security import (
    RateLimiter,
    InputSanitizer,
    AuditLogger,
    validate_gstin,
    validate_phone,
    validate_email,
    generate_secure_token
)


class TestRateLimiter:
    """Tests for rate limiter"""
    
    def test_rate_limiter_allows_initial_requests(self):
        """Test that rate limiter allows initial requests"""
        limiter = RateLimiter()
        allowed, remaining = limiter.check_rate_limit("test_key", 10, 60)
        
        assert allowed is True
        assert remaining == 9
    
    def test_rate_limiter_blocks_excess_requests(self):
        """Test that rate limiter blocks after limit exceeded"""
        limiter = RateLimiter()
        
        # Make 10 requests
        for i in range(10):
            limiter.check_rate_limit("test_key_2", 10, 60)
        
        # 11th request should be blocked
        allowed, remaining = limiter.check_rate_limit("test_key_2", 10, 60)
        assert allowed is False
        assert remaining == 0
    
    def test_rate_limiter_separate_keys(self):
        """Test that different keys have separate limits"""
        limiter = RateLimiter()
        
        # Exhaust limit for key1
        for i in range(10):
            limiter.check_rate_limit("key1", 10, 60)
        
        # key2 should still be allowed
        allowed, _ = limiter.check_rate_limit("key2", 10, 60)
        assert allowed is True
    
    def test_block_and_unblock(self):
        """Test manual blocking"""
        limiter = RateLimiter()
        
        # Block for 1 second
        limiter.block("blocked_key", 1)
        
        assert limiter.is_blocked("blocked_key") is True


class TestInputSanitizer:
    """Tests for input sanitization"""
    
    def test_sql_injection_detection(self):
        """Test SQL injection detection"""
        dangerous_inputs = [
            "SELECT * FROM users",
            "'; DROP TABLE users;--",
            "1 OR 1=1",
            "1 AND 1=1",
        ]
        
        for input_str in dangerous_inputs:
            assert InputSanitizer.check_sql_injection(input_str) is True
    
    def test_safe_input_passes_sql_check(self):
        """Test that safe input passes SQL check"""
        safe_inputs = [
            "John Doe",
            "Rice 5kg",
            "user@email.com",
            "Customer 123"
        ]
        
        for input_str in safe_inputs:
            assert InputSanitizer.check_sql_injection(input_str) is False
    
    def test_xss_detection(self):
        """Test XSS detection"""
        dangerous_inputs = [
            "<script>alert('xss')</script>",
            "javascript:void(0)",
            "onmouseover=alert(1)",
            "<iframe src='evil.com'>"
        ]
        
        for input_str in dangerous_inputs:
            assert InputSanitizer.check_xss(input_str) is True
    
    def test_safe_input_passes_xss_check(self):
        """Test that safe input passes XSS check"""
        safe_inputs = [
            "Hello World",
            "Price: ₹500",
            "Email: test@test.com"
        ]
        
        for input_str in safe_inputs:
            assert InputSanitizer.check_xss(input_str) is False
    
    def test_path_traversal_detection(self):
        """Test path traversal detection"""
        dangerous_inputs = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32",
            "%2e%2e%2f",
        ]
        
        for input_str in dangerous_inputs:
            assert InputSanitizer.check_path_traversal(input_str) is True
    
    def test_sanitize_string(self):
        """Test string sanitization"""
        input_str = "<script>alert('test')</script>"
        sanitized = InputSanitizer.sanitize_string(input_str)
        
        assert "<script>" not in sanitized
        assert "&lt;script&gt;" in sanitized
    
    def test_sanitize_truncates_long_strings(self):
        """Test that sanitize truncates long strings"""
        long_string = "a" * 2000
        sanitized = InputSanitizer.sanitize_string(long_string, max_length=100)
        
        assert len(sanitized) == 100


class TestAuditLogger:
    """Tests for audit logging"""
    
    def test_log_event(self):
        """Test event logging"""
        logger = AuditLogger()
        
        logger.log_event(
            event_type="TEST_EVENT",
            user_id=1,
            ip_address="127.0.0.1",
            path="/test",
            method="GET",
            status_code=200,
            details={"test": "data"}
        )
        
        events = logger.get_recent_events()
        assert len(events) == 1
        assert events[0]["event_type"] == "TEST_EVENT"
    
    def test_mask_sensitive_data(self):
        """Test that sensitive data is masked"""
        logger = AuditLogger()
        
        logger.log_event(
            event_type="LOGIN",
            user_id=1,
            ip_address="127.0.0.1",
            path="/login",
            method="POST",
            status_code=200,
            details={"password": "secret123", "username": "test"}
        )
        
        events = logger.get_recent_events()
        assert events[0]["details"]["password"] == "***REDACTED***"
        assert events[0]["details"]["username"] == "test"
    
    def test_filter_by_user_id(self):
        """Test filtering events by user ID"""
        logger = AuditLogger()
        
        logger.log_event("EVENT1", 1, "127.0.0.1", "/test1", "GET", 200)
        logger.log_event("EVENT2", 2, "127.0.0.1", "/test2", "GET", 200)
        logger.log_event("EVENT3", 1, "127.0.0.1", "/test3", "GET", 200)
        
        events = logger.get_recent_events(user_id=1)
        assert len(events) == 2
    
    def test_filter_by_event_type(self):
        """Test filtering events by type"""
        logger = AuditLogger()
        
        logger.log_event("LOGIN", 1, "127.0.0.1", "/login", "POST", 200)
        logger.log_event("LOGOUT", 1, "127.0.0.1", "/logout", "POST", 200)
        logger.log_event("LOGIN", 2, "127.0.0.1", "/login", "POST", 200)
        
        events = logger.get_recent_events(event_type="LOGIN")
        assert len(events) == 2


class TestValidators:
    """Tests for validation utilities"""
    
    def test_valid_gstin(self):
        """Test valid GSTIN"""
        valid_gstins = [
            "33AABCU9603R1ZM",
            "07AAGCR4375J1ZR",
            "27AADCB2230M1ZT"
        ]
        
        for gstin in valid_gstins:
            assert validate_gstin(gstin) is True
    
    def test_invalid_gstin(self):
        """Test invalid GSTIN"""
        invalid_gstins = [
            "INVALID",
            "12345",
            "",
            None
        ]
        
        for gstin in invalid_gstins:
            assert validate_gstin(gstin or "") is False
    
    def test_valid_phone(self):
        """Test valid Indian phone numbers"""
        valid_phones = [
            "9876543210",
            "8765432109",
            "7654321098",
            "6543210987"
        ]
        
        for phone in valid_phones:
            assert validate_phone(phone) is True
    
    def test_invalid_phone(self):
        """Test invalid phone numbers"""
        invalid_phones = [
            "1234567890",  # Starts with 1
            "12345",       # Too short
            "abc",         # Not numeric
            ""             # Empty
        ]
        
        for phone in invalid_phones:
            assert validate_phone(phone) is False
    
    def test_valid_email(self):
        """Test valid emails"""
        valid_emails = [
            "test@example.com",
            "user.name@domain.co.in",
            "user+tag@gmail.com"
        ]
        
        for email in valid_emails:
            assert validate_email(email) is True
    
    def test_invalid_email(self):
        """Test invalid emails"""
        invalid_emails = [
            "invalid",
            "@domain.com",
            "user@",
            ""
        ]
        
        for email in invalid_emails:
            assert validate_email(email) is False


class TestSecureToken:
    """Tests for secure token generation"""
    
    def test_token_generation(self):
        """Test that tokens are generated"""
        token = generate_secure_token()
        assert token is not None
        assert len(token) > 0
    
    def test_token_uniqueness(self):
        """Test that tokens are unique"""
        tokens = [generate_secure_token() for _ in range(100)]
        unique_tokens = set(tokens)
        assert len(unique_tokens) == 100
    
    def test_token_length(self):
        """Test token length parameter"""
        token_16 = generate_secure_token(16)
        token_32 = generate_secure_token(32)
        
        assert len(token_16) < len(token_32)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
