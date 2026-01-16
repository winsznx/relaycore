-- ============================================
-- PERP INDEXING FOR TRADING DATA
-- Funding rates, positions, and liquidity tracking
-- ============================================

-- Funding rates time-series
-- Tracks funding rates across perp venues over time
CREATE TABLE IF NOT EXISTS funding_rates_timeseries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  token TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Funding rate data
  funding_rate DECIMAL(18,8),
  long_oi DECIMAL(18,8),
  short_oi DECIMAL(18,8),
  oi_imbalance DECIMAL(18,8),
  
  -- Block reference
  block_number BIGINT,
  
  CONSTRAINT unique_funding_rate UNIQUE (venue, token, timestamp)
);

-- Indexes for funding rate queries
CREATE INDEX IF NOT EXISTS idx_funding_venue_token ON funding_rates_timeseries(venue, token);
CREATE INDEX IF NOT EXISTS idx_funding_timestamp ON funding_rates_timeseries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_funding_block ON funding_rates_timeseries(block_number DESC);

-- Position events table
-- Tracks all position changes across venues
CREATE TABLE IF NOT EXISTS position_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  event_type TEXT NOT NULL,
  position_key TEXT NOT NULL,
  user_address TEXT NOT NULL,
  token TEXT NOT NULL,
  side TEXT NOT NULL,
  
  -- Position details
  size_usd DECIMAL(18,8),
  collateral_usd DECIMAL(18,8),
  leverage DECIMAL(5,2),
  entry_price DECIMAL(18,8),
  exit_price DECIMAL(18,8),
  liquidation_price DECIMAL(18,8),
  
  -- PnL tracking
  pnl_usd DECIMAL(18,8),
  fees_usd DECIMAL(18,8),
  funding_paid DECIMAL(18,8),
  
  -- Timestamps and references
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_number BIGINT,
  tx_hash TEXT,
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('open', 'close', 'increase', 'decrease', 'liquidate')),
  CONSTRAINT valid_side CHECK (side IN ('long', 'short'))
);

-- Indexes for position queries
CREATE INDEX IF NOT EXISTS idx_positions_venue ON position_events(venue);
CREATE INDEX IF NOT EXISTS idx_positions_user ON position_events(user_address);
CREATE INDEX IF NOT EXISTS idx_positions_token ON position_events(token);
CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON position_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_block ON position_events(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_positions_type ON position_events(event_type);
CREATE INDEX IF NOT EXISTS idx_positions_key ON position_events(position_key);

-- Liquidity snapshots
-- Tracks available liquidity across venues
CREATE TABLE IF NOT EXISTS liquidity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  token TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Liquidity metrics
  available_liquidity DECIMAL(18,8),
  utilized_liquidity DECIMAL(18,8),
  utilization_rate DECIMAL(5,2),
  
  -- Pool metrics
  total_pool_value DECIMAL(18,8),
  long_exposure DECIMAL(18,8),
  short_exposure DECIMAL(18,8),
  
  -- Block reference
  block_number BIGINT,
  
  CONSTRAINT unique_liquidity_snapshot UNIQUE (venue, token, timestamp)
);

-- Indexes for liquidity queries
CREATE INDEX IF NOT EXISTS idx_liquidity_venue_token ON liquidity_snapshots(venue, token);
CREATE INDEX IF NOT EXISTS idx_liquidity_timestamp ON liquidity_snapshots(timestamp DESC);

