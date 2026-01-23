-- Task Artifacts Table
-- Stores all task execution history for auditability and replay-safety

CREATE TABLE IF NOT EXISTS task_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT UNIQUE NOT NULL,
    agent_id TEXT NOT NULL,
    service_id TEXT,
    session_id UUID REFERENCES escrow_sessions(id),
    state TEXT NOT NULL CHECK (state IN ('idle', 'pending', 'settled', 'failed')),
    payment_id TEXT,
    facilitator_tx TEXT,
    retries INTEGER DEFAULT 0,
    inputs JSONB DEFAULT '{}',
    outputs JSONB DEFAULT '{}',
    error JSONB,
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_agent ON task_artifacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_service ON task_artifacts(service_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_session ON task_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_state ON task_artifacts(state);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_payment ON task_artifacts(payment_id);
CREATE INDEX IF NOT EXISTS idx_task_artifacts_created ON task_artifacts(created_at DESC);

-- Function to increment retries
CREATE OR REPLACE FUNCTION increment_task_retries(p_task_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE task_artifacts
    SET retries = retries + 1,
        updated_at = NOW()
    WHERE task_id = p_task_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- RLS Policies
ALTER TABLE task_artifacts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own tasks
CREATE POLICY "Users can view own tasks" ON task_artifacts
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Service role has full access" ON task_artifacts
    FOR ALL USING (true);

-- Trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER task_artifacts_updated_at
    BEFORE UPDATE ON task_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_task_updated_at();

-- Comments for documentation
COMMENT ON TABLE task_artifacts IS 'Stores all task execution artifacts for auditability';
COMMENT ON COLUMN task_artifacts.task_id IS 'Unique task identifier (task_xxx)';
COMMENT ON COLUMN task_artifacts.agent_id IS 'Agent or wallet address that initiated the task';
COMMENT ON COLUMN task_artifacts.state IS 'Current state: idle, pending, settled, failed';
COMMENT ON COLUMN task_artifacts.payment_id IS 'x402 payment ID if payment was made';
COMMENT ON COLUMN task_artifacts.facilitator_tx IS 'Facilitator transaction hash';
COMMENT ON COLUMN task_artifacts.inputs IS 'Task input parameters';
COMMENT ON COLUMN task_artifacts.outputs IS 'Task output/result data';
COMMENT ON COLUMN task_artifacts.error IS 'Error details if task failed';
COMMENT ON COLUMN task_artifacts.metrics IS 'Performance metrics (duration, etc)';
