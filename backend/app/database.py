"""
KadaiGPT - Database Configuration
Async SQLAlchemy setup with PostgreSQL (Production) or SQLite (local dev)

Production-grade connection pooling, health checks, and index management.
Serverless-compatible: uses NullPool on Vercel to avoid connection leaks.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from sqlalchemy import text, Index, event
from app.config import settings
import logging
import os
import time

logger = logging.getLogger(__name__)

# Get the async-compatible database URL
db_url = settings.get_async_database_url()
is_sqlite = db_url.startswith("sqlite")
is_serverless = settings.is_serverless

# Resolve database hostname to IPv4 address to prevent "[Errno 99] Cannot assign requested address" on Vercel
if not is_sqlite and is_serverless:
    try:
        import socket
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(db_url)
        if parsed.hostname and not parsed.hostname.replace('.', '').isdigit():
            port = parsed.port or 5432
            addrinfo = socket.getaddrinfo(parsed.hostname, port, family=socket.AF_INET, proto=socket.IPPROTO_TCP)
            if addrinfo:
                ipv4_ip = addrinfo[0][4][0]
                netloc = f"{parsed.username}:{parsed.password}@{ipv4_ip}:{port}"
                parsed = parsed._replace(netloc=netloc)
                db_url = urlunparse(parsed)
                logger.info(f"[Database] Resolved hostname to IPv4 address: {ipv4_ip}")
    except Exception as e:
        logger.warning(f"[Database] Failed to resolve hostname to IPv4 address: {e}")


# asyncpg does NOT support 'sslmode' as a URL parameter (that's psycopg2-only)
# Strip it from the URL and handle SSL via connect_args instead
_needs_ssl = False
if "sslmode=" in db_url:
    _needs_ssl = True
    # Remove sslmode=require (or any sslmode value) from URL
    import re
    db_url = re.sub(r'[?&]sslmode=[^&]*', '', db_url)
    # Clean up trailing ? or &&
    db_url = db_url.rstrip('?').replace('&&', '&').rstrip('&')

# Also detect Supabase/Neon domains that always need SSL
if any(domain in db_url for domain in ["supabase.com", "supabase.co", "neon.tech"]):
    _needs_ssl = True

# Log connection target (hide credentials)
if "@" in db_url:
    log_url = db_url.split("@")[-1]
else:
    log_url = "SQLite (local)"
logger.info(f"[Database] Connecting to: {log_url}")
logger.info(f"[Database] Serverless mode: {is_serverless}")

# Engine configuration differs between SQLite, serverless PostgreSQL, and server PostgreSQL
engine_kwargs = {
    "echo": settings.debug,
    "future": True,
}

if not is_sqlite:
    if is_serverless:
        # Serverless (Vercel): Use a SMALL pool instead of NullPool
        # Warm instances reuse the same Python process, so keeping 1 connection
        # alive avoids the ~3s SSL handshake on every request
        engine_kwargs.update({
            "pool_pre_ping": True,         # Verify connection is alive before use
            "pool_size": 1,                # Single connection (one request at a time)
            "max_overflow": 2,             # Allow 2 extra under burst
            "pool_recycle": 300,           # Recycle every 5 min (matches Vercel warm time)
            "pool_timeout": 10,            # Fail fast if pool exhausted
            "connect_args": {
                "server_settings": {
                    "application_name": "kadaigpt-serverless",
                    "statement_timeout": "25000",
                },
                "command_timeout": 10,     # 10s connection timeout
            }
        })
    else:
        # Server mode (Render, Railway, VPS): Use connection pooling
        engine_kwargs.update({
            "pool_pre_ping": True,
            "pool_size": 20,           # Production pool size
            "max_overflow": 10,        # Extra connections under load
            "pool_recycle": 1800,      # Recycle connections every 30 min
            "pool_timeout": 30,
            "connect_args": {
                "server_settings": {
                    "application_name": "kadaigpt",
                    "statement_timeout": "30000",  # 30s query timeout
                }
            }
        })
    
    # Apply SSL for Supabase/Neon via connect_args (asyncpg uses 'ssl' not 'sslmode')
    if _needs_ssl:
        import ssl as _ssl
        ssl_ctx = _ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = _ssl.CERT_NONE
        engine_kwargs["connect_args"]["ssl"] = ssl_ctx

# Create async engine
engine = create_async_engine(db_url, **engine_kwargs)


# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all database models"""
    pass


# Track whether DB has been initialized (for serverless lazy init)
_db_initialized = False


