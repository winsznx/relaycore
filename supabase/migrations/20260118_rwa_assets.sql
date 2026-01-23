-- RWA Assets and Lifecycle - Phase 9 Implementation
-- Tables for RWA asset management with full lifecycle tracking

-- ============================================
-- RWA ASSETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rwa_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('property', 'invoice', 'receivable', 'equipment', 'commodity', 'bond')),
    name TEXT NOT NULL,
    description TEXT,
    owner_address TEXT NOT NULL,
    value DECIMAL(30, 6) NOT NULL,
    currency TEXT DEFAULT 'USDC',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'minted', 'active', 'frozen', 'redeemed')),
    metadata JSONB DEFAULT '{}',
    tx_hash TEXT,
    session_id INTEGER REFERENCES escrow_sessions(session_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    minted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_rwa_value CHECK (value > 0)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rwa_assets_owner ON rwa_assets(owner_address);
CREATE INDEX IF NOT EXISTS idx_rwa_assets_type ON rwa_assets(type);
CREATE INDEX IF NOT EXISTS idx_rwa_assets_status ON rwa_assets(status);
CREATE INDEX IF NOT EXISTS idx_rwa_assets_created ON rwa_assets(created_at DESC);

-- ============================================
-- RWA LIFECYCLE EVENTS TABLE  
-- ============================================

CREATE TABLE IF NOT EXISTS rwa_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    asset_id TEXT NOT NULL REFERENCES rwa_assets(asset_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('mint', 'transfer', 'update', 'freeze', 'unfreeze', 'redeem', 'payment')),
    actor TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    tx_hash TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying events by asset
CREATE INDEX IF NOT EXISTS idx_rwa_events_asset ON rwa_lifecycle_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_rwa_events_type ON rwa_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_rwa_events_timestamp ON rwa_lifecycle_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rwa_events_actor ON rwa_lifecycle_events(actor);

-- ============================================
-- RWA ASSET STATS VIEW
-- ============================================

CREATE OR REPLACE VIEW rwa_asset_stats AS
SELECT 
    type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'active' OR status = 'minted') as active_count,
    COUNT(*) FILTER (WHERE status = 'redeemed') as redeemed_count,
    SUM(value) as total_value,
    SUM(value) FILTER (WHERE status = 'active' OR status = 'minted') as active_value,
    AVG(value) as avg_value
FROM rwa_assets
GROUP BY type;

-- ============================================
-- RWA OWNER PORTFOLIO VIEW
-- ============================================

CREATE OR REPLACE VIEW rwa_owner_portfolio AS
SELECT 
    owner_address,
    COUNT(*) as asset_count,
    SUM(value) as total_value,
    array_agg(DISTINCT type) as asset_types,
    MAX(created_at) as latest_asset_date
FROM rwa_assets
WHERE status IN ('active', 'minted')
GROUP BY owner_address;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE rwa_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_lifecycle_events ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read rwa assets" ON rwa_assets
    FOR SELECT USING (true);

CREATE POLICY "Public read rwa lifecycle" ON rwa_lifecycle_events
    FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service insert rwa assets" ON rwa_assets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update rwa assets" ON rwa_assets
    FOR UPDATE USING (true);

CREATE POLICY "Service insert rwa lifecycle" ON rwa_lifecycle_events
    FOR INSERT WITH CHECK (true);

-- ============================================
-- UPDATE TRIGGER FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_rwa_asset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rwa_assets_updated_at ON rwa_assets;
CREATE TRIGGER rwa_assets_updated_at
    BEFORE UPDATE ON rwa_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_rwa_asset_timestamp();
