"""
KadaiGPT - Create Platform Admin Account (local dev)

Usage (from backend/, with PYTHONIOENCODING=utf-8 set on Windows):
    DATABASE_URL=sqlite+aiosqlite:///./local.db python scripts/create_admin.py <email> <password> <full name>

Creates a UserRole.ADMIN user with store_id=NULL. Production has no shell
access — use POST /api/v1/admin/bootstrap (X-Bootstrap-Secret) instead.

NOTE: SQLite cannot drop the NOT NULL constraint on an existing users.store_id
column via ALTER TABLE. If you have a pre-existing local.db created before this
column became nullable, delete it (or use a fresh DB file) so init_db() recreates
the schema with store_id nullable.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.database import async_session_maker, init_db  # noqa: E402
from app.models import User  # noqa: E402
from app.constants.roles import UserRole  # noqa: E402
from app.routers.auth import get_password_hash  # noqa: E402
from app.utils.password import validate_password_strength  # noqa: E402


async def main(email: str, password: str, full_name: str) -> None:
    validate_password_strength(password)
    email = email.lower().strip()

    await init_db()

    async with async_session_maker() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            print(f"Error: a user with email {email} already exists.")
            return

        user = User(
            store_id=None,
            email=email,
            full_name=full_name,
            password_hash=get_password_hash(password),
            role=UserRole.ADMIN,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    print(f"Created ADMIN account: {email} (id={user.id})")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python scripts/create_admin.py <email> <password> <full name>")
        sys.exit(1)

    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
