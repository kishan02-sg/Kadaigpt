"""
KadaiGPT - Authentication Router
User registration, login, session management, password reset & lockout
"""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, Dict
from pydantic import BaseModel, EmailStr, Field

from app.database import get_db
from app.config import settings
from app.models import User, Store, UserRole
from app.utils.password import validate_password_strength
from app.services import auth_state
from app.services.login_history import record_login_event
from app.services.email_service import email_service
from app.services.msg91_service import msg91_service
from app.services.resend_service import resend_service
import os
import hmac
from app.schemas import (
    Token, TokenData, LoginRequest, RegisterRequest, 
    UserResponse, StoreResponse
)


router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
logger = logging.getLogger("KadaiGPT.Auth")

# ═══════════════════════════════════════════
# Account lockout / token config
# State is persisted in the DB via app.services.auth_state so it survives
# serverless cold starts (each Vercel invocation may be a fresh container).
# ═══════════════════════════════════════════
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 5
RESET_TOKEN_EXPIRE_MINUTES = 60


# Password reset request schemas
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


# JWT issuer / audience claims — validated on decode to reject foreign tokens.
JWT_ISSUER = "kadaigpt"
JWT_AUDIENCE = "kadaigpt-app"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token with iat/iss/aud claims for revocation + validation."""
    to_encode = data.copy()

    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    })

    jwt_key = settings.jwt_secret_key
    logger.debug(f"Creating token for user: {data.get('sub')}")

    encoded_jwt = jwt.encode(to_encode, jwt_key, algorithm=settings.jwt_algorithm)

    return encoded_jwt


def _decode_token(token: str) -> dict:
    """Decode & validate a JWT, enforcing iss/aud. Raises JWTError on failure."""
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        audience=JWT_AUDIENCE,
        issuer=JWT_ISSUER,
    )


def _token_revoked(token_iat, tokens_valid_after) -> bool:
    """True if the token was issued before the user's tokens_valid_after cutoff."""
    if not tokens_valid_after:
        return False
    if token_iat is None:
        return True  # legacy token without iat — treat as revoked once cutoff is set
    try:
        issued = datetime.utcfromtimestamp(int(token_iat))
    except (ValueError, TypeError, OSError):
        return True
    cutoff = tokens_valid_after
    if isinstance(cutoff, str):
        try:
            cutoff = datetime.fromisoformat(cutoff.replace(" ", "T", 1))
        except ValueError:
            return True
    if hasattr(cutoff, "tzinfo") and cutoff.tzinfo is not None:
        cutoff = cutoff.replace(tzinfo=None)
    return issued < cutoff


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user from JWT token — uses raw SQL to avoid MissingGreenlet"""
    from sqlalchemy import text
    from types import SimpleNamespace

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = _decode_token(token)
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        try:
            user_id = int(user_id_raw)
        except (ValueError, TypeError):
            raise credentials_exception
    except JWTError as e:
        logger.warning(f"JWT validation failed: {type(e).__name__}")
        raise credentials_exception

    # Raw SQL — avoids ORM lazy loading / MissingGreenlet in serverless
    # LEFT JOIN stores so callers can read current_user.store_name without
    # a separate per-route query (e.g. bulk backup, email templates).
    result = await db.execute(
        text(
            "SELECT u.id, u.email, u.full_name, u.role, u.phone, u.staff_id, u.is_active, "
            "u.store_id, u.password_hash, u.tokens_valid_after, s.name AS store_name, "
            "s.status AS store_status "
            "FROM users u LEFT JOIN stores s ON s.id = u.store_id "
            "WHERE u.id = :uid"
        ),
        {"uid": user_id}
    )
    row = result.mappings().first()

    if row is None:
        logger.warning(f"Token valid but user not found (id: {user_id})")
        raise credentials_exception

    if _token_revoked(payload.get("iat"), row["tokens_valid_after"]):
        logger.info(f"Rejected revoked token for user {user_id}")
        raise credentials_exception

    if not row["is_active"]:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Platform admins (store_id IS NULL) bypass store-suspension entirely.
    if row["store_status"] == "suspended" and str(row["role"]).upper() != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="This store has been suspended. Contact support.")

    # Build a lightweight User-compatible object
    # Convert role string → UserRole enum so RBAC comparisons work
    role_str = str(row["role"]).upper()
    try:
        role_enum = UserRole(role_str)
    except (ValueError, KeyError):
        role_enum = role_str  # fallback to string if unknown role
    
    user = SimpleNamespace(
        id=row["id"],
        email=row["email"],
        full_name=row["full_name"],
        role=role_enum,
        phone=row["phone"],
        staff_id=row.get("staff_id"),
        is_active=row["is_active"],
        store_id=row["store_id"],
        password_hash=row["password_hash"],
        store_name=row.get("store_name"),
    )
    return user


async def get_current_active_user(current_user = Depends(get_current_user)):
    """Ensure current user is active"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


