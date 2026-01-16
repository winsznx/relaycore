-- ACPS: Agent-Controlled Payment Sessions
-- Migration for escrow session tracking

-- Escrow Sessions table
CREATE TABLE IF NOT EXISTS escrow_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id INTEGER UNIQUE NOT NULL,
    owner_address TEXT,
    escrow_agent_address TEXT,
    max_spend DECIMAL(20, 6) NOT NULL,
    deposited DECIMAL(20, 6) DEFAULT 0,
    released DECIMAL(20, 6) DEFAULT 0,
    duration_seconds INTEGER NOT NULL,
    expires_at TIMESTAMPTZ,
    authorized_agents TEXT[],
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed', 'expired')),
    contract_address TEXT,
    creation_tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT positive_max_spend CHECK (max_spend > 0)
);

-- Escrow Payments table (tracks individual releases)
CREATE TABLE IF NOT EXISTS escrow_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id INTEGER NOT NULL REFERENCES escrow_sessions(session_id),
    agent_address TEXT NOT NULL,
    amount DECIMAL(20, 6) NOT NULL,
    execution_id TEXT UNIQUE NOT NULL,
    tx_hash TEXT,
    block_number INTEGER,
    status TEXT DEFAULT 'released' CHECK (status IN ('pending', 'released', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Escrow Refunds table
CREATE TABLE IF NOT EXISTS escrow_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id INTEGER NOT NULL REFERENCES escrow_sessions(session_id),
    amount DECIMAL(20, 6) NOT NULL,
    tx_hash TEXT,
    block_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escrow Audit Log table (security tracking)
CREATE TABLE IF NOT EXISTS escrow_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    session_id INTEGER NOT NULL,
    agent_address TEXT,
    amount DECIMAL(20, 6),
    execution_id TEXT,
    status TEXT,
    tx_hash TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_escrow_sessions_status ON escrow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_sessions_owner ON escrow_sessions(owner_address);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_session ON escrow_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_agent ON escrow_payments(agent_address);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_execution ON escrow_payments(execution_id);
CREATE INDEX IF NOT EXISTS idx_escrow_audit_session ON escrow_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_escrow_audit_action ON escrow_audit_log(action);

-- RLS Policies
ALTER TABLE escrow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow public read for sessions (agents need to check status)
CREATE POLICY "Public read escrow sessions" ON escrow_sessions
    FOR SELECT USING (true);

-- Allow public read for payments (for transparency)
CREATE POLICY "Public read escrow payments" ON escrow_payments
    FOR SELECT USING (true);

-- Allow public read for refunds
CREATE POLICY "Public read escrow refunds" ON escrow_refunds
    FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service insert escrow sessions" ON escrow_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update escrow sessions" ON escrow_sessions
    FOR UPDATE USING (true);

CREATE POLICY "Service insert escrow payments" ON escrow_payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service insert escrow refunds" ON escrow_refunds
    FOR INSERT WITH CHECK (true);

-- View for session summaries
CREATE OR REPLACE VIEW escrow_session_summary AS
SELECT 
    es.session_id,
    es.owner_address,
    es.max_spend,
    es.deposited,
    es.released,
    (es.deposited - es.released) as remaining,
    es.status,
    es.expires_at,
    es.created_at,
    COUNT(ep.id) as payment_count,
    COALESCE(SUM(ep.amount), 0) as total_paid,
    COUNT(DISTINCT ep.agent_address) as unique_agents
FROM escrow_sessions es
LEFT JOIN escrow_payments ep ON es.session_id = ep.session_id
GROUP BY es.session_id, es.owner_address, es.max_spend, es.deposited, 
         es.released, es.status, es.expires_at, es.created_at;

-- Function to check session allowance
CREATE OR REPLACE FUNCTION check_session_allowance(
    p_session_id INTEGER,
    p_agent_address TEXT,
    p_amount DECIMAL
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    remaining DECIMAL
) AS $$
DECLARE
    v_session escrow_sessions%ROWTYPE;
    v_remaining DECIMAL;
    v_is_authorized BOOLEAN;
BEGIN
    SELECT * INTO v_session FROM escrow_sessions WHERE session_id = p_session_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Session not found'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;
    
    IF v_session.status != 'active' THEN
        RETURN QUERY SELECT false, 'Session not active'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;
    
    IF v_session.expires_at < NOW() THEN
        RETURN QUERY SELECT false, 'Session expired'::TEXT, 0::DECIMAL;
        RETURN;
    END IF;
    
    v_remaining := v_session.deposited - v_session.released;
    
    IF p_amount > v_remaining THEN
        RETURN QUERY SELECT false, 'Insufficient balance'::TEXT, v_remaining;
        RETURN;
    END IF;
    
    -- Check if agent is authorized (or if 'any' is in the list)
    v_is_authorized := 'any' = ANY(v_session.authorized_agents) OR 
                       p_agent_address = ANY(v_session.authorized_agents);
    
    IF NOT v_is_authorized THEN
        RETURN QUERY SELECT false, 'Agent not authorized'::TEXT, v_remaining;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, NULL::TEXT, v_remaining;
END;
$$ LANGUAGE plpgsql;
