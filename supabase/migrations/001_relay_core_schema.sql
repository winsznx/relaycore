-- Relay Core Database Schema
-- Phase 1: x402 Payments
-- Phase 2: Event Indexing & Reputation

-- ============================================
-- PAYMENTS TABLE (Phase 1)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
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

CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_from_address ON payments(from_address);
CREATE INDEX IF NOT EXISTS idx_payments_to_address ON payments(to_address);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_resource_url ON payments(resource_url);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp DESC);

-- ============================================
-- INDEXER STATE (Phase 2)
-- ============================================
CREATE TABLE IF NOT EXISTS indexer_state (
  indexer_name TEXT PRIMARY KEY,
  last_block BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENT ACTIVITY (Phase 2)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_address TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  metadata JSONB,
  block_number BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_address ON agent_activity(agent_address);
CREATE INDEX IF NOT EXISTS idx_agent_activity_type ON agent_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_agent_activity_timestamp ON agent_activity(timestamp DESC);

-- Unique constraint for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_activity_unique 
  ON agent_activity(agent_address, activity_type, timestamp);

-- ============================================
-- AGENT REPUTATION (Phase 2)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_reputation (
  agent_address TEXT PRIMARY KEY,
  reputation_score NUMERIC NOT NULL DEFAULT 0,
  total_payments_sent TEXT DEFAULT '0',
  total_payments_received TEXT DEFAULT '0',
  successful_transactions INT DEFAULT 0,
  failed_transactions INT DEFAULT 0,
  last_active TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reputation_score ON agent_reputation(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reputation_last_active ON agent_reputation(last_active DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reputation ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
DROP POLICY IF EXISTS "Public read access" ON payments;
CREATE POLICY "Public read access" ON payments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON indexer_state;
CREATE POLICY "Public read access" ON indexer_state
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON agent_activity;
CREATE POLICY "Public read access" ON agent_activity
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON agent_reputation;
CREATE POLICY "Public read access" ON agent_reputation
  FOR SELECT USING (true);

-- Service role can insert/update (for backend indexers)
DROP POLICY IF EXISTS "Service role can insert" ON payments;
CREATE POLICY "Service role can insert" ON payments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update" ON payments;
CREATE POLICY "Service role can update" ON payments
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Service role can insert" ON indexer_state;
CREATE POLICY "Service role can insert" ON indexer_state
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update" ON indexer_state;
CREATE POLICY "Service role can update" ON indexer_state
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Service role can insert" ON agent_activity;
CREATE POLICY "Service role can insert" ON agent_activity
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update" ON agent_activity;
CREATE POLICY "Service role can update" ON agent_activity
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Service role can insert" ON agent_reputation;
CREATE POLICY "Service role can insert" ON agent_reputation
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update" ON agent_reputation;
CREATE POLICY "Service role can update" ON agent_reputation
  FOR UPDATE USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_indexer_state_updated_at ON indexer_state;
CREATE TRIGGER update_indexer_state_updated_at
  BEFORE UPDATE ON indexer_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_reputation_updated_at ON agent_reputation;
CREATE TRIGGER update_agent_reputation_updated_at
  BEFORE UPDATE ON agent_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
