"""
KadaiGPT - Platform Admin Shared Dependencies
"""

from app.constants.roles import UserRole
from app.rbac import require_role

# Every /admin/* endpoint except /admin/bootstrap and /admin/login depends on this.
require_admin = require_role(UserRole.ADMIN)
