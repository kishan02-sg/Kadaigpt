"""
KadaiGPT - Role-Based Access Control (RBAC)
Permission checks for API endpoints
"""

from fastapi import HTTPException, status, Depends
from app.models import User, UserRole
from app.routers.auth import get_current_active_user


# Permission levels (higher = more access)
ROLE_LEVELS = {
    UserRole.CASHIER: 1,
    UserRole.MANAGER: 2,
    UserRole.OWNER: 3,
}


def require_role(*allowed_roles: UserRole):
    """
    Dependency that checks if current user has one of the allowed roles.
    
    Usage:
        @router.get("/analytics")
        async def get_analytics(
            current_user: User = Depends(require_role(UserRole.OWNER, UserRole.MANAGER))
        ):
    """
    async def _check_role(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {', '.join(r.value for r in allowed_roles)}"
            )
        return current_user
    return _check_role


def require_min_role(min_role: UserRole):
    """
    Dependency that checks if current user has at least the minimum role level.
    
    Usage:
        @router.delete("/bills/{id}")
        async def delete_bill(
            current_user: User = Depends(require_min_role(UserRole.MANAGER))
        ):
    """
    async def _check_min_role(current_user: User = Depends(get_current_active_user)):
        user_level = ROLE_LEVELS.get(current_user.role, 0)
        required_level = ROLE_LEVELS.get(min_role, 0)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Minimum role required: {min_role.value}"
            )
        return current_user
    return _check_min_role
