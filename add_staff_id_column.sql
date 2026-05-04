-- Migration: Add staff_id column to users table
-- Run this in Supabase SQL Editor

-- Add staff_id column (for staff login with KDG-XXXX)
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id VARCHAR(20) UNIQUE;

-- Add INVENTORY_MANAGER to the userrole enum (if not already present)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INVENTORY_MANAGER' AND enumtypid = 'userrole'::regtype) THEN
        ALTER TYPE userrole ADD VALUE 'INVENTORY_MANAGER';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'staff_id';