@router.post("/register", response_model=dict)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user and create their store
    """
    # Enforce password policy
    validate_password_strength(request.password)

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if phone already exists
    if request.phone:
        result = await db.execute(select(User).where(User.phone == request.phone))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered"
            )
    
    # Create store first
    store = Store(
        name=request.store_name,
        business_type=request.business_type
    )
    db.add(store)
    await db.flush()  # Get store ID
    
    # Create user as owner
    user = User(
        store_id=store.id,
        email=request.email,
        phone=request.phone,
        password_hash=get_password_hash(request.password),
        full_name=request.full_name,
        role=UserRole.OWNER
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await db.refresh(store)
    
    # Generate token - sub must be a string
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "message": "Registration successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value
        },
        "store": {
            "id": store.id,
            "name": store.name
        }
    }


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password
    """
    email = form_data.username.lower().strip()

    # Check account lockout (persisted — survives serverless cold starts)
    remaining = await auth_state.get_lockout_seconds_remaining(db, email)
    if remaining > 0:
        await record_login_event(
            db, email_or_staff_id=email, success=False, method="password",
            failure_reason="locked", request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked. Try again in {remaining} seconds."
        )

    # Find user by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        attempts = await auth_state.record_failed_attempt(
            db, email, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES
        )
        await record_login_event(
            db, email_or_staff_id=email, success=False, method="password",
            failure_reason="not_found" if not user else "bad_password", request=request,
        )
        if attempts >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes."
            )
        # Generic message — do not leak whether the email exists or attempt counts.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        await record_login_event(
            db, user=user, email_or_staff_id=email, success=False, method="password",
            failure_reason="inactive", request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive"
        )

    # Suspended stores cannot log in (platform ADMIN accounts have no store_id)
    if user.role != UserRole.ADMIN:
        store_result = await db.execute(select(Store.status).where(Store.id == user.store_id))
        if store_result.scalar_one_or_none() == "suspended":
            await record_login_event(
                db, user=user, email_or_staff_id=email, success=False, method="password",
                failure_reason="suspended", request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This store has been suspended. Contact support."
            )

    # Successful login — clear failed attempts
    await auth_state.clear_attempts(db, email)

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    await record_login_event(
        db, user=user, email_or_staff_id=email, success=True, method="password", request=request,
    )

    # Generate token - sub must be a string
    access_token = create_access_token(data={"sub": str(user.id)})

    return Token(access_token=access_token, token_type="bearer")


# NOTE: The main /me endpoint is defined below (uses raw SQL to avoid MissingGreenlet)

