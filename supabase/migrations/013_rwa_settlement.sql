-- RWA Settlement: Real-world service execution tracking
-- Migration for RWA execution requests

-- RWA Execution Requests table
CREATE TABLE IF NOT EXISTS rwa_execution_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT UNIQUE NOT NULL,
    service_id TEXT NOT NULL,
    session_id INTEGER NOT NULL,
    agent_address TEXT NOT NULL,
    input JSONB,
    price DECIMAL(20, 6) NOT NULL,
    sla_terms JSONB NOT NULL,
    proof JSONB,
    verification JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'settled', 'refunded')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    CONSTRAINT positive_price CHECK (price > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rwa_requests_service ON rwa_execution_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_rwa_requests_session ON rwa_execution_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_rwa_requests_status ON rwa_execution_requests(status);
CREATE INDEX IF NOT EXISTS idx_rwa_requests_agent ON rwa_execution_requests(agent_address);

-- RLS
ALTER TABLE rwa_execution_requests ENABLE ROW LEVEL SECURITY;

-- Public read for transparency
CREATE POLICY "Public read rwa requests" ON rwa_execution_requests
    FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service insert rwa requests" ON rwa_execution_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update rwa requests" ON rwa_execution_requests
    FOR UPDATE USING (true);

-- View for RWA service summary
CREATE OR REPLACE VIEW rwa_service_stats AS
SELECT 
    service_id,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status = 'settled') as successful_settlements,
    COUNT(*) FILTER (WHERE status = 'refunded') as refunds,
    AVG((verification->>'slaMetrics'->>'latencyMs')::numeric) as avg_latency_ms,
    SUM(price) FILTER (WHERE status = 'settled') as total_revenue
FROM rwa_execution_requests
GROUP BY service_id;

-- View for Escrow sessions (indexer/explorer observability)
CREATE OR REPLACE VIEW escrow_session_live AS
SELECT 
    es.session_id,
    es.owner_address,
    es.max_spend,
    es.deposited,
    es.released,
    (es.deposited - es.released) as remaining_balance,
    es.status,
    es.expires_at,
    es.created_at,
    CASE 
        WHEN es.status = 'closed' THEN 'Closed'
        WHEN es.expires_at < NOW() THEN 'Expired'
        WHEN es.deposited = 0 THEN 'Awaiting Deposit'
        ELSE 'Active'
    END as display_status,
    (SELECT COUNT(*) FROM escrow_payments ep WHERE ep.session_id = es.session_id) as payment_count,
    (SELECT COUNT(*) FROM escrow_audit_log al WHERE al.session_id = es.session_id) as audit_events
FROM escrow_sessions es;

