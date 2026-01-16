-- Create agent_activity table for tracking agent service registrations and activity
CREATE TABLE IF NOT EXISTS agent_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('service_registration', 'service_call', 'validation', 'trade', 'other')),
    service_name TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read agent_activity" ON agent_activity 
    FOR SELECT 
    USING (true);

-- Service write access
CREATE POLICY "Service write agent_activity" ON agent_activity 
    FOR ALL 
    USING (true);

-- Create indexes
CREATE INDEX idx_agent_activity_agent ON agent_activity(agent_id);
CREATE INDEX idx_agent_activity_type ON agent_activity(activity_type);
CREATE INDEX idx_agent_activity_timestamp ON agent_activity(timestamp DESC);
