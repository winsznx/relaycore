-- ============================================
-- FIX DEX_VENUES TABLE - Simple approach
-- Just ensure the table exists with correct data
-- ============================================

-- Drop and recreate to ensure clean state
DROP TABLE IF EXISTS dex_venues CASCADE;

CREATE TABLE dex_venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    contract_address TEXT NOT NULL,
    chain TEXT NOT NULL DEFAULT 'cronos',
    max_leverage INTEGER DEFAULT 1,
    trading_fee_bps INTEGER DEFAULT 30,
    supported_pairs TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dex_venues ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read dex_venues" ON dex_venues 
    FOR SELECT 
    USING (true);

-- Service write access  
CREATE POLICY "Service write dex_venues" ON dex_venues 
    FOR ALL 
    USING (true);

-- Create indexes
CREATE INDEX idx_dex_venues_chain ON dex_venues(chain);
CREATE INDEX idx_dex_venues_active ON dex_venues(is_active);

-- Insert venues
INSERT INTO dex_venues (name, contract_address, chain, max_leverage, trading_fee_bps, supported_pairs, is_active)
VALUES 
    ('Moonlander', '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9', 'cronos', 1000, 10, ARRAY['BTC-USD', 'ETH-USD', 'CRO-USD'], true),
    ('Fulcrom Finance', '0x0000000000000000000000000000000000000001', 'cronos', 100, 10, ARRAY['BTC-USD', 'ETH-USD'], true);
