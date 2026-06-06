"""
KadaiGPT - Persistent auth security state

Replaces the in-memory dicts used for login lockout, password-reset tokens and
OTPs with a DB-backed store, so brute-force protection survives serverless cold
starts (each Vercel invocation may run in a fresh, empty container).

All helpers take an AsyncSession and are safe to call within request handlers.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthSecurityState

KIND_LOCKOUT = "lockout"
KIND_RESET = "reset_token"
KIND_OTP = "otp"


async def _get(db: AsyncSession, kind: str, key: str) -> Optional[AuthSecurityState]:
    result = await db.execute(
        select(AuthSecurityState).where(
            AuthSecurityState.kind == kind,
            AuthSecurityState.key == key,
        )
    )
    return result.scalar_one_or_none()


async def _upsert(db: AsyncSession, kind: str, key: str, data: Dict[str, Any],
                  expires_at: Optional[datetime]) -> None:
    row = await _get(db, kind, key)
    if row is None:
        row = AuthSecurityState(kind=kind, key=key, data=data, expires_at=expires_at)
        db.add(row)
    else:
        row.data = data
        row.expires_at = expires_at
    await db.commit()


async def _delete(db: AsyncSession, kind: str, key: str) -> None:
    await db.execute(
        delete(AuthSecurityState).where(
            AuthSecurityState.kind == kind,
            AuthSecurityState.key == key,
        )
    )
    await db.commit()


# ──────────────────────────────────────────────────────────────
# Login lockout
# ──────────────────────────────────────────────────────────────

async def get_lockout_seconds_remaining(db: AsyncSession, key: str) -> int:
    """Return remaining lockout seconds for a login key, or 0 if not locked."""
    row = await _get(db, KIND_LOCKOUT, key)
    if not row:
        return 0
    locked_until = (row.data or {}).get("locked_until")
    if not locked_until:
        return 0
    try:
        until = datetime.fromisoformat(locked_until)
    except (ValueError, TypeError):
        return 0
    remaining = int((until - datetime.utcnow()).total_seconds())
    if remaining <= 0:
        await _delete(db, KIND_LOCKOUT, key)
        return 0
    return remaining


async def record_failed_attempt(db: AsyncSession, key: str, max_attempts: int,
                                lockout_minutes: int) -> int:
    """Increment failed-attempt count. Locks the key when max is reached.
    Returns the current attempt count.
    """
    row = await _get(db, KIND_LOCKOUT, key)
    count = ((row.data or {}).get("count", 0) if row else 0) + 1
    data: Dict[str, Any] = {"count": count, "locked_until": None}
    if count >= max_attempts:
        data["locked_until"] = (datetime.utcnow() + timedelta(minutes=lockout_minutes)).isoformat()
    await _upsert(db, KIND_LOCKOUT, key, data, None)
    return count


async def clear_attempts(db: AsyncSession, key: str) -> None:
    await _delete(db, KIND_LOCKOUT, key)


# ──────────────────────────────────────────────────────────────
# Password reset tokens
# ──────────────────────────────────────────────────────────────

async def store_reset_token(db: AsyncSession, token: str, user_id: int, email: str,
                            expire_minutes: int) -> None:
    expires_at = datetime.utcnow() + timedelta(minutes=expire_minutes)
    await _upsert(db, KIND_RESET, token,
                  {"user_id": user_id, "email": email}, expires_at)


async def consume_reset_token(db: AsyncSession, token: str) -> Optional[Dict[str, Any]]:
    """Return token payload if valid & unexpired, else None. Deletes it (one-time use)."""
    row = await _get(db, KIND_RESET, token)
    if not row:
        return None
    if row.expires_at and datetime.utcnow() > row.expires_at.replace(tzinfo=None):
        await _delete(db, KIND_RESET, token)
        return None
    payload = dict(row.data or {})
    await _delete(db, KIND_RESET, token)
    return payload


# ──────────────────────────────────────────────────────────────
# OTPs (phone-based reset)
# ──────────────────────────────────────────────────────────────

async def store_otp(db: AsyncSession, phone_key: str, otp: str, user_id: int,
                    expire_minutes: int = 5) -> None:
    expires_at = datetime.utcnow() + timedelta(minutes=expire_minutes)
    await _upsert(db, KIND_OTP, phone_key,
                  {"otp": otp, "user_id": user_id, "attempts": 0}, expires_at)


async def get_otp(db: AsyncSession, phone_key: str) -> Optional[Dict[str, Any]]:
    row = await _get(db, KIND_OTP, phone_key)
    if not row:
        return None
    if row.expires_at and datetime.utcnow() > row.expires_at.replace(tzinfo=None):
        await _delete(db, KIND_OTP, phone_key)
        return None
    return dict(row.data or {})


async def increment_otp_attempts(db: AsyncSession, phone_key: str) -> int:
    row = await _get(db, KIND_OTP, phone_key)
    if not row:
        return 999
    data = dict(row.data or {})
    data["attempts"] = data.get("attempts", 0) + 1
    row.data = data
    await db.commit()
    return data["attempts"]


async def delete_otp(db: AsyncSession, phone_key: str) -> None:
    await _delete(db, KIND_OTP, phone_key)
