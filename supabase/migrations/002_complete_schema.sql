-- ============================================
-- ADDITIONAL TABLES FOR FULL ARCHITECTURE
-- Run this in Supabase SQL Editor
-- ============================================

-- SERVICES TABLE
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  endpoint_url TEXT,
  price_per_call DECIMAL(18,8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_address);

-- REPUTATIONS TABLE (for services)
CREATE TABLE IF NOT EXISTS reputations (
  service_id UUID PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  total_payments INTEGER DEFAULT 0,
  successful_payments INTEGER DEFAULT 0,
  failed_payments INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  unique_payers INTEGER DEFAULT 0,
  reputation_score DECIMAL(5,2) DEFAULT 0,
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);

-- OUTCOMES TABLE
CREATE TABLE IF NOT EXISTS outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('delivered', 'failed', 'timeout')),
  latency_ms INTEGER,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_payment ON outcomes(payment_id);

-- IDENTITY MAPPINGS TABLE
CREATE TABLE IF NOT EXISTS identity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  platform TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_social ON identity_mappings(social_id);
CREATE INDEX IF NOT EXISTS idx_identity_wallet ON identity_mappings(wallet_address);

-- DEX_VENUES TABLE
CREATE TABLE IF NOT EXISTS dex_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  max_leverage INTEGER DEFAULT 100,
  trading_fee_bps INTEGER DEFAULT 30,
  supported_pairs TEXT[] DEFAULT ARRAY['BTC-USD', 'ETH-USD'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRADES TABLE
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  venue_id UUID REFERENCES dex_venues(id),
  pair TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  leverage DECIMAL(5,2),
  size_usd DECIMAL(18,8),
  entry_price DECIMAL(18,8),
  exit_price DECIMAL(18,8),
  liquidation_price DECIMAL(18,8),
  stop_loss DECIMAL(18,8),
  take_profit DECIMAL(18,8),
  pnl_usd DECIMAL(18,8),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'liquidated')),
  tx_hash_open TEXT,
  tx_hash_close TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_venue ON trades(venue_id);

-- DAILY STATS TABLE
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_payments INTEGER DEFAULT 0,
  successful_payments INTEGER DEFAULT 0,
  total_volume_usd DECIMAL(18,8) DEFAULT 0,
  unique_services INTEGER DEFAULT 0,
  unique_payers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);

-- API KEYS TABLE
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  rate_limit INTEGER DEFAULT 100,
  queries_used INTEGER DEFAULT 0,
  queries_limit INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dex_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Public read for all
CREATE POLICY "Public read" ON services FOR SELECT USING (true);
CREATE POLICY "Public read" ON reputations FOR SELECT USING (true);
CREATE POLICY "Public read" ON outcomes FOR SELECT USING (true);
CREATE POLICY "Public read" ON identity_mappings FOR SELECT USING (true);
CREATE POLICY "Public read" ON dex_venues FOR SELECT USING (true);
CREATE POLICY "Public read" ON trades FOR SELECT USING (true);
CREATE POLICY "Public read" ON daily_stats FOR SELECT USING (true);

-- Service role can write
CREATE POLICY "Service write" ON services FOR ALL USING (true);
CREATE POLICY "Service write" ON reputations FOR ALL USING (true);
CREATE POLICY "Service write" ON outcomes FOR ALL USING (true);
CREATE POLICY "Service write" ON identity_mappings FOR ALL USING (true);
CREATE POLICY "Service write" ON dex_venues FOR ALL USING (true);
CREATE POLICY "Service write" ON trades FOR ALL USING (true);
CREATE POLICY "Service write" ON daily_stats FOR ALL USING (true);
CREATE POLICY "Service write" ON api_keys FOR ALL USING (true);

-- ============================================
-- SEED DEX VENUES
-- ============================================

INSERT INTO dex_venues (name, contract_address, chain, max_leverage, trading_fee_bps, supported_pairs, is_active)
VALUES 
  ('Moonlander', '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9', 'cronos', 100, 10, ARRAY['BTC-USD', 'ETH-USD', 'CRO-USD'], true),
  ('GMX v2', '0x0000000000000000000000000000000000000000', 'arbitrum', 50, 10, ARRAY['BTC-USD', 'ETH-USD'], true),
  ('Gains Network', '0x0000000000000000000000000000000000000000', 'polygon', 150, 8, ARRAY['BTC-USD', 'ETH-USD'], true)
ON CONFLICT DO NOTHING;

-- ============================================
-- MATERIALIZED VIEW FOR SERVICE RANKINGS
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS service_rankings AS
SELECT 
  s.id,
  s.name,
  s.category,
  s.owner_address,
  r.reputation_score,
  r.total_payments,
  CASE WHEN r.total_payments > 0 
    THEN (r.successful_payments::FLOAT / r.total_payments) * 100 
    ELSE 0 
  END AS success_rate,
  r.avg_latency_ms,
  s.last_active
FROM services s
LEFT JOIN reputations r ON s.id = r.service_id
WHERE s.is_active = true
ORDER BY r.reputation_score DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_rankings_id ON service_rankings(id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_service_rankings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY service_rankings;
END;
$$ LANGUAGE plpgsql;
