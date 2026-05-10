"""
KadaiGPT - Authentication Router
User registration, login, session management, password reset & lockout
"""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
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
# Account lockout tracking (in-memory)
# ═══════════════════════════════════════════
_failed_attempts: Dict[str, dict] = {}  # email -> {count, locked_until}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 5

# Password reset tokens (in-memory — production should use DB/Redis)
_reset_tokens: Dict[str, dict] = {}  # token -> {email, expires_at}
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


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    
    jwt_key = settings.jwt_secret_key
    logger.debug(f"Creating token for user: {data.get('sub')}")
    
    encoded_jwt = jwt.encode(to_encode, jwt_key, algorithm=settings.jwt_algorithm)
    
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    from sqlalchemy import text

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        jwt_key = settings.jwt_secret_key
        payload = jwt.decode(token, jwt_key, algorithms=[settings.jwt_algorithm])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        # Handle both string and int user_id
        try:
            user_id = int(user_id_raw)
        except (ValueError, TypeError):
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
    except JWTError as e:
        logger.warning(f"JWT validation failed: {type(e).__name__}")
        raise credentials_exception
    
    # Simple ORM query - no load_only to avoid deferred loading issues
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        logger.warning(f"Token valid but user not found (id: {token_data.user_id})")
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
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
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password
    """
    email = form_data.username.lower().strip()
    
    # Check account lockout
    lockout = _failed_attempts.get(email)
    if lockout and lockout.get('locked_until'):
        if datetime.utcnow() < lockout['locked_until']:
            remaining = int((lockout['locked_until'] - datetime.utcnow()).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked. Try again in {remaining} seconds."
            )
        else:
            # Lockout expired, reset
            _failed_attempts.pop(email, None)
    
    # Find user by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        # Track failed attempt
        if email not in _failed_attempts:
            _failed_attempts[email] = {'count': 0, 'locked_until': None}
        _failed_attempts[email]['count'] += 1
        attempts = _failed_attempts[email]['count']
        
        if attempts >= MAX_LOGIN_ATTEMPTS:
            _failed_attempts[email]['locked_until'] = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes."
            )
        
        remaining = MAX_LOGIN_ATTEMPTS - attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect email or password. {remaining} attempt(s) remaining.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive"
        )
    
    # Successful login — clear failed attempts
    _failed_attempts.pop(email, None)
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
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
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
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
async def logout(current_user: User = Depends(get_current_active_user)):
    """
    Logout (client should discard token)
    """
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
        # Generate secure token
        token = secrets.token_urlsafe(32)
        _reset_tokens[token] = {
            'email': user.email,
            'user_id': user.id,
            'expires_at': datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
        }
        
        # Log token for now (production: send via email)
        logger.info(f"[Password Reset] Token for {user.email}: {token}")
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
    token_data = _reset_tokens.get(request.token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    if datetime.utcnow() > token_data['expires_at']:
        _reset_tokens.pop(request.token, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )
    
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
    
    # Update password
    result = await db.execute(select(User).where(User.id == token_data['user_id']))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.password_hash = get_password_hash(request.new_password)
    await db.commit()
    
    # Invalidate the token (one-time use)
    _reset_tokens.pop(request.token, None)
    
    # Clear any lockout
    _failed_attempts.pop(user.email, None)
    
    logger.info(f"[Password Reset] Password reset successful for {user.email}")
    
    return {
        "message": "Password reset successfully. You can now login with your new password.",
        "success": True
    }



# ═══════════════════════════════════════════
# USER PROFILE ENDPOINT
# ═══════════════════════════════════════════

@router.get("/me-debug")
async def debug_me(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint - raw SQL only, no ORM dependencies"""
    from sqlalchemy import text
    import traceback
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        uid = int(payload.get("sub", 0))
        result = await db.execute(
            text("SELECT id, email, full_name, role, phone, staff_id, is_active, store_id FROM users WHERE id = :uid"),
            {"uid": uid}
        )
        row = result.mappings().first()
        if not row:
            return {"error": "user_not_found", "uid": uid}
        return {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "role": str(row["role"]),
            "phone": row["phone"],
            "staff_id": row["staff_id"],
            "is_active": row["is_active"],
            "store_id": row["store_id"],
        }
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/me")
async def get_current_user_profile(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile — uses raw SQL to avoid MissingGreenlet on Vercel"""
    from sqlalchemy import text

    # Decode JWT directly (bypasses ORM-based get_current_user which causes MissingGreenlet for staff)
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        uid = int(payload.get("sub", 0))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get user data via raw SQL
    user_result = await db.execute(
        text("SELECT id, email, full_name, role, phone, staff_id, is_active, store_id, language, theme, last_login, created_at FROM users WHERE id = :uid"),
        {"uid": uid}
    )
    user_row = user_result.mappings().first()

    if not user_row:
        raise HTTPException(status_code=401, detail="User not found")

    if not user_row["is_active"]:
        raise HTTPException(status_code=400, detail="Inactive user")

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
    request: StaffLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with Staff ID and password (for Manager, Cashier, Inventory Manager)
    """
    staff_id = request.staff_id.upper().strip()

    # Check account lockout
    lockout = _failed_attempts.get(staff_id)
    if lockout and lockout.get('locked_until'):
        if datetime.utcnow() < lockout['locked_until']:
            remaining = int((lockout['locked_until'] - datetime.utcnow()).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked. Try again in {remaining} seconds."
            )
        else:
            _failed_attempts.pop(staff_id, None)

    # Find user by staff_id
    result = await db.execute(select(User).where(User.staff_id == staff_id))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        # Track failed attempt
        if staff_id not in _failed_attempts:
            _failed_attempts[staff_id] = {'count': 0, 'locked_until': None}
        _failed_attempts[staff_id]['count'] += 1
        attempts = _failed_attempts[staff_id]['count']

        if attempts >= MAX_LOGIN_ATTEMPTS:
            _failed_attempts[staff_id]['locked_until'] = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes."
            )

        remaining = MAX_LOGIN_ATTEMPTS - attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Staff ID or password. {remaining} attempt(s) remaining.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Contact your manager."
        )

    # Successful login — clear failed attempts
    _failed_attempts.pop(staff_id, None)

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

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

    new_hash = get_password_hash(request.new_password)
    await db.execute(
        text("UPDATE users SET password_hash = :pw WHERE id = :uid"),
        {"pw": new_hash, "uid": current_user.id}
    )
    await db.commit()

    return {"message": "Password changed successfully", "success": True}


