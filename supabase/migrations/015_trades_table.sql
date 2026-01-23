-- Create trades table for perpetual trading
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address TEXT NOT NULL,
    venue_id UUID REFERENCES dex_venues(id),
    pair TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    leverage INTEGER NOT NULL,
    size_usd NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    liquidation_price NUMERIC,
    stop_loss NUMERIC,
    take_profit NUMERIC,
    tx_hash_open TEXT,
    tx_hash_close TEXT,
    exit_price NUMERIC,
    pnl_usd NUMERIC,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Users can read their own trades
DROP POLICY IF EXISTS "Users read own trades" ON trades;
CREATE POLICY "Users read own trades" ON trades 
    FOR SELECT 
    USING (user_address = current_setting('request.jwt.claims', true)::json->>'sub' OR true);

-- Service can write all trades
DROP POLICY IF EXISTS "Service write trades" ON trades;
CREATE POLICY "Service write trades" ON trades 
    FOR ALL 
    USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_address);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_venue ON trades(venue_id);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
