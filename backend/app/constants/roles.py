"""
KadaiGPT — Role & Enum Configuration
Single source of truth for all roles, permissions, and enums.

To add a new role:  add it to UserRole + ROLE_PERMISSIONS.
To add a payment method:  add it to PaymentMethod.
"""

import enum


# ═══════════════════════════════════════════════════════════════
#  ENUMS — used by both models (DB) and schemas (API validation)
# ═══════════════════════════════════════════════════════════════

class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    CASHIER = "CASHIER"
    INVENTORY_MANAGER = "INVENTORY_MANAGER"
    ADMIN = "ADMIN"

    @classmethod
    def _missing_(cls, value):
        """Accept case-insensitive input (e.g., 'owner' -> 'OWNER')"""
        if isinstance(value, str):
            for member in cls:
                if member.value.upper() == value.upper():
                    return member
        return None


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    CREDIT = "CREDIT"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            for member in cls:
                if member.value.upper() == value.upper():
                    return member
        return None


class BillStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"
    # Bill created, UPI QR shown at checkout, money not confirmed yet.
    # Only the Razorpay webhook transitions this to COMPLETED.
    PENDING_PAYMENT = "PENDING_PAYMENT"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            for member in cls:
                if member.value.upper() == value.upper():
                    return member
        return None


class SyncStatus(str, enum.Enum):
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"


class OCRConfidence(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# ═══════════════════════════════════════════════════════════════
#  ROLE PERMISSIONS — what each role can access
# ═══════════════════════════════════════════════════════════════

# Permission levels (higher = more access)
ROLE_LEVELS = {
    UserRole.CASHIER: 1,
    UserRole.INVENTORY_MANAGER: 1,
    UserRole.MANAGER: 2,
    UserRole.OWNER: 3,
}

# What API sections each role can access
ROLE_PERMISSIONS = {
    UserRole.OWNER: {
        "label": "Owner",
        "level": 3,
        "can_manage_staff": True,
        "can_view_analytics": True,
        "can_manage_billing": True,
        "can_manage_inventory": True,
        "can_manage_customers": True,
        "can_manage_settings": True,
    },
    UserRole.MANAGER: {
        "label": "Manager",
        "level": 2,
        "can_manage_staff": True,
        "can_view_analytics": True,
        "can_manage_billing": True,
        "can_manage_inventory": True,
        "can_manage_customers": True,
        "can_manage_settings": False,
    },
    UserRole.CASHIER: {
        "label": "Cashier",
        "level": 1,
        "can_manage_staff": False,
        "can_view_analytics": False,
        "can_manage_billing": True,
        "can_manage_inventory": False,
        "can_manage_customers": True,
        "can_manage_settings": False,
    },
    UserRole.INVENTORY_MANAGER: {
        "label": "Inventory Manager",
        "level": 1,
        "can_manage_staff": False,
        "can_view_analytics": True,
        "can_manage_billing": False,
        "can_manage_inventory": True,
        "can_manage_customers": False,
        "can_manage_settings": False,
    },
}


def get_role_level(role: UserRole) -> int:
    """Get the permission level for a role."""
    return ROLE_LEVELS.get(role, 0)


def get_role_permissions(role: UserRole) -> dict:
    """Get the full permissions dict for a role."""
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS[UserRole.CASHIER])
