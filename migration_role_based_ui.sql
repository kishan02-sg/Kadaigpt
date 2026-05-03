-- KadaiGPT Migration: Role-Based UI
-- Run this in Supabase SQL Editor BEFORE deploying the new code
-- Date: 2026-05-03

-- 1. Add INVENTORY_MANAGER to the userrole enum
ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'INVENTORY_MANAGER';

-- 2. Add staff_id column for staff login (unique ID like KDG-4821)
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN staff_id VARCHAR(20) UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Create index for fast staff_id lookups
CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);

-- Verify: Check that the changes took effect
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'userrole'::regtype ORDER BY enumsortorder;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'staff_id';
