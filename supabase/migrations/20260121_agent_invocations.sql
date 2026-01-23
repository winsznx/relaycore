-- Agent Invocations Table
-- Tracks every agent execution with full context

CREATE TABLE IF NOT EXISTS agent_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    
    -- Execution context
    input JSONB NOT NULL,
    output JSONB,
    user_address TEXT,
    
    -- Payment tracking
    payment_id TEXT,
    tx_hash TEXT,
    
    -- Performance metrics
    execution_time_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_invocations_service ON agent_invocations(service_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_agent ON agent_invocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_user ON agent_invocations(user_address);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_payment ON agent_invocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_created ON agent_invocations(created_at DESC);

-- Enable RLS
ALTER TABLE agent_invocations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read invocations
CREATE POLICY "Allow read access to invocations"
    ON agent_invocations
    FOR SELECT
    USING (true);

-- Policy: Service can insert invocations
CREATE POLICY "Allow insert invocations"
    ON agent_invocations
    FOR INSERT
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE agent_invocations IS 'Records every agent invocation with payment and performance tracking';
