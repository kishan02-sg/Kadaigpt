"""
KadaiGPT - Shared pytest fixtures
"""
import sys
import os
import asyncio
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.middleware.security import rate_limiter
from app.database import init_db, engine


@pytest.fixture(scope="session", autouse=True)
def _init_test_database():
    """
    Create all SQLite tables before the test session runs.

    backend/main.py's lifespan calls init_db() (Base.metadata.create_all) on
    ASGI startup, but every test here uses TestClient(app) without `with`, so
    lifespan never fires. On a fresh local.db that leaves zero tables, and
    every DB-touching test fails with "no such table: users" etc.

    init_db() is run via asyncio.run() in its own throwaway event loop, then
    engine.dispose() discards any pooled aiosqlite connections opened in that
    loop so later requests (running in whatever loop TestClient/httpx uses)
    open fresh connections instead of reusing ones bound to a dead loop.
    """
    asyncio.run(init_db())
    asyncio.run(engine.dispose())


@pytest.fixture(autouse=True)
def _reset_global_rate_limiter():
    """
    Reset the global rate_limiter singleton before/after each test.

    TestClient(app) requests all report client_ip == "testclient" (no real
    socket / X-Forwarded-For), so every /auth/* call across the whole pytest
    session hits the same "testclient:auth" bucket on this module-level
    singleton. Without a reset, auth-heavy tests exceed RATE_LIMITS['auth']
    (5/60s) and the 2x-block threshold (10/60s -> 5min block), causing
    cascading 429s in unrelated later tests.

    test_security.py::TestRateLimiter constructs its own standalone
    RateLimiter() instances (not this singleton), so this fixture has no
    effect on those tests.
    """
    rate_limiter.requests.clear()
    rate_limiter.blocked.clear()
    yield
    rate_limiter.requests.clear()
    rate_limiter.blocked.clear()