-- Indexed blocks tracking (for reorg handling)
CREATE TABLE IF NOT EXISTS indexed_blocks (
  block_number BIGINT PRIMARY KEY,
  block_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  events_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_blocks_hash ON indexed_blocks(block_hash);

-- Hourly funding rate aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS funding_rates_hourly AS
SELECT 
  venue,
  token,
  date_trunc('hour', timestamp) AS hour,
  AVG(funding_rate) AS avg_funding_rate,
  MAX(funding_rate) AS max_funding_rate,
  MIN(funding_rate) AS min_funding_rate,
  AVG(long_oi) AS avg_long_oi,
  AVG(short_oi) AS avg_short_oi
FROM funding_rates_timeseries
GROUP BY venue, token, date_trunc('hour', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_hourly_pk 
  ON funding_rates_hourly(venue, token, hour);

-- Daily volume aggregation per venue
CREATE MATERIALIZED VIEW IF NOT EXISTS venue_daily_volume AS
SELECT 
  venue,
  token,
  date_trunc('day', timestamp) AS day,
  COUNT(*) FILTER (WHERE event_type = 'open') AS opens,
  COUNT(*) FILTER (WHERE event_type = 'close') AS closes,
  COUNT(*) FILTER (WHERE event_type = 'liquidate') AS liquidations,
  SUM(size_usd) AS total_volume,
  SUM(fees_usd) AS total_fees,
  SUM(pnl_usd) AS total_pnl
FROM position_events
GROUP BY venue, token, date_trunc('day', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_daily_pk 
  ON venue_daily_volume(venue, token, day);

-- Function to get current funding rates
CREATE OR REPLACE FUNCTION get_current_funding_rates(p_venue TEXT DEFAULT NULL)
RETURNS TABLE(
  venue TEXT,
  token TEXT,
  funding_rate DECIMAL,
  long_oi DECIMAL,
  short_oi DECIMAL,
  oi_imbalance DECIMAL,
  last_updated TIMESTAMPTZ
) AS $$
  SELECT DISTINCT ON (fr.venue, fr.token)
    fr.venue,
    fr.token,
    fr.funding_rate,
    fr.long_oi,
    fr.short_oi,
    fr.oi_imbalance,
    fr.timestamp AS last_updated
  FROM funding_rates_timeseries fr
  WHERE (p_venue IS NULL OR fr.venue = p_venue)
  ORDER BY fr.venue, fr.token, fr.timestamp DESC;
$$ LANGUAGE SQL;

-- Function to get venue liquidity
CREATE OR REPLACE FUNCTION get_venue_liquidity(p_venue TEXT, p_token TEXT DEFAULT NULL)
RETURNS TABLE(
  token TEXT,
  available_liquidity DECIMAL,
  utilized_liquidity DECIMAL,
  utilization_rate DECIMAL,
  total_pool_value DECIMAL
) AS $$
  SELECT DISTINCT ON (ls.token)
    ls.token,
    ls.available_liquidity,
    ls.utilized_liquidity,
    ls.utilization_rate,
    ls.total_pool_value
  FROM liquidity_snapshots ls
  WHERE ls.venue = p_venue
    AND (p_token IS NULL OR ls.token = p_token)
  ORDER BY ls.token, ls.timestamp DESC;
$$ LANGUAGE SQL;

-- Function to handle reorgs
CREATE OR REPLACE FUNCTION handle_reorg(from_block BIGINT)
RETURNS void AS $$
BEGIN
  -- Delete events from reorged blocks
  DELETE FROM position_events WHERE block_number >= from_block;
  DELETE FROM funding_rates_timeseries WHERE block_number >= from_block;
  DELETE FROM liquidity_snapshots WHERE block_number >= from_block;
  DELETE FROM indexed_blocks WHERE block_number >= from_block;
  
  -- Log the reorg
  RAISE NOTICE 'Reorg handled: deleted all data from block % onwards', from_block;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE funding_rates_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexed_blocks ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read funding_rates" ON funding_rates_timeseries FOR SELECT USING (true);
CREATE POLICY "Public read position_events" ON position_events FOR SELECT USING (true);
CREATE POLICY "Public read liquidity_snapshots" ON liquidity_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read indexed_blocks" ON indexed_blocks FOR SELECT USING (true);

-- Service write policies
CREATE POLICY "Service write funding_rates" ON funding_rates_timeseries FOR ALL USING (true);
CREATE POLICY "Service write position_events" ON position_events FOR ALL USING (true);
CREATE POLICY "Service write liquidity_snapshots" ON liquidity_snapshots FOR ALL USING (true);
CREATE POLICY "Service write indexed_blocks" ON indexed_blocks FOR ALL USING (true);
