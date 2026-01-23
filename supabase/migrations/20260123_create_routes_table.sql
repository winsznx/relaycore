-- Routes Table Migration
-- Create table for x402-protected proxy routes

CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    upstream_url TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    price_usdc DECIMAL(18, 6) NOT NULL DEFAULT 0.01,
    pay_to TEXT NOT NULL,
    secret_headers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    request_count INTEGER DEFAULT 0,
    revenue DECIMAL(18, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_is_active ON routes(is_active);

-- RLS Policies
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own routes
CREATE POLICY routes_select_policy ON routes
    FOR SELECT USING (true);

CREATE POLICY routes_insert_policy ON routes
    FOR INSERT WITH CHECK (true);

CREATE POLICY routes_update_policy ON routes
    FOR UPDATE USING (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routes_updated_at_trigger
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_routes_updated_at();
