"""
KadaiGPT - Security Middleware & Audit Logging
Rate limiting, input sanitization, and security headers
"""

import os
import re
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from functools import wraps
from collections import defaultdict
import json

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# Rate Limiting
# ═══════════════════════════════════════════════════════════════════

class RateLimiter:
    """In-memory rate limiter with sliding window"""
    
    def __init__(self):
        self.requests: Dict[str, List[datetime]] = defaultdict(list)
        self.blocked: Dict[str, datetime] = {}
    
    def _cleanup_old_requests(self, key: str, window: int):
        """Remove requests outside the time window"""
        cutoff = datetime.utcnow() - timedelta(seconds=window)
        self.requests[key] = [t for t in self.requests[key] if t > cutoff]
    
    def is_blocked(self, key: str) -> bool:
        """Check if IP/user is blocked"""
        if key in self.blocked:
            if datetime.utcnow() < self.blocked[key]:
                return True
            del self.blocked[key]
        return False
    
    def block(self, key: str, duration_seconds: int = 60):
        """Block a key for specified duration"""
        self.blocked[key] = datetime.utcnow() + timedelta(seconds=duration_seconds)
        logger.warning(f"[Security] Blocked {key} for {duration_seconds}s")
    
    def check_rate_limit(
        self,
        key: str,
        max_requests: int = 100,
        window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Check if request is within rate limits.
        Returns (allowed, remaining_requests)
        """
        if self.is_blocked(key):
            return False, 0
        
        self._cleanup_old_requests(key, window_seconds)
        current_count = len(self.requests[key])
        
        if current_count >= max_requests:
            # Block for escalating duration
            if current_count >= max_requests * 2:
                self.block(key, 300)  # 5 minutes for repeat offenders
            return False, 0
        
        self.requests[key].append(datetime.utcnow())
        return True, max_requests - current_count - 1


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit configurations per endpoint type
RATE_LIMITS = {
    'auth': {'max': 5, 'window': 60},      # 5 auth attempts per minute
    'ocr': {'max': 10, 'window': 60},      # 10 OCR requests per minute
    'api': {'max': 100, 'window': 60},     # 100 API calls per minute
    'bulk': {'max': 10, 'window': 300},    # 10 bulk operations per 5 minutes
}


def get_rate_limit_type(path: str) -> str:
    """Determine rate limit type from request path"""
    if '/auth/' in path:
        return 'auth'
    elif '/ocr/' in path:
        return 'ocr'
    elif '/bulk' in path or '/export' in path:
        return 'bulk'
    return 'api'


# ═══════════════════════════════════════════════════════════════════
# Input Sanitization
# ═══════════════════════════════════════════════════════════════════

class InputSanitizer:
    """Sanitize and validate user inputs"""
    
    # Dangerous patterns
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)",
        r"(--|;|\/\*|\*\/)",
        r"(\bOR\b\s+\d+\s*=\s*\d+)",
        r"(\bAND\b\s+\d+\s*=\s*\d+)",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>",
    ]
    
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e%2f",
        r"%252e%252e%252f",
    ]
    
    @classmethod
    def check_sql_injection(cls, value: str) -> bool:
        """Check for SQL injection patterns"""
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @classmethod
    def check_xss(cls, value: str) -> bool:
        """Check for XSS patterns"""
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @classmethod
    def check_path_traversal(cls, value: str) -> bool:
        """Check for path traversal patterns"""
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        return False
    
    @classmethod
    def sanitize_string(cls, value: str, max_length: int = 1000) -> str:
        """Sanitize a string value"""
        if not isinstance(value, str):
            return value
        
        # Truncate
        value = value[:max_length]
        
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Escape HTML entities
        value = (value
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#x27;'))
        
        return value
    
    @classmethod
    def validate_input(cls, value: str) -> tuple[bool, Optional[str]]:
        """
        Validate input for security issues.
        Returns (is_safe, error_message)
        """
        if cls.check_sql_injection(value):
            return False, "Potential SQL injection detected"
        
        if cls.check_xss(value):
            return False, "Potential XSS attack detected"
        
        if cls.check_path_traversal(value):
            return False, "Path traversal attempt detected"
        
        return True, None


# ═══════════════════════════════════════════════════════════════════
# Audit Logging
# ═══════════════════════════════════════════════════════════════════

class AuditLogger:
    """Log security-relevant events for audit trail"""
    
    SENSITIVE_FIELDS = {'password', 'token', 'secret', 'api_key', 'credit_card'}
    
    def __init__(self):
        self.audit_log: List[Dict] = []
        self.max_log_size = 10000
    
    def _mask_sensitive_data(self, data: Dict) -> Dict:
        """Mask sensitive fields in data"""
        if not isinstance(data, dict):
            return data
        
        masked = {}
        for key, value in data.items():
            if any(s in key.lower() for s in self.SENSITIVE_FIELDS):
                masked[key] = '***REDACTED***'
            elif isinstance(value, dict):
                masked[key] = self._mask_sensitive_data(value)
            else:
                masked[key] = value
        return masked
    
    def log_event(
        self,
        event_type: str,
        user_id: Optional[int],
        ip_address: str,
        path: str,
        method: str,
        status_code: int,
        details: Optional[Dict] = None
    ):
        """Log an audit event"""
        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'user_id': user_id,
            'ip_address': ip_address,
            'path': path,
            'method': method,
            'status_code': status_code,
            'details': self._mask_sensitive_data(details or {})
        }
        
        self.audit_log.append(event)
        
        # Maintain max log size
        if len(self.audit_log) > self.max_log_size:
            self.audit_log = self.audit_log[-self.max_log_size:]
        
        # Log to file for important events
        if event_type in ['LOGIN_FAILED', 'UNAUTHORIZED', 'RATE_LIMITED', 'SECURITY_VIOLATION']:
            logger.warning(f"[Audit] {event_type}: {json.dumps(event)}")
    
    def get_recent_events(
        self,
        user_id: Optional[int] = None,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent audit events with optional filters"""
        events = self.audit_log[-limit:]
        
        if user_id:
            events = [e for e in events if e['user_id'] == user_id]
        
        if event_type:
            events = [e for e in events if e['event_type'] == event_type]
        
        return events


# Global audit logger instance
audit_logger = AuditLogger()


# ═══════════════════════════════════════════════════════════════════
# Security Middleware
# ═══════════════════════════════════════════════════════════════════

class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive security middleware"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        path = request.url.path
        method = request.method
        
        # Skip rate limiting for health checks
        if path in ['/health', '/']:
            return await call_next(request)
        
        # Rate limiting check
        rate_type = get_rate_limit_type(path)
        limits = RATE_LIMITS.get(rate_type, RATE_LIMITS['api'])
        allowed, remaining = rate_limiter.check_rate_limit(
            f"{client_ip}:{rate_type}",
            limits['max'],
            limits['window']
        )
        
        if not allowed:
            audit_logger.log_event(
                'RATE_LIMITED',
                None,
                client_ip,
                path,
                method,
                429,
                {'rate_type': rate_type}
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(limits['window'])}
            )
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"[Security] Request error: {e}")
            raise
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        # Log important events
        if response.status_code == 401:
            audit_logger.log_event('UNAUTHORIZED', None, client_ip, path, method, 401)
        elif response.status_code == 403:
            audit_logger.log_event('FORBIDDEN', None, client_ip, path, method, 403)
        
        return response


# ═══════════════════════════════════════════════════════════════════
# Security Utilities
# ═══════════════════════════════════════════════════════════════════

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token"""
    return secrets.token_urlsafe(length)


def hash_password_for_comparison(password: str, salt: str) -> str:
    """Hash password for comparison (not storage - use bcrypt for storage)"""
    return hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()


def validate_gstin(gstin: str) -> bool:
    """Validate GSTIN format"""
    if not gstin:
        return False
    
    # GSTIN format: 2 digits + 10 alphanumeric + 1 digit + Z + 1 alphanumeric
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    return bool(re.match(pattern, gstin.upper()))


def validate_phone(phone: str) -> bool:
    """Validate Indian phone number"""
    if not phone:
        return False
    
    # Indian mobile: 10 digits starting with 6-9
    pattern = r'^[6-9]\d{9}$'
    cleaned = re.sub(r'[\s\-\+\(\)]', '', phone)
    if cleaned.startswith('91'):
        cleaned = cleaned[2:]
    return bool(re.match(pattern, cleaned))


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
