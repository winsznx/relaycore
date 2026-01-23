-- Escrow Session Indexer Tables
-- Migration for production-grade agentic flow tracking

-- Escrow Sessions Table
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

-- Escrow Session Events (audit trail)
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

-- Indexes for escrow_session_events
CREATE INDEX IF NOT EXISTS idx_session_events_session ON escrow_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_actor ON escrow_session_events(actor_address);
CREATE INDEX IF NOT EXISTS idx_session_events_type ON escrow_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_events_created ON escrow_session_events(created_at DESC);

-- Escrow Session Agents (authorized agents per session)
CREATE TABLE IF NOT EXISTS escrow_session_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES escrow_sessions(session_id),
    agent_address TEXT NOT NULL,
    is_authorized BOOLEAN NOT NULL DEFAULT true,
    authorized_at TIMESTAMPTZ NOT NULL,
    auth_tx_hash TEXT NOT NULL,
    auth_block INTEGER NOT NULL,
    revoked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, agent_address)
);

-- Indexes for escrow_session_agents
CREATE INDEX IF NOT EXISTS idx_session_agents_session ON escrow_session_agents(session_id);
CREATE INDEX IF NOT EXISTS idx_session_agents_agent ON escrow_session_agents(agent_address);
CREATE INDEX IF NOT EXISTS idx_session_agents_authorized ON escrow_session_agents(is_authorized) WHERE is_authorized = true;

-- Agent Earnings (aggregate earnings from escrow payments)
CREATE TABLE IF NOT EXISTS agent_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT UNIQUE NOT NULL,
    total_earned TEXT NOT NULL DEFAULT '0',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for agent_earnings
CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent ON agent_earnings(agent_address);

-- Pending Transactions (for handoff signing pattern)
CREATE TABLE IF NOT EXISTS pending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL,
    to_address TEXT NOT NULL,
    data TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'broadcast', 'confirmed', 'failed', 'expired')),
    tool TEXT NOT NULL,
    description TEXT,
    params JSONB,
    session_id TEXT,
    agent_id TEXT,
    signer_address TEXT,
    tx_hash TEXT,
    block_number INTEGER,
    block_hash TEXT,
    gas_used TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    signed_at TIMESTAMPTZ,
    broadcast_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ
);

-- Indexes for pending_transactions
CREATE INDEX IF NOT EXISTS idx_pending_tx_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pending_tx_session ON pending_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_tx_agent ON pending_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_pending_tx_created ON pending_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_tx_expires ON pending_transactions(expires_at) WHERE status = 'pending';

-- Handoff Transaction State History (for auditing)
CREATE TABLE IF NOT EXISTS pending_tx_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL REFERENCES pending_transactions(transaction_id),
    status TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_state_history_tx ON pending_tx_state_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_state_history_created ON pending_tx_state_history(created_at DESC);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE escrow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_session_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tx_state_history ENABLE ROW LEVEL SECURITY;

-- Public read access (for indexer and dashboard)
CREATE POLICY "Allow public read on escrow_sessions" ON escrow_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public read on escrow_session_events" ON escrow_session_events FOR SELECT USING (true);
CREATE POLICY "Allow public read on escrow_session_agents" ON escrow_session_agents FOR SELECT USING (true);
CREATE POLICY "Allow public read on agent_earnings" ON agent_earnings FOR SELECT USING (true);
CREATE POLICY "Allow public read on pending_transactions" ON pending_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public read on pending_tx_state_history" ON pending_tx_state_history FOR SELECT USING (true);

-- Service role write access (for indexer)
CREATE POLICY "Allow service write on escrow_sessions" ON escrow_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on escrow_session_events" ON escrow_session_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on escrow_session_agents" ON escrow_session_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on agent_earnings" ON agent_earnings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on pending_transactions" ON pending_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on pending_tx_state_history" ON pending_tx_state_history FOR ALL USING (true) WITH CHECK (true);

