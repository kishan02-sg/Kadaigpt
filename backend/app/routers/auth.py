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
from pydantic import BaseModel, EmailStr

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


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """
    Get current user profile
    """
    return current_user


@router.get("/me/store", response_model=StoreResponse)
async def get_my_store(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's store details
    """
    result = await db.execute(select(Store).where(Store.id == current_user.store_id))
    store = result.scalar_one_or_none()
    
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    return store


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

    # Create user with same store as the creator
    user = User(
        store_id=current_user.store_id,
        email=f"{staff_id.lower()}@staff.kadaigpt.local",  # Placeholder email for staff
        password_hash=get_password_hash(temp_password),
        full_name=request.full_name,
        role=valid_roles[request.role.lower()],
        staff_id=staff_id,
        phone=request.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"[Staff] Created {request.role} '{request.full_name}' with ID: {staff_id} by user {current_user.id}")

    return {
        "message": f"Staff account created successfully",
        "staff_id": staff_id,
        "temporary_password": temp_password,
        "role": request.role.lower(),
        "full_name": request.full_name,
        "note": "Share the Staff ID and temporary password with the staff member. They should change their password after first login."
    }


@router.put("/change-password")
async def change_password(
    current_password: str = "",
    new_password: str = "",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change password for the current user"""
    # For staff first login, current_password may be the temp password
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters"
        )

    current_user.password_hash = get_password_hash(new_password)
    await db.commit()

    return {"message": "Password changed successfully", "success": True}


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
