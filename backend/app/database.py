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
        # Serverless (Vercel) + Supabase Transaction Pooler (pgbouncer).
        # pgbouncer in transaction mode does NOT support prepared statements, and
        # reusing a connection across requests causes
        #   'prepared statement "__asyncpg_stmt_x__" already exists'
        # So: use NullPool (fresh connection per request) AND fully disable
        # asyncpg/SQLAlchemy prepared-statement caching + use unique statement
        # names. This is the documented SQLAlchemy fix for pgbouncer.
        import uuid as _uuid
        engine_kwargs.update({
            "poolclass": NullPool,
            "connect_args": {
                "server_settings": {
                    "application_name": "kadaigpt-serverless",
                    "statement_timeout": "25000",
                },
                "command_timeout": 10,
                # Disable prepared statements (pgbouncer transaction mode):
                "statement_cache_size": 0,                 # asyncpg statement cache off
                "prepared_statement_cache_size": 0,        # SQLAlchemy dialect cache off
                "prepared_statement_name_func": lambda: f"__asyncpg_{_uuid.uuid4()}__",
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
    
    # Run migrations and indexes (run_migrations handles SQLite vs PostgreSQL internally)
    await run_migrations()
    if not is_sqlite:
        await create_indexes()

    _db_initialized = True


# Columns that may be missing from a pre-existing table on either PostgreSQL
# or SQLite. Each entry is (table, column, sqlite_column_def) — the SQLite
# definition is used with "ALTER TABLE ... ADD COLUMN" (SQLite has no
# "IF NOT EXISTS" for columns, so we check PRAGMA table_info first).
_ADDITIVE_COLUMNS = [
    ("customers", "deleted_at", "TIMESTAMP"),
    ("customers", "loyalty_points", "INTEGER DEFAULT 0"),
    ("customers", "last_purchase", "TIMESTAMP"),
    ("users", "tokens_valid_after", "TIMESTAMP"),
    ("subscription_invoices", "gateway_order_id", "VARCHAR(200)"),
    ("stores", "status", "VARCHAR(20) DEFAULT 'active'"),
]


async def run_migrations():
    """Run lightweight migrations to add missing columns to existing tables.

    PostgreSQL uses DO $$ ... END $$ blocks (duplicate_column is caught).
    SQLite has no "ADD COLUMN IF NOT EXISTS", so we check PRAGMA table_info
    for each table and only add columns that are actually missing.
    """
    if is_sqlite:
        try:
            async with engine.begin() as conn:
                for table, column, sqlite_def in _ADDITIVE_COLUMNS:
                    result = await conn.execute(text(f"PRAGMA table_info({table})"))
                    existing_columns = {row[1] for row in result.fetchall()}
                    if column not in existing_columns:
                        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_def}"))
                        logger.info(f"[Database] Added missing column {table}.{column}")
            logger.info(f"[Database] {len(_ADDITIVE_COLUMNS)} migrations checked (SQLite)")
        except Exception as e:
            logger.warning(f"[Database] Migrations skipped: {e}")
        return

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
        # Add gateway_order_id to subscription_invoices (Razorpay order tracking)
        """DO $$ BEGIN
            ALTER TABLE subscription_invoices ADD COLUMN gateway_order_id VARCHAR(200);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;""",
        # Add status to stores (admin suspension state)
        """DO $$ BEGIN
            ALTER TABLE stores ADD COLUMN status VARCHAR(20) DEFAULT 'active';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;""",
        # Allow NULL store_id on users (platform ADMIN accounts)
        """DO $$ BEGIN
            ALTER TABLE users ALTER COLUMN store_id DROP NOT NULL;
        EXCEPTION WHEN others THEN NULL;
        END $$;""",
        # If users.role is backed by a native Postgres ENUM type, it must learn
        # the new 'ADMIN' value before any row can be set to that role.
        # No-op if the column is a plain VARCHAR (not a Postgres enum).
        """DO $$
        DECLARE
            col_type text;
        BEGIN
            SELECT udt_name INTO col_type
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'role';

            IF col_type IS NOT NULL AND col_type NOT IN ('varchar', 'text', 'bpchar') THEN
                EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_type, 'ADMIN');
            END IF;
        EXCEPTION WHEN others THEN NULL;
        END $$;""",
        # Same pattern for bills.status: if it's a native Postgres ENUM, it must
        # learn 'PENDING_PAYMENT' (checkout-QR UPI bills) before any row can use
        # that status. No-op when the column is a plain VARCHAR.
        """DO $$
        DECLARE
            col_type text;
        BEGIN
            SELECT udt_name INTO col_type
            FROM information_schema.columns
            WHERE table_name = 'bills' AND column_name = 'status';

            IF col_type IS NOT NULL AND col_type NOT IN ('varchar', 'text', 'bpchar') THEN
                EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_type, 'PENDING_PAYMENT');
            END IF;
        EXCEPTION WHEN others THEN NULL;
        END $$;""",
        # Razorpay checkout-QR payments (UPI verification). The unique
        # razorpay_payment_id makes replayed webhooks hit a constraint instead
        # of double-processing.
        """CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            bill_id INTEGER NOT NULL REFERENCES bills(id),
            razorpay_qr_code_id VARCHAR(100),
            razorpay_payment_id VARCHAR(100) UNIQUE,
            amount DOUBLE PRECISION NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            qr_image_url VARCHAR(500),
            expires_at TIMESTAMPTZ,
            paid_at TIMESTAMPTZ,
            note VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ
        )""",
        "CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id)",
        "CREATE INDEX IF NOT EXISTS idx_payments_qr ON payments(razorpay_qr_code_id)",
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
    """CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL,
        category VARCHAR(50) DEFAULT 'other',
        description VARCHAR(255) NOT NULL,
        amount DOUBLE PRECISION DEFAULT 0,
        expense_date TIMESTAMPTZ,
        recurring BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    "CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, expense_date DESC)",
    # Per-store WhatsApp customer-bot connection config
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100)",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_provider VARCHAR(20)",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_cloud_phone_id VARCHAR(64)",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_session VARCHAR(64)",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_cloud_token_enc TEXT",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_evolution_url VARCHAR(255)",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_evolution_key_enc TEXT",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_number VARCHAR(20)",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS wa_connected BOOLEAN DEFAULT false",
    "CREATE INDEX IF NOT EXISTS idx_stores_wa_phone ON stores(wa_cloud_phone_id)",
    "CREATE INDEX IF NOT EXISTS idx_stores_wa_session ON stores(wa_session)",
    # Subscription system (Razorpay checkout). The `subscriptions` table may already
    # exist from an earlier schema (plan_name/plan_type) — add the columns the
    # current ORM model (app/models/subscription.py) expects.
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free'",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly'",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_amount DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR'",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway VARCHAR(50)",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS custom_price DOUBLE PRECISION",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS custom_features JSONB",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS activated_by VARCHAR(100)",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS activation_source VARCHAR(100)",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS partner_code VARCHAR(50)",
    """CREATE TABLE IF NOT EXISTS usage_records (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
        store_id INTEGER NOT NULL REFERENCES stores(id),
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        bills_created INTEGER DEFAULT 0,
        whatsapp_messages_sent INTEGER DEFAULT 0,
        ocr_scans INTEGER DEFAULT 0,
        api_calls INTEGER DEFAULT 0,
        storage_mb DOUBLE PRECISION DEFAULT 0,
        ai_queries INTEGER DEFAULT 0,
        voice_commands INTEGER DEFAULT 0,
        demand_forecasts INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    "CREATE INDEX IF NOT EXISTS idx_usage_records_store ON usage_records(store_id, period_start, period_end)",
    """CREATE TABLE IF NOT EXISTS subscription_invoices (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
        store_id INTEGER NOT NULL REFERENCES stores(id),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        invoice_date TIMESTAMPTZ DEFAULT now(),
        due_date TIMESTAMPTZ,
        subtotal DOUBLE PRECISION DEFAULT 0,
        tax_amount DOUBLE PRECISION DEFAULT 0,
        discount_amount DOUBLE PRECISION DEFAULT 0,
        total_amount DOUBLE PRECISION NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        payment_method VARCHAR(50),
        payment_gateway VARCHAR(50),
        payment_id VARCHAR(200),
        gateway_order_id VARCHAR(200),
        paid_at TIMESTAMPTZ,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        gstin VARCHAR(20),
        place_of_supply VARCHAR(50),
        cgst_amount DOUBLE PRECISION DEFAULT 0,
        sgst_amount DOUBLE PRECISION DEFAULT 0,
        igst_amount DOUBLE PRECISION DEFAULT 0,
        invoice_pdf_url VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    "ALTER TABLE subscription_invoices ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(200)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_invoices_store ON subscription_invoices(store_id)",
    """CREATE TABLE IF NOT EXISTS feature_flags (
        id SERIAL PRIMARY KEY,
        store_id INTEGER REFERENCES stores(id),
        feature_key VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT false,
        reason TEXT,
        enabled_by VARCHAR(100),
        rollout_percentage DOUBLE PRECISION DEFAULT 100.0,
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ
    )""",
    "CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(feature_key)",
    """CREATE TABLE IF NOT EXISTS partner_referrals (
        id SERIAL PRIMARY KEY,
        partner_name VARCHAR(200) NOT NULL,
        partner_type VARCHAR(50),
        partner_code VARCHAR(50) UNIQUE NOT NULL,
        partner_phone VARCHAR(20),
        partner_email VARCHAR(200),
        city VARCHAR(100),
        state VARCHAR(100),
        district VARCHAR(100),
        per_signup_commission DOUBLE PRECISION DEFAULT 500.0,
        recurring_commission DOUBLE PRECISION DEFAULT 50.0,
        commission_currency VARCHAR(10) DEFAULT 'INR',
        total_signups INTEGER DEFAULT 0,
        active_stores INTEGER DEFAULT 0,
        total_earned DOUBLE PRECISION DEFAULT 0.0,
        last_signup_date TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    # Platform admin: store lifecycle state + nullable user.store_id (admin accounts)
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
    """DO $$ BEGIN
        ALTER TABLE users ALTER COLUMN store_id DROP NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END $$;""",
    # If users.role is backed by a native Postgres ENUM type, it must learn the
    # new 'ADMIN' value before any row can be set to that role. No-op if the
    # column is a plain VARCHAR (not a Postgres enum).
    """DO $$
    DECLARE
        col_type text;
    BEGIN
        SELECT udt_name INTO col_type
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role';

        IF col_type IS NOT NULL AND col_type NOT IN ('varchar', 'text', 'bpchar') THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_type, 'ADMIN');
        END IF;
    EXCEPTION WHEN others THEN NULL;
    END $$;""",
    # Admin-editable subscription plans (falls back to TIER_FEATURES if empty)
    """CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        tier_key VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price_monthly DOUBLE PRECISION DEFAULT 0,
        price_yearly DOUBLE PRECISION DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        max_bills_per_month INTEGER DEFAULT -1,
        max_languages INTEGER DEFAULT 6,
        analytics_days INTEGER DEFAULT 30,
        max_products INTEGER DEFAULT -1,
        max_customers INTEGER DEFAULT -1,
        whatsapp_messages_per_month INTEGER DEFAULT 0,
        max_stores INTEGER DEFAULT 1,
        features JSONB DEFAULT '[]',
        branding BOOLEAN DEFAULT true,
        api_access BOOLEAN DEFAULT false,
        custom_reports BOOLEAN DEFAULT false,
        voice_commands BOOLEAN DEFAULT true,
        ocr_scanning BOOLEAN DEFAULT true,
        demand_forecasting BOOLEAN DEFAULT false,
        credit_management BOOLEAN DEFAULT false,
        priority_support BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        is_custom BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    "CREATE INDEX IF NOT EXISTS idx_plans_tier_key ON plans(tier_key)",
    # Cross-store login activity feed
    """CREATE TABLE IF NOT EXISTS login_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        store_id INTEGER REFERENCES stores(id),
        email_or_staff_id VARCHAR(255),
        role VARCHAR(30),
        full_name VARCHAR(200),
        login_method VARCHAR(20),
        success BOOLEAN DEFAULT true,
        failure_reason VARCHAR(100),
        ip_address VARCHAR(50),
        user_agent VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT now()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_login_history_store_created ON login_history(store_id, created_at DESC)",
    # If bills.status is a native Postgres ENUM it must learn 'PENDING_PAYMENT'
    # before any checkout-QR bill can use it (mirrors the users.role migration).
    # No-op when the column is a plain VARCHAR.
    """DO $$
    DECLARE
        col_type text;
    BEGIN
        SELECT udt_name INTO col_type
        FROM information_schema.columns
        WHERE table_name = 'bills' AND column_name = 'status';

        IF col_type IS NOT NULL AND col_type NOT IN ('varchar', 'text', 'bpchar') THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', col_type, 'PENDING_PAYMENT');
        END IF;
    EXCEPTION WHEN others THEN NULL;
    END $$;""",
    # Razorpay checkout-QR payments (UPI verification)
    """CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER NOT NULL REFERENCES bills(id),
        razorpay_qr_code_id VARCHAR(100),
        razorpay_payment_id VARCHAR(100) UNIQUE,
        amount DOUBLE PRECISION NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        qr_image_url VARCHAR(500),
        expires_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        note VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    )""",
    "CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id)",
    "CREATE INDEX IF NOT EXISTS idx_payments_qr ON payments(razorpay_qr_code_id)",
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