-- Functions for real-time subscriptions
CREATE OR REPLACE FUNCTION notify_session_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('session_changes', json_build_object(
        'operation', TG_OP,
        'session_id', COALESCE(NEW.session_id, OLD.session_id),
        'is_active', NEW.is_active,
        'timestamp', NOW()
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escrow_session_changes
AFTER INSERT OR UPDATE ON escrow_sessions
FOR EACH ROW EXECUTE FUNCTION notify_session_change();

CREATE OR REPLACE FUNCTION notify_payment_release()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'RELEASE' THEN
        PERFORM pg_notify('payment_releases', json_build_object(
            'session_id', NEW.session_id,
            'agent', NEW.actor_address,
            'amount', NEW.amount,
            'tx_hash', NEW.tx_hash,
            'timestamp', NOW()
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_payment_releases
AFTER INSERT ON escrow_session_events
FOR EACH ROW EXECUTE FUNCTION notify_payment_release();

COMMENT ON TABLE escrow_sessions IS 'Escrow payment sessions for agent hiring - indexed from EscrowSession.sol events';
COMMENT ON TABLE escrow_session_events IS 'Audit trail of all escrow session events for real-time flow tracking';
COMMENT ON TABLE escrow_session_agents IS 'Agent authorization records per session';
COMMENT ON TABLE agent_earnings IS 'Aggregate earnings for each agent from escrow payments';
COMMENT ON TABLE pending_transactions IS 'Unsigned transactions awaiting user signature via handoff URLs';
COMMENT ON TABLE pending_tx_state_history IS 'State transition history for pending transactions';

-- ============================================
-- ON-CHAIN TRANSACTION INDEX
-- ============================================

-- All on-chain transactions from handoff signing
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

-- Indexes for on_chain_transactions
CREATE INDEX IF NOT EXISTS idx_onchain_tx_hash ON on_chain_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_block ON on_chain_transactions(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_from ON on_chain_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_to ON on_chain_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_session ON on_chain_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_agent ON on_chain_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_tool ON on_chain_transactions(tool);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_timestamp ON on_chain_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_onchain_tx_status ON on_chain_transactions(status);

-- ============================================
-- X402 FACILITATOR PAYMENT INDEX
-- ============================================

-- All x402 payments processed through the Crypto.com Facilitator
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
    
    -- Payment details
    resource_id TEXT,
    resource_url TEXT,
    payment_header TEXT,
    
    -- Facilitator response
    facilitator_response JSONB,
    settlement_tx_hash TEXT,
    settlement_block INTEGER,
    
    -- Associated agent/session
    agent_id TEXT,
    session_id TEXT,
    tool TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for x402_payments
CREATE INDEX IF NOT EXISTS idx_x402_payment_id ON x402_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_x402_payer ON x402_payments(payer_address);
CREATE INDEX IF NOT EXISTS idx_x402_payee ON x402_payments(payee_address);
CREATE INDEX IF NOT EXISTS idx_x402_agent ON x402_payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_x402_session ON x402_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_x402_status ON x402_payments(status);
CREATE INDEX IF NOT EXISTS idx_x402_created ON x402_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_x402_settled ON x402_payments(settled_at DESC);

-- ============================================
-- MCP TOOL INVOCATION LOG
-- ============================================

-- All MCP tool invocations for audit/analytics
CREATE TABLE IF NOT EXISTS mcp_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invocation_id TEXT UNIQUE NOT NULL,
    tool_name TEXT NOT NULL,
    params JSONB NOT NULL,
    result_status TEXT NOT NULL CHECK (result_status IN ('success', 'error')),
    result_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    
    -- Context
    agent_id TEXT,
    session_id TEXT,
    user_address TEXT,
    
    -- If tool resulted in transaction
    pending_tx_id TEXT,
    on_chain_tx_hash TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for mcp_invocations
CREATE INDEX IF NOT EXISTS idx_mcp_tool ON mcp_invocations(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_agent ON mcp_invocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_session ON mcp_invocations(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_status ON mcp_invocations(result_status);
CREATE INDEX IF NOT EXISTS idx_mcp_created ON mcp_invocations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_tx ON mcp_invocations(on_chain_tx_hash);

-- RLS for new tables
ALTER TABLE on_chain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on on_chain_transactions" ON on_chain_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public read on x402_payments" ON x402_payments FOR SELECT USING (true);
CREATE POLICY "Allow public read on mcp_invocations" ON mcp_invocations FOR SELECT USING (true);

CREATE POLICY "Allow service write on on_chain_transactions" ON on_chain_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on x402_payments" ON x402_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service write on mcp_invocations" ON mcp_invocations FOR ALL USING (true) WITH CHECK (true);

-- Real-time notification for new transactions
CREATE OR REPLACE FUNCTION notify_new_transaction()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_transaction', json_build_object(
        'tx_hash', NEW.tx_hash,
        'tool', NEW.tool,
        'status', NEW.status,
        'agent_id', NEW.agent_id,
        'timestamp', NOW()
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_chain_tx_notify
AFTER INSERT ON on_chain_transactions
FOR EACH ROW EXECUTE FUNCTION notify_new_transaction();

-- Real-time notification for x402 settlements
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

CREATE TRIGGER x402_payment_settled
AFTER UPDATE ON x402_payments
FOR EACH ROW EXECUTE FUNCTION notify_payment_settled();

COMMENT ON TABLE on_chain_transactions IS 'All confirmed on-chain transactions from handoff signing flow';
COMMENT ON TABLE x402_payments IS 'All x402 payments processed through Crypto.com Facilitator';
COMMENT ON TABLE mcp_invocations IS 'Audit log of all MCP tool invocations for analytics and debugging';