@router.get("/me/store")
async def get_my_store(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's store details — raw SQL to avoid MissingGreenlet"""
    from sqlalchemy import text
    try:
        payload = _decode_token(token)
        uid = int(payload.get("sub", 0))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get user's store_id
    user_result = await db.execute(text("SELECT store_id FROM users WHERE id = :uid"), {"uid": uid})
    user_row = user_result.mappings().first()
    if not user_row or not user_row["store_id"]:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store_result = await db.execute(
        text("SELECT id, name, address, phone, gst_number, created_at FROM stores WHERE id = :sid"),
        {"sid": user_row["store_id"]}
    )
    store = store_result.mappings().first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return dict(store)


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Logout — revokes all outstanding tokens for this user by advancing the
    tokens_valid_after cutoff. The client should also discard its token.
    """
    from sqlalchemy import text
    await db.execute(
        text("UPDATE users SET tokens_valid_after = :now WHERE id = :uid"),
        {"now": datetime.utcnow(), "uid": current_user.id},
    )
    await db.commit()
    return {"message": "Logged out successfully"}


# ═══════════════════════════════════════════
# PASSWORD RESET ENDPOINTS
# ═══════════════════════════════════════════

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a password reset token.
    Always returns success (don't reveal if email exists).
    """
    result = await db.execute(select(User).where(User.email == request.email.lower().strip()))
    user = result.scalar_one_or_none()
    
    if user:
        # Generate secure token (persisted — survives serverless cold starts)
        token = secrets.token_urlsafe(32)
        await auth_state.store_reset_token(
            db, token, user.id, user.email, RESET_TOKEN_EXPIRE_MINUTES
        )

        # Email the reset link if SMTP is configured; otherwise log it (dev fallback).
        app_url = os.getenv("APP_URL", "https://kadaigpt-main.vercel.app").rstrip("/")
        reset_link = f"{app_url}/#reset-password?token={token}"
        if email_service.enabled:
            try:
                html = f"""
                <p>Hi {user.full_name or 'there'},</p>
                <p>We received a request to reset your KadaiGPT password.
                This link expires in {RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
                <p><a href="{reset_link}"
                   style="background:#ff6b35;color:#fff;padding:10px 18px;border-radius:8px;
                   text-decoration:none;display:inline-block">Reset Password</a></p>
                <p>Or use this code: <b>{token}</b></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
                """
                await email_service.send_email_async(
                    user.email, "Reset your KadaiGPT password", html
                )
                logger.info(f"[Password Reset] Email sent to {user.email}")
            except Exception as e:
                logger.warning(f"[Password Reset] Email send failed: {type(e).__name__}: {e}")
        else:
            # No SMTP configured — log so it's usable in dev/testing.
            logger.info(f"[Password Reset] (no SMTP) token for {user.email}: {token}")
        # TODO: Send email with reset link
        # await email_service.send_reset_email(user.email, token)
    
    # Always return success (security — don't reveal if email exists)
    return {
        "message": "If an account with that email exists, a password reset link has been sent.",
        "success": True
    }


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using a valid token.
    """
    # Validate password BEFORE consuming the one-time token, so a weak password
    # doesn't burn the user's only reset token.
    validate_password_strength(request.new_password)

    token_data = await auth_state.consume_reset_token(db, request.token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Update password
    result = await db.execute(select(User).where(User.id == token_data['user_id']))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(request.new_password)
    user.tokens_valid_after = datetime.utcnow()  # revoke existing sessions
    await db.commit()

    # Clear any lockout for this account
    await auth_state.clear_attempts(db, user.email)

    logger.info(f"[Password Reset] Password reset successful for {user.email}")
    
    return {
        "message": "Password reset successfully. You can now login with your new password.",
        "success": True
    }



# ═══════════════════════════════════════════
# USER PROFILE ENDPOINT
# ═══════════════════════════════════════════


@router.get("/me")
async def get_current_user_profile(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile — uses raw SQL to avoid MissingGreenlet on Vercel"""
    from sqlalchemy import text

    # Decode JWT directly (bypasses ORM-based get_current_user which causes MissingGreenlet for staff)
    try:
        payload = _decode_token(token)
        uid = int(payload.get("sub", 0))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get user data via raw SQL
    user_result = await db.execute(
        text(
            "SELECT u.id, u.email, u.full_name, u.role, u.phone, u.staff_id, u.is_active, "
            "u.store_id, u.language, u.theme, u.last_login, u.created_at, u.tokens_valid_after, "
            "s.status AS store_status "
            "FROM users u LEFT JOIN stores s ON s.id = u.store_id "
            "WHERE u.id = :uid"
        ),
        {"uid": uid}
    )
    user_row = user_result.mappings().first()

    if not user_row:
        raise HTTPException(status_code=401, detail="User not found")

    if _token_revoked(payload.get("iat"), user_row["tokens_valid_after"]):
        raise HTTPException(status_code=401, detail="Token has been revoked. Please log in again.")

    if not user_row["is_active"]:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Platform admins (store_id IS NULL) bypass store-suspension entirely.
    if user_row["store_status"] == "suspended" and str(user_row["role"]).upper() != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="This store has been suspended. Contact support.")

    # Get store data
    store_data = None
    if user_row["store_id"]:
        store_result = await db.execute(
            text("SELECT id, name, address, phone, gst_number FROM stores WHERE id = :sid"),
            {"sid": user_row["store_id"]}
        )
        store_row = store_result.mappings().first()
        if store_row:
            store_data = dict(store_row)

    return {
        "id": user_row["id"],
        "email": user_row["email"],
        "full_name": user_row["full_name"],
        "role": str(user_row["role"]),
        "phone": user_row["phone"],
        "staff_id": user_row["staff_id"],
        "is_active": user_row["is_active"],
        "store_id": user_row["store_id"],
        "language": user_row.get("language", "en"),
        "theme": user_row.get("theme", "dark"),
        "last_login": str(user_row["last_login"]) if user_row["last_login"] else None,
        "created_at": str(user_row["created_at"]) if user_row["created_at"] else None,
        "store": store_data
    }


