-- KadaiGPT Database Schema v2 (UPPERCASE enums)
-- Run this in Supabase SQL Editor

-- Clean slate: drop everything
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_trails CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS agent_logs CASCADE;
DROP TABLE IF EXISTS print_jobs CASCADE;
DROP TABLE IF EXISTS handwritten_bills CASCADE;
DROP TABLE IF EXISTS bill_items CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TYPE IF EXISTS userrole CASCADE;
DROP TYPE IF EXISTS billstatus CASCADE;
DROP TYPE IF EXISTS paymentmethod CASCADE;
DROP TYPE IF EXISTS syncstatus CASCADE;
DROP TYPE IF EXISTS ocrconfidence CASCADE;

-- Create enum types (UPPERCASE to match SQLAlchemy)
CREATE TYPE userrole AS ENUM ('OWNER', 'MANAGER', 'CASHIER');
CREATE TYPE billstatus AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PENDING_PAYMENT');
CREATE TYPE paymentmethod AS ENUM ('CASH', 'UPI', 'CARD', 'CREDIT');
CREATE TYPE syncstatus AS ENUM ('PENDING', 'SYNCED', 'FAILED');
CREATE TYPE ocrconfidence AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- 1. Stores
CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    gst_number VARCHAR(20),
    license_number VARCHAR(50),
    business_type VARCHAR(50),
    opening_time VARCHAR(10),
    closing_time VARCHAR(10),
    currency VARCHAR(10) DEFAULT 'INR',
    tax_rate FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 2. Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    telegram_chat_id VARCHAR(64) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role userrole DEFAULT 'CASHIER',
    avatar_url VARCHAR(500),
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'dark',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 3. Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(50),
    barcode VARCHAR(50),
    cost_price FLOAT DEFAULT 0.0,
    selling_price FLOAT NOT NULL,
    mrp FLOAT,
    discount_percent FLOAT DEFAULT 0.0,
    tax_rate FLOAT DEFAULT 0.0,
    hsn_code VARCHAR(20),
    current_stock INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 10,
    unit VARCHAR(20) DEFAULT 'pieces',
    expiry_date TIMESTAMP,
    batch_number VARCHAR(50),
    manufacturer VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 5. Bills
CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    cashier_id INTEGER REFERENCES users(id),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    bill_date TIMESTAMPTZ DEFAULT NOW(),
    customer_name VARCHAR(200),
    customer_phone VARCHAR(20),
    subtotal FLOAT DEFAULT 0.0,
    discount_amount FLOAT DEFAULT 0.0,
    tax_amount FLOAT DEFAULT 0.0,
    total_amount FLOAT NOT NULL,
    payment_method paymentmethod DEFAULT 'CASH',
    amount_paid FLOAT DEFAULT 0.0,
    change_amount FLOAT DEFAULT 0.0,
    status billstatus DEFAULT 'COMPLETED',
    sync_status syncstatus DEFAULT 'SYNCED',
    local_id VARCHAR(50),
    is_printed BOOLEAN DEFAULT FALSE,
    print_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 5b. Payments (Razorpay checkout-QR UPI verification)
-- razorpay_payment_id UNIQUE is the webhook idempotency guard: a replayed
-- qr_code.credited event violates the constraint instead of double-crediting.
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    razorpay_qr_code_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100) UNIQUE,
    amount FLOAT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    qr_image_url VARCHAR(500),
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    note VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX idx_payments_bill ON payments(bill_id);
CREATE INDEX idx_payments_qr ON payments(razorpay_qr_code_id);

-- 6. Bill Items
CREATE TABLE bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    product_sku VARCHAR(50),
    unit_price FLOAT NOT NULL,
    quantity FLOAT NOT NULL,
    discount_percent FLOAT DEFAULT 0.0,
    tax_rate FLOAT DEFAULT 0.0,
    subtotal FLOAT NOT NULL,
    discount_amount FLOAT DEFAULT 0.0,
    tax_amount FLOAT DEFAULT 0.0,
    total FLOAT NOT NULL
);

-- 7. Handwritten Bills (OCR)
CREATE TABLE handwritten_bills (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    image_path VARCHAR(500) NOT NULL,
    image_thumbnail VARCHAR(500),
    raw_ocr_text TEXT,
    extracted_data JSONB,
    overall_confidence FLOAT,
    confidence_level ocrconfidence,
    extracted_date TIMESTAMP,
    extracted_total FLOAT,
    extracted_items JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    corrections_made JSONB,
    converted_bill_id INTEGER REFERENCES bills(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 8. Print Jobs
CREATE TABLE print_jobs (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    printer_name VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 9. Agent Logs
CREATE TABLE agent_logs (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id),
    agent_name VARCHAR(100) NOT NULL,
    action VARCHAR(200) NOT NULL,
    input_data JSONB,
    decision JSONB,
    confidence_score FLOAT,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Daily Summaries
CREATE TABLE daily_summaries (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    summary_date TIMESTAMP NOT NULL,
    total_bills INTEGER DEFAULT 0,
    total_revenue FLOAT DEFAULT 0.0,
    total_tax FLOAT DEFAULT 0.0,
    total_discount FLOAT DEFAULT 0.0,
    cash_amount FLOAT DEFAULT 0.0,
    upi_amount FLOAT DEFAULT 0.0,
    card_amount FLOAT DEFAULT 0.0,
    credit_amount FLOAT DEFAULT 0.0,
    total_items_sold INTEGER DEFAULT 0,
    top_selling_items JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(200),
    address TEXT,
    credit FLOAT DEFAULT 0.0,
    credit_limit FLOAT DEFAULT 5000.0,
    total_purchases FLOAT DEFAULT 0.0,
    loyalty_points INTEGER DEFAULT 0,
    last_purchase TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 12. Audit Trails
CREATE TABLE audit_trails (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- 14. Suppliers
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    name VARCHAR(200) NOT NULL,
    contact VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(200),
    address TEXT,
    category VARCHAR(100) DEFAULT 'General',
    pending_amount FLOAT DEFAULT 0.0,
    total_orders INTEGER DEFAULT 0,
    total_paid FLOAT DEFAULT 0.0,
    last_order TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 15. Purchase Orders
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    items JSONB,
    item_count INTEGER DEFAULT 0,
    amount FLOAT DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    expected_delivery TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 16. Subscriptions
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    plan_name VARCHAR(100) NOT NULL DEFAULT 'free',
    plan_type VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    monthly_price FLOAT DEFAULT 0.0,
    annual_price FLOAT DEFAULT 0.0,
    max_products INTEGER DEFAULT 50,
    max_bills_per_day INTEGER DEFAULT 20,
    max_users INTEGER DEFAULT 2,
    features JSONB,
    payment_gateway VARCHAR(50),
    gateway_subscription_id VARCHAR(200),
    gateway_customer_id VARCHAR(200),
    trial_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Performance Indexes
CREATE INDEX idx_products_store_name ON products(store_id, name);
CREATE INDEX idx_products_store_active ON products(store_id, is_active);
CREATE INDEX idx_bills_store_date ON bills(store_id, created_at DESC);
CREATE INDEX idx_bills_bill_number ON bills(bill_number);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_customers_store_phone ON customers(store_id, phone);
-- Offline-sync dedup: a retried bill POST must not create a duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_store_local_id ON bills(store_id, local_id);
CREATE INDEX idx_users_store ON users(store_id);
CREATE INDEX idx_daily_summaries_store_date ON daily_summaries(store_id, summary_date DESC);
