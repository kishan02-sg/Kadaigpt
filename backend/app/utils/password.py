"""
KadaiGPT - Password strength policy
Shared validator used by register / reset / change-password flows.
"""

import re
from fastapi import HTTPException, status

MIN_PASSWORD_LENGTH = 8

# A small list of obviously weak passwords to reject outright.
_COMMON_PASSWORDS = {
    "password", "password1", "12345678", "123456789", "qwerty123",
    "admin123", "kadaigpt", "letmein1", "welcome1", "iloveyou",
}


def validate_password_strength(password: str) -> str:
    """Validate a password against the policy. Returns it unchanged if valid,
    otherwise raises HTTP 400 with a clear message.

    Policy: >= 8 chars, at least one letter and one digit, not a common password.
    """
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.",
        )
    if password.lower() in _COMMON_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password is too common. Please choose a stronger one.",
        )
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter.",
        )
    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number.",
        )
    return password
