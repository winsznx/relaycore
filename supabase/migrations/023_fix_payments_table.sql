-- Fix payments table schema
-- Ensures the payments table has all required columns

-- Drop and recreate payments table with correct schema
DROP TABLE IF EXISTS payments CASCADE;

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id TEXT NOT NULL UNIQUE,
    tx_hash TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    token_address TEXT NOT NULL,
    resource_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('verified', 'settled', 'failed')),
    block_number BIGINT DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_from_address ON payments(from_address);
CREATE INDEX IF NOT EXISTS idx_payments_to_address ON payments(to_address);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_resource_url ON payments(resource_url);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp DESC);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "Public read access" ON payments;
CREATE POLICY "Public read access" ON payments
    FOR SELECT USING (true);

-- Service role can insert/update
DROP POLICY IF EXISTS "Service role write access" ON payments;
CREATE POLICY "Service role write access" ON payments
    FOR ALL USING (true);