class ProfileUpdate(BaseModel):
    """Editable profile fields (phone is what the WhatsApp bot matches on)."""
    full_name: Optional[str] = None
    phone: Optional[str] = None


@router.put("/me", response_model=dict)
async def update_current_user_profile(
    payload: ProfileUpdate,
    token: str = Depends(oauth2_scheme),
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile (full_name / phone)."""
    from sqlalchemy import text

    result = await db.execute(text("SELECT id, phone FROM users WHERE id = :uid"), {"uid": current_user.id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if payload.full_name is not None:
        name = payload.full_name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        updates["full_name"] = name

    if payload.phone is not None:
        phone = payload.phone.strip() or None
        if phone:
            existing = await db.execute(
                text("SELECT id FROM users WHERE phone = :p AND id != :uid"),
                {"p": phone, "uid": current_user.id},
            )
            if existing.mappings().first():
                raise HTTPException(
                    status_code=400,
                    detail="Phone number already registered to another user",
                )
        updates["phone"] = phone

    if not updates:
        return await get_current_user_profile(token=token, db=db)

    sets = ", ".join(f"{k} = :{k}" for k in updates)
    await db.execute(text(f"UPDATE users SET {sets} WHERE id = :uid"), {**updates, "uid": current_user.id})
    await db.commit()
    return await get_current_user_profile(token=token, db=db)


# ═══════════════════════════════════════════
# STAFF LOGIN & MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════

class StaffLoginRequest(BaseModel):
    staff_id: str
    password: str


class CreateStaffRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    role: str = Field(..., description="manager, cashier, or inventory_manager")
    phone: Optional[str] = None


def generate_staff_id() -> str:
    """Generate a unique staff ID like KDG-4821"""
    import random
    return f"KDG-{random.randint(1000, 9999)}"


@router.post("/staff-login", response_model=Token)
async def staff_login(
    http_request: Request,
    request: StaffLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with Staff ID and password (for Manager, Cashier, Inventory Manager)
    """
    staff_id = request.staff_id.upper().strip()

    # Check account lockout (persisted — survives serverless cold starts)
    remaining = await auth_state.get_lockout_seconds_remaining(db, staff_id)
    if remaining > 0:
        await record_login_event(
            db, email_or_staff_id=staff_id, success=False, method="staff_id",
            failure_reason="locked", request=http_request,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked. Try again in {remaining} seconds."
        )

    # Find user by staff_id
    result = await db.execute(select(User).where(User.staff_id == staff_id))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        attempts = await auth_state.record_failed_attempt(
            db, staff_id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES
        )
        await record_login_event(
            db, email_or_staff_id=staff_id, success=False, method="staff_id",
            failure_reason="not_found" if not user else "bad_password", request=http_request,
        )
        if attempts >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Staff ID or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        await record_login_event(
            db, user=user, email_or_staff_id=staff_id, success=False, method="staff_id",
            failure_reason="inactive", request=http_request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Contact your manager."
        )

    # Suspended stores cannot log in
    store_result = await db.execute(select(Store.status).where(Store.id == user.store_id))
    if store_result.scalar_one_or_none() == "suspended":
        await record_login_event(
            db, user=user, email_or_staff_id=staff_id, success=False, method="staff_id",
            failure_reason="suspended", request=http_request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This store has been suspended. Contact support."
        )

    # Successful login — clear failed attempts
    await auth_state.clear_attempts(db, staff_id)

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    await record_login_event(
        db, user=user, email_or_staff_id=staff_id, success=True, method="staff_id", request=http_request,
    )

    # Generate token
    access_token = create_access_token(data={"sub": str(user.id)})

    return Token(access_token=access_token, token_type="bearer")


@router.post("/create-staff", response_model=dict)
async def create_staff(
    request: CreateStaffRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new staff member (Owner or Manager only).
    Generates a unique Staff ID for them to login with.
    Staff sets their own password on first login.
    """
    # Only owner or manager can create staff
    if current_user.role not in (UserRole.OWNER, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owner or Manager can create staff accounts"
        )

    # Validate role
    valid_roles = {"manager": UserRole.MANAGER, "cashier": UserRole.CASHIER, "inventory_manager": UserRole.INVENTORY_MANAGER}
    if request.role.lower() not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles.keys())}"
        )

    # Manager cannot create other managers
    if current_user.role == UserRole.MANAGER and request.role.lower() == "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managers cannot create other manager accounts. Only the owner can."
        )

    # Generate unique staff ID (retry if collision)
    for _ in range(10):
        staff_id = generate_staff_id()
        existing = await db.execute(select(User).where(User.staff_id == staff_id))
        if not existing.scalar_one_or_none():
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate unique staff ID. Please try again."
        )

    # Create a temporary password (staff will change on first login)
    temp_password = f"kadai{secrets.token_hex(3)}"

    # Clean phone — treat empty string as None
    phone = request.phone.strip() if request.phone else None
    if phone == '':
        phone = None

    # Check if phone already exists
    if phone:
        existing_phone = await db.execute(select(User).where(User.phone == phone))
        if existing_phone.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phone number {phone} is already registered to another user"
            )

    # Create user with same store as the creator
    try:
        user = User(
            store_id=current_user.store_id,
            email=f"{staff_id.lower()}@staff.kadaigpt.local",  # Placeholder email for staff
            password_hash=get_password_hash(temp_password),
            full_name=request.full_name,
            role=valid_roles[request.role.lower()],
            staff_id=staff_id,
            phone=phone,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except Exception as e:
        await db.rollback()
        error_msg = str(e).lower()
        logger.error(f"[Staff] Creation failed: {e}")
        if 'unique' in error_msg or 'duplicate' in error_msg:
            if 'phone' in error_msg:
                raise HTTPException(status_code=400, detail="This phone number is already registered")
            elif 'email' in error_msg:
                raise HTTPException(status_code=400, detail="Staff ID collision. Please try again.")
            else:
                raise HTTPException(status_code=400, detail=f"Duplicate entry error: {str(e)[:100]}")
        raise HTTPException(status_code=500, detail=f"Failed to create staff: {str(e)[:150]}")

    logger.info(f"[Staff] Created {request.role} '{request.full_name}' with ID: {staff_id} by user {current_user.id}")

    return {
        "message": f"Staff account created successfully",
        "staff_id": staff_id,
        "temporary_password": temp_password,
        "role": request.role.lower(),
        "full_name": request.full_name,
        "note": "Share the Staff ID and temporary password with the staff member. They should change their password after first login."
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


@router.put("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change password for the current user"""
    from sqlalchemy import text

    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    validate_password_strength(request.new_password)

    new_hash = get_password_hash(request.new_password)
    # Also revoke existing tokens so a changed password invalidates old sessions.
    await db.execute(
        text("UPDATE users SET password_hash = :pw, tokens_valid_after = :now WHERE id = :uid"),
        {"pw": new_hash, "now": datetime.utcnow(), "uid": current_user.id}
    )
    await db.commit()

    return {"message": "Password changed successfully. Please log in again.", "success": True}


# ═══════════════════════════════════════════
# OTP-BASED FORGOT PASSWORD (Phone-based)
# OTP state is persisted via app.services.auth_state (DB-backed).
# ═══════════════════════════════════════════


class ForgotPasswordPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10)


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10)
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