# ═══════════════════════════════════════════
# OTP-BASED FORGOT PASSWORD (Phone-based)
# ═══════════════════════════════════════════

# In-memory OTP store (for serverless — in production use Redis/DB)
_otp_store: Dict[str, dict] = {}


class ForgotPasswordPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10)


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10)
    otp: str = Field(..., min_length=4, max_length=6)
    new_password: str = Field(..., min_length=6)


@router.post("/forgot-password-phone")
async def forgot_password_phone(
    request: ForgotPasswordPhoneRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send OTP to phone for password reset.
    For now, returns OTP in response (in production, integrate SMS gateway like Twilio/MSG91).
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

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this phone number"
        )

    # Generate 4-digit OTP
    import random
    otp = str(random.randint(1000, 9999))

    # Store OTP with expiry (5 minutes)
    _otp_store[phone[-10:]] = {
        "otp": otp,
        "user_id": user.id,
        "expires": datetime.utcnow() + timedelta(minutes=5),
        "attempts": 0
    }

    logger.info(f"[OTP] Generated OTP for phone {phone[-4:]}: {otp}")

    # In production, send via SMS gateway (MSG91, Twilio, etc.)
    # For now, return OTP in response for testing
    return {
        "message": "OTP sent to your phone number",
        "otp_preview": otp,  # REMOVE IN PRODUCTION — only for testing
        "expires_in": "5 minutes",
        "phone_last4": phone[-4:]
    }


@router.post("/verify-otp-reset")
async def verify_otp_reset(
    request: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify OTP and reset password"""
    phone_key = request.phone[-10:]

    if phone_key not in _otp_store:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP was requested for this number. Please request a new OTP."
        )

    stored = _otp_store[phone_key]

    # Check expiry
    if datetime.utcnow() > stored["expires"]:
        del _otp_store[phone_key]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )

    # Check attempts
    stored["attempts"] += 1
    if stored["attempts"] > 5:
        del _otp_store[phone_key]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please request a new OTP."
        )

    # Verify OTP
    if stored["otp"] != request.otp.strip():
        remaining = 5 - stored["attempts"]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining."
        )

    # OTP correct — update password
    result = await db.execute(select(User).where(User.id == stored["user_id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = get_password_hash(request.new_password)
    await db.commit()

    # Clean up OTP
    del _otp_store[phone_key]

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
