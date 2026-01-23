-- RWA Assets Table
-- Stores tokenized real-world assets

CREATE TABLE IF NOT EXISTS rwa_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    value NUMERIC(20, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USDC',
    owner_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rwa_assets_asset_id ON rwa_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_rwa_assets_owner ON rwa_assets(owner_address);
CREATE INDEX IF NOT EXISTS idx_rwa_assets_status ON rwa_assets(status);
CREATE INDEX IF NOT EXISTS idx_rwa_assets_type ON rwa_assets(type);

CREATE TRIGGER update_rwa_assets_updated_at
    BEFORE UPDATE ON rwa_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE rwa_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rwa_assets" ON rwa_assets
    FOR SELECT USING (true);

CREATE POLICY "Service insert rwa_assets" ON rwa_assets
    FOR INSERT WITH CHECK (is_service_role());

CREATE POLICY "Service update rwa_assets" ON rwa_assets
    FOR UPDATE USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "Service delete rwa_assets" ON rwa_assets
    FOR DELETE USING (is_service_role());