# Generic response so the endpoint never reveals whether a phone is registered.
_OTP_GENERIC_RESPONSE = {
    "message": "If an account with that phone number exists, an OTP has been sent.",
    "success": True,
    "expires_in": "5 minutes",
}


@router.post("/forgot-password-phone")
async def forgot_password_phone(
    request: ForgotPasswordPhoneRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send OTP to phone for password reset.

    Security:
      - Always returns the SAME generic response (no account-existence enumeration).
      - The OTP is NEVER returned in the response — it is delivered via SMS gateway.
        Until a gateway is configured it is only logged server-side.
    """
    phone = request.phone.strip().replace(" ", "")
    # Support with or without country code
    phone_variants = [phone, f"+91{phone}", phone[-10:] if len(phone) > 10 else phone]

    user = None
    for pv in phone_variants:
        result = await db.execute(select(User).where(User.phone == pv))
        user = result.scalar_one_or_none()
        if user:
            break

    # Only generate/store an OTP when the account exists — but the response is
    # identical either way so callers cannot distinguish.
    if user:
        otp = f"{secrets.randbelow(1_000_000):06d}"  # 6-digit, cryptographically secure
        await auth_state.store_otp(db, phone[-10:], otp, user.id, expire_minutes=5)
        # TODO: send via SMS gateway (MSG91 / Twilio). Never return the OTP to the client.
        logger.info(f"[OTP] Generated OTP for phone ending {phone[-4:]}: {otp}")

    return dict(_OTP_GENERIC_RESPONSE)


@router.post("/verify-otp-reset")
async def verify_otp_reset(
    request: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify OTP and reset password"""
    # Validate password first so a weak password doesn't burn an OTP attempt.
    validate_password_strength(request.new_password)

    phone_key = request.phone[-10:]

    stored = await auth_state.get_otp(db, phone_key)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid OTP for this number. Please request a new OTP."
        )

    # Check attempts (persisted)
    attempts = await auth_state.increment_otp_attempts(db, phone_key)
    if attempts > 5:
        await auth_state.delete_otp(db, phone_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new OTP."
        )

    # Verify OTP (constant-time compare)
    import hmac
    if not hmac.compare_digest(str(stored["otp"]), request.otp.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. Please try again."
        )

    # OTP correct — update password
    result = await db.execute(select(User).where(User.id == stored["user_id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(request.new_password)
    user.tokens_valid_after = datetime.utcnow()  # revoke existing sessions
    await db.commit()

    # Clean up OTP
    await auth_state.delete_otp(db, phone_key)

    return {"message": "Password reset successfully. You can now login with your new password.", "success": True}


# ═══════════════════════════════════════════
# EMAIL-OTP FORGOT PASSWORD
# Delivery: MSG91 (if configured) → SMTP → log. OTP is generated/verified here.
# ═══════════════════════════════════════════

EMAIL_OTP_EXPIRE_MINUTES = 10
EMAIL_OTP_MAX_ATTEMPTS = 5


class ForgotPasswordEmailRequest(BaseModel):
    email: EmailStr


class VerifyEmailOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


def _otp_email_html(otp: str, name: str = "") -> str:
    return f"""
    <p>Hi {name or 'there'},</p>
    <p>Your KadaiGPT verification code is:</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:6px">{otp}</p>
    <p>This code expires in {EMAIL_OTP_EXPIRE_MINUTES} minutes. If you didn't
    request it, you can ignore this email.</p>
    """


async def _deliver_otp_email(to_email: str, otp: str, name: str = "") -> None:
    """Best-effort OTP delivery, trying whichever provider is configured:
    Resend → MSG91 → SMTP (Brevo/SendGrid/Resend/Gmail) → log (dev)."""
    subject = "Your KadaiGPT verification code"

    # 1) Resend (simplest dev-friendly API)
    if resend_service.enabled and await resend_service.send_email(to_email, subject, _otp_email_html(otp, name)):
        return

    # 2) MSG91 (template-based)
    if msg91_service.enabled and await msg91_service.send_email_otp(to_email, otp, name):
        return

    # 3) Generic SMTP — works with Brevo / SendGrid / Resend / Gmail credentials
    if email_service.enabled:
        try:
            if await email_service.send_email_async(to_email, subject, _otp_email_html(otp, name)):
                return
        except Exception as e:
            logger.warning(f"[Email OTP] SMTP send failed: {type(e).__name__}: {e}")

    # 4) Nothing configured — log so it's usable in dev/testing.
    logger.info(f"[Email OTP] (not delivered — configure Resend/MSG91/SMTP) {to_email}: {otp}")


@router.post("/forgot-password-email-otp")
async def forgot_password_email_otp(
    request: ForgotPasswordEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a 6-digit OTP to the user's email for password reset.
    Always returns the same generic response (no account enumeration)."""
    email = request.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        otp = f"{secrets.randbelow(1_000_000):06d}"
        await auth_state.store_otp(db, f"email:{email}", otp, user.id, EMAIL_OTP_EXPIRE_MINUTES)
        await _deliver_otp_email(email, otp, user.full_name)

    return {
        "message": "If an account with that email exists, a verification code has been sent.",
        "success": True,
        "expires_in": f"{EMAIL_OTP_EXPIRE_MINUTES} minutes",
    }


@router.post("/verify-email-otp-reset")
async def verify_email_otp_reset(
    request: VerifyEmailOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify the email OTP and set a new password."""
    validate_password_strength(request.new_password)

    email = request.email.lower().strip()
    key = f"email:{email}"

    stored = await auth_state.get_otp(db, key)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid code for this email. Please request a new one.",
        )

    attempts = await auth_state.increment_otp_attempts(db, key)
    if attempts > EMAIL_OTP_MAX_ATTEMPTS:
        await auth_state.delete_otp(db, key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new code.",
        )

    if not hmac.compare_digest(str(stored["otp"]), request.otp.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code. Please try again.",
        )

    result = await db.execute(select(User).where(User.id == stored["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(request.new_password)
    user.tokens_valid_after = datetime.utcnow()  # revoke existing sessions
    await db.commit()

    await auth_state.delete_otp(db, key)
    await auth_state.clear_attempts(db, email)

    return {"message": "Password reset successfully. You can now login with your new password.", "success": True}


@router.get("/staff/list", response_model=list)
async def list_staff(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all staff in the current user's store (Owner/Manager only)"""
    if current_user.role not in (UserRole.OWNER, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owner or Manager can view staff list"
        )

    result = await db.execute(
        select(User).where(
            User.store_id == current_user.store_id,
            User.id != current_user.id
        )
    )
    staff = result.scalars().all()

    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "role": s.role.value if s.role else "cashier",
            "staff_id": s.staff_id,
            "phone": s.phone,
            "is_active": s.is_active,
            "last_login": s.last_login.isoformat() if s.last_login else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in staff
    ]


@router.delete("/staff/{staff_user_id}")
async def deactivate_staff(
    staff_user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate a staff member (Owner/Manager only)"""
    if current_user.role not in (UserRole.OWNER, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owner or Manager can manage staff"
        )

    result = await db.execute(
        select(User).where(
            User.id == staff_user_id,
            User.store_id == current_user.store_id
        )
    )
    staff = result.scalar_one_or_none()

    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    staff.is_active = not staff.is_active
    await db.commit()

    status_text = "activated" if staff.is_active else "deactivated"
    return {"message": f"Staff member {status_text} successfully", "is_active": staff.is_active}
