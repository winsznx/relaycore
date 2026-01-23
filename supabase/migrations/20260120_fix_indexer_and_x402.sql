-- FIX: Conflict resolution between Legacy and Indexer schemas
-- This migration ensures the database matches the production indexer requirements.

-- 1. Handle Legacy Escrow Sessions (Integer IDs vs Text IDs conflict)
DO $$ 
BEGIN
    -- Check if existing table uses INTEGER session_id (Legacy)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'escrow_sessions' 
        AND column_name = 'session_id' 
        AND data_type = 'integer'
    ) THEN
        -- Rename legacy table to backup
        ALTER TABLE escrow_sessions RENAME TO escrow_sessions_legacy_backup;
    END IF;
END $$;

-- 2. Create Escrow Sessions (Indexer Schema)
CREATE TABLE IF NOT EXISTS escrow_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    owner_address TEXT NOT NULL,
    escrow_agent TEXT NOT NULL,
    max_spend TEXT NOT NULL,
    expiry TIMESTAMPTZ NOT NULL,
    deposited TEXT NOT NULL DEFAULT '0',
    released TEXT NOT NULL DEFAULT '0',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_tx_hash TEXT NOT NULL,
    created_block INTEGER NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_tx_hash TEXT,
    closed_block INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for escrow_sessions
CREATE INDEX IF NOT EXISTS idx_escrow_sessions_owner ON escrow_sessions(owner_address);
CREATE INDEX IF NOT EXISTS idx_escrow_sessions_agent ON escrow_sessions(escrow_agent);
CREATE INDEX IF NOT EXISTS idx_escrow_sessions_active ON escrow_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_escrow_sessions_created ON escrow_sessions(created_at DESC);

-- 3. Escrow Session Events
CREATE TABLE IF NOT EXISTS escrow_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES escrow_sessions(session_id),
    event_type TEXT NOT NULL CHECK (event_type IN ('DEPOSIT', 'RELEASE', 'REFUND', 'CLOSE', 'AUTHORIZE', 'REVOKE')),
    actor_address TEXT,
    amount TEXT,
    execution_id TEXT,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tx_hash, event_type)
);

CREATE INDEX IF NOT EXISTS idx_session_events_session ON escrow_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_created ON escrow_session_events(created_at DESC);

-- 4. Agent Earnings
CREATE TABLE IF NOT EXISTS agent_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT UNIQUE NOT NULL,
    total_earned TEXT NOT NULL DEFAULT '0',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Pending Transactions (Handoff)
CREATE TABLE IF NOT EXISTS pending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    to_address TEXT NOT NULL,
    data TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'pending',
    tool TEXT NOT NULL,
    description TEXT,
    params JSONB,
    session_id TEXT,
    agent_id TEXT,
    signer_address TEXT,
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    signed_at TIMESTAMPTZ,
    broadcast_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ
);

-- 6. On-Chain Transactions
CREATE TABLE IF NOT EXISTS on_chain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash TEXT UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '0',
    gas_used TEXT NOT NULL,
    gas_price TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    timestamp TIMESTAMPTZ NOT NULL,
    tool TEXT NOT NULL,
    session_id TEXT,
    agent_id TEXT,
    pending_tx_id TEXT,
    input_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. X402 Payments (Critical for RWA)
CREATE TABLE IF NOT EXISTS x402_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id TEXT UNIQUE NOT NULL,
    facilitator_tx_hash TEXT,
    chain_id INTEGER NOT NULL,
    payer_address TEXT NOT NULL,
    payee_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    token_address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'settled', 'failed', 'refunded')),
    resource_id TEXT,
    resource_url TEXT,
    payment_header TEXT,
    facilitator_response JSONB,
    settlement_tx_hash TEXT,
    settlement_block INTEGER,
    agent_id TEXT,
    session_id TEXT,
    tool TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x402_payment_id ON x402_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_x402_status ON x402_payments(status);

-- 8. MCP Invocations
CREATE TABLE IF NOT EXISTS mcp_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invocation_id TEXT UNIQUE NOT NULL,
    tool_name TEXT NOT NULL,
    params JSONB NOT NULL,
    result_status TEXT NOT NULL CHECK (result_status IN ('success', 'error')),
    result_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    agent_id TEXT,
    session_id TEXT,
    user_address TEXT,
    pending_tx_id TEXT,
    on_chain_tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Triggers (Idempotent)
CREATE OR REPLACE FUNCTION notify_payment_settled()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
        PERFORM pg_notify('payment_settled', json_build_object(
            'payment_id', NEW.payment_id,
            'amount', NEW.amount,
            'payee', NEW.payee_address,
            'agent_id', NEW.agent_id,
            'timestamp', NOW()
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS x402_payment_settled ON x402_payments;
CREATE TRIGGER x402_payment_settled
AFTER UPDATE ON x402_payments
FOR EACH ROW EXECUTE FUNCTION notify_payment_settled();

-- Enable RLS (Safe to re-run)
ALTER TABLE escrow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_invocations ENABLE ROW LEVEL SECURITY;

-- Grants (Safe to re-run)
DO $$
BEGIN
    -- Public Read Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on x402_payments') THEN
        CREATE POLICY "Allow public read on x402_payments" ON x402_payments FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service write on x402_payments') THEN
        CREATE POLICY "Allow service write on x402_payments" ON x402_payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
