-- Create agent_invocations table
-- Run this ONCE in Supabase Dashboard > SQL Editor

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow read access to invocations" ON agent_invocations;
DROP POLICY IF EXISTS "Allow insert invocations" ON agent_invocations;

-- Create table (if not exists)
CREATE TABLE IF NOT EXISTS agent_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    user_address TEXT,
    payment_id TEXT,
    tx_hash TEXT,
    execution_time_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_invocations_service ON agent_invocations(service_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_agent ON agent_invocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_user ON agent_invocations(user_address);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_created ON agent_invocations(created_at DESC);

-- Enable RLS
ALTER TABLE agent_invocations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access to invocations"
    ON agent_invocations FOR SELECT USING (true);

CREATE POLICY "Allow insert invocations"
    ON agent_invocations FOR INSERT WITH CHECK (true);
