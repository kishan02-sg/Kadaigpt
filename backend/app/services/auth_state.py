"""
KadaiGPT - Persistent auth security state

Replaces the in-memory dicts used for login lockout, password-reset tokens and
OTPs with a DB-backed store, so brute-force protection survives serverless cold
starts (each Vercel invocation may run in a fresh, empty container).

DESIGN RULE: none of these helpers may ever break authentication. If the backing
table is missing or a write fails, we roll back and degrade gracefully (fail-open
for reads, no-op for writes) so login/registration always proceed. Security
tracking is best-effort; availability of auth is not.

All helpers take an AsyncSession and are safe to call within request handlers.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthSecurityState

logger = logging.getLogger("KadaiGPT.AuthState")

KIND_LOCKOUT = "lockout"
KIND_RESET = "reset_token"
KIND_OTP = "otp"


def _utcnow() -> datetime:
    """Timezone-aware UTC now (asyncpg requires aware datetimes for timestamptz)."""
    return datetime.now(timezone.utc)


def _as_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def _safe_rollback(db: AsyncSession) -> None:
    try:
        await db.rollback()
    except Exception:
        pass


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
# Login lockout (fail-open: on any error, treat as not-locked)
# ──────────────────────────────────────────────────────────────

async def get_lockout_seconds_remaining(db: AsyncSession, key: str) -> int:
    """Return remaining lockout seconds for a login key, or 0 if not locked.
    Fail-open: returns 0 on any backend error so login is never blocked by a
    tracking failure."""
    try:
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
            await clear_attempts(db, key)
            return 0
        return remaining
    except Exception as e:
        logger.warning(f"lockout read failed (degrading to unlocked): {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return 0


async def record_failed_attempt(db: AsyncSession, key: str, max_attempts: int,
                                lockout_minutes: int) -> int:
    """Increment failed-attempt count. Locks the key when max is reached.
    Returns the current attempt count. Fail-safe: returns 1 on backend error so
    the caller still rejects the bad credentials without locking out or 500ing."""
    try:
        row = await _get(db, KIND_LOCKOUT, key)
        count = ((row.data or {}).get("count", 0) if row else 0) + 1
        data: Dict[str, Any] = {"count": count, "locked_until": None}
        if count >= max_attempts:
            data["locked_until"] = (datetime.utcnow() + timedelta(minutes=lockout_minutes)).isoformat()
        await _upsert(db, KIND_LOCKOUT, key, data, None)
        return count
    except Exception as e:
        logger.warning(f"lockout write failed (degrading): {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return 1


async def clear_attempts(db: AsyncSession, key: str) -> None:
    try:
        await _delete(db, KIND_LOCKOUT, key)
    except Exception as e:
        logger.warning(f"lockout clear failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)


# ──────────────────────────────────────────────────────────────
# Password reset tokens
# ──────────────────────────────────────────────────────────────

async def store_reset_token(db: AsyncSession, token: str, user_id: int, email: str,
                            expire_minutes: int) -> bool:
    """Persist a reset token. Returns True on success, False on backend error."""
    try:
        expires_at = _utcnow() + timedelta(minutes=expire_minutes)
        await _upsert(db, KIND_RESET, token,
                      {"user_id": user_id, "email": email}, expires_at)
        return True
    except Exception as e:
        logger.warning(f"reset-token store failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return False


async def consume_reset_token(db: AsyncSession, token: str) -> Optional[Dict[str, Any]]:
    """Return token payload if valid & unexpired, else None. Deletes it (one-time use)."""
    try:
        row = await _get(db, KIND_RESET, token)
        if not row:
            return None
        if row.expires_at and datetime.utcnow() > _as_naive(row.expires_at):
            await _delete(db, KIND_RESET, token)
            return None
        payload = dict(row.data or {})
        await _delete(db, KIND_RESET, token)
        return payload
    except Exception as e:
        logger.warning(f"reset-token consume failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return None


# ──────────────────────────────────────────────────────────────
# OTPs (phone-based reset)
# ──────────────────────────────────────────────────────────────

async def store_otp(db: AsyncSession, phone_key: str, otp: str, user_id: int,
                    expire_minutes: int = 5) -> bool:
    try:
        expires_at = _utcnow() + timedelta(minutes=expire_minutes)
        await _upsert(db, KIND_OTP, phone_key,
                      {"otp": otp, "user_id": user_id, "attempts": 0}, expires_at)
        return True
    except Exception as e:
        logger.warning(f"otp store failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return False


async def get_otp(db: AsyncSession, phone_key: str) -> Optional[Dict[str, Any]]:
    try:
        row = await _get(db, KIND_OTP, phone_key)
        if not row:
            return None
        if row.expires_at and datetime.utcnow() > _as_naive(row.expires_at):
            await _delete(db, KIND_OTP, phone_key)
            return None
        return dict(row.data or {})
    except Exception as e:
        logger.warning(f"otp read failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return None


async def increment_otp_attempts(db: AsyncSession, phone_key: str) -> int:
    try:
        row = await _get(db, KIND_OTP, phone_key)
        if not row:
            return 999
        data = dict(row.data or {})
        data["attempts"] = data.get("attempts", 0) + 1
        row.data = data
        await db.commit()
        return data["attempts"]
    except Exception as e:
        logger.warning(f"otp attempt incr failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)
        return 999


async def delete_otp(db: AsyncSession, phone_key: str) -> None:
    try:
        await _delete(db, KIND_OTP, phone_key)
    except Exception as e:
        logger.warning(f"otp delete failed: {type(e).__name__}: {e}")
        await _safe_rollback(db)
