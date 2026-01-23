-- Fix indexer schema issues
-- Add missing last_run_at column to indexer_state
-- Create pending_transactions table

ALTER TABLE indexer_state ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pending_transactions (
    transaction_id TEXT PRIMARY KEY,
    tx_hash TEXT,
    status TEXT NOT NULL CHECK (status IN ('created', 'broadcast', 'pending', 'confirmed', 'failed', 'expired')),
    chain_id INTEGER NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT,
    value TEXT DEFAULT '0',
    data TEXT,
    gas_limit TEXT,
    gas_price TEXT,
    nonce INTEGER,
    tool TEXT NOT NULL,
    session_id TEXT,
    agent_id TEXT,
    block_number INTEGER,
    block_hash TEXT,
    gas_used TEXT,
    confirmed_at TIMESTAMPTZ,
    error_message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_tx_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pending_tx_session ON pending_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_tx_created ON pending_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_pending_tx_hash ON pending_transactions(tx_hash);

CREATE TABLE IF NOT EXISTS pending_tx_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_tx_history_tx ON pending_tx_state_history(transaction_id);

CREATE TABLE IF NOT EXISTS on_chain_transactions (
    tx_hash TEXT PRIMARY KEY,
    chain_id INTEGER NOT NULL,
    block_number INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT,
    value TEXT NOT NULL,
    gas_used TEXT NOT NULL,
    gas_price TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    timestamp TIMESTAMPTZ NOT NULL,
    tool TEXT,
    session_id TEXT,
    agent_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onchain_tx_block ON on_chain_transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_timestamp ON on_chain_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_hash ON on_chain_transactions(tx_hash);

CREATE TRIGGER update_pending_transactions_updated_at
    BEFORE UPDATE ON pending_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tx_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_chain_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_transactions_select" ON pending_transactions
    FOR SELECT USING (true);

CREATE POLICY "pending_transactions_insert" ON pending_transactions
    FOR INSERT WITH CHECK (is_service_role());

CREATE POLICY "pending_transactions_update" ON pending_transactions
    FOR UPDATE USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "pending_tx_history_select" ON pending_tx_state_history
    FOR SELECT USING (true);

CREATE POLICY "pending_tx_history_insert" ON pending_tx_state_history
    FOR INSERT WITH CHECK (is_service_role());

CREATE POLICY "onchain_tx_select" ON on_chain_transactions
    FOR SELECT USING (true);

CREATE POLICY "onchain_tx_insert" ON on_chain_transactions
    FOR INSERT WITH CHECK (is_service_role());