async def init_db():
    """Initialize database - create all tables and indexes"""
    global _db_initialized
    if _db_initialized:
        return  # Already initialized this instance
    
    if is_serverless:
        # Serverless: skip all DB work on startup — connection establishes on first query
        # Tables already exist in Supabase (created via SQL Editor)
        logger.info("[Database] Serverless mode — skipping init (lazy connect)")
        _db_initialized = True
        return
    
    # Full init for server mode (Render, Docker, etc.)
    logger.info("[Database] Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("[Database] Tables created successfully!")
    
    # Only run migrations and indexes on PostgreSQL
    if not is_sqlite:
        await run_migrations()
        await create_indexes()
    
    _db_initialized = True



async def run_migrations():
    """Run lightweight migrations to add missing columns to existing tables.
    These use PostgreSQL-specific DO $$ blocks and are skipped on SQLite.
    """
    migration_statements = [
        # Add deleted_at to customers if missing (soft delete support)
        """DO $$ BEGIN
            ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;""",
        # Add loyalty_points to customers if missing
        """DO $$ BEGIN
            ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;""",
        # Add last_purchase to customers if missing
        """DO $$ BEGIN
            ALTER TABLE customers ADD COLUMN last_purchase TIMESTAMP;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;""",
        # Add tokens_valid_after to users (JWT revocation support)
        """DO $$ BEGIN
            ALTER TABLE users ADD COLUMN tokens_valid_after TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;""",
    ]
    try:
        async with engine.begin() as conn:
            for stmt in migration_statements:
                try:
                    await conn.execute(text(stmt))
                except Exception as e:
                    logger.debug(f"Migration skipped: {e}")
        logger.info(f"[Database] {len(migration_statements)} migrations checked")
    except Exception as e:
        logger.warning(f"[Database] Migrations skipped: {e}")


async def create_indexes():
    """Create performance indexes for common query patterns"""
    index_statements = [
        # Products: frequently searched by store + name
        "CREATE INDEX IF NOT EXISTS idx_products_store_name ON products(store_id, name)",
        "CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active)",
        "CREATE INDEX IF NOT EXISTS idx_products_store_category ON products(store_id, category_id)",
        "CREATE INDEX IF NOT EXISTS idx_products_store_stock ON products(store_id, current_stock)",
        # Bills: frequently queried by store + date range
        "CREATE INDEX IF NOT EXISTS idx_bills_store_date ON bills(store_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_bills_store_status ON bills(store_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_bills_customer_phone ON bills(customer_phone)",
        "CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number)",
        # Bill Items: join performance
        "CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id)",
        "CREATE INDEX IF NOT EXISTS idx_bill_items_product ON bill_items(product_id)",
        # Customers: phone lookup
        "CREATE INDEX IF NOT EXISTS idx_customers_store_phone ON customers(store_id, phone)",
        "CREATE INDEX IF NOT EXISTS idx_customers_store_name ON customers(store_id, name)",
        # Users: auth lookups
        "CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id)",
        # Daily Summaries: date range queries
        "CREATE INDEX IF NOT EXISTS idx_daily_summaries_store_date ON daily_summaries(store_id, summary_date DESC)",
        # Agent Logs: recent logs
        "CREATE INDEX IF NOT EXISTS idx_agent_logs_store_date ON agent_logs(store_id, created_at DESC)",
    ]
    try:
        async with engine.begin() as conn:
            for stmt in index_statements:
                try:
                    await conn.execute(text(stmt))
                except Exception as e:
                    logger.debug(f"Index already exists or skipped: {e}")
        logger.info(f"[Database] {len(index_statements)} performance indexes ensured")
    except Exception as e:
        logger.warning(f"[Database] Index creation skipped: {e}")


async def check_db_health() -> dict:
    """Check database connectivity and return health info"""
    start = time.time()
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            latency_ms = round((time.time() - start) * 1000, 2)
            
            if is_serverless:
                return {
                    "status": "healthy",
                    "latency_ms": latency_ms,
                    "mode": "serverless (NullPool)",
                }
            
            pool = engine.pool
            return {
                "status": "healthy",
                "latency_ms": latency_ms,
                "pool_size": pool.size() if hasattr(pool, 'size') else "N/A",
                "checked_out": pool.checkedout() if hasattr(pool, 'checkedout') else "N/A",
            }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)[:100]}


# ──────────────────────────────────────────────────────────────
# Serverless self-healing schema
# init_db() skips all DB work in serverless mode (Vercel), so new columns/tables
# added in code are never created. This runs the small set of idempotent
# migrations needed by recent features, once per cold container, on first DB use.
# ──────────────────────────────────────────────────────────────
_serverless_schema_ensured = False

# Idempotent statements — safe to run repeatedly. Postgres only.
_SERVERLESS_SCHEMA_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ",
    """CREATE TABLE IF NOT EXISTS auth_security_state (
        id SERIAL PRIMARY KEY,
        kind VARCHAR(20) NOT NULL,
        key VARCHAR(255) NOT NULL,
        data JSON,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    "CREATE INDEX IF NOT EXISTS idx_auth_security_kind_key ON auth_security_state(kind, key)",
]


async def ensure_serverless_schema():
    """Apply recent additive migrations on serverless, once per cold start.
    No-op on SQLite/local (handled by init_db there) and after the first run.
    """
    global _serverless_schema_ensured
    if _serverless_schema_ensured or not is_serverless or is_sqlite:
        return
    try:
        async with engine.begin() as conn:
            for stmt in _SERVERLESS_SCHEMA_STATEMENTS:
                try:
                    await conn.execute(text(stmt))
                except Exception as e:
                    logger.debug(f"[Schema] statement skipped: {e}")
        logger.info("[Schema] Serverless schema ensured")
    except Exception as e:
        logger.warning(f"[Schema] ensure failed (continuing): {e}")
    finally:
        # Mark done even on failure so we don't retry DDL on every request;
        # a genuinely missing schema will surface as a clear query error.
        _serverless_schema_ensured = True


async def get_db() -> AsyncSession:
    """Dependency to get database session"""
    await ensure_serverless_schema()
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

