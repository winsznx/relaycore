-- RWA State Machine Tables
-- Production-grade schema for agent-mediated RWA settlement

-- State machines table
CREATE TABLE IF NOT EXISTS rwa_state_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rwa_id TEXT UNIQUE NOT NULL,
    current_state TEXT NOT NULL,
    previous_state TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- State transitions table
CREATE TABLE IF NOT EXISTS rwa_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rwa_id TEXT NOT NULL REFERENCES rwa_state_machines(rwa_id),
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    agent_address TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    payment_hash TEXT NOT NULL,
    proof JSONB DEFAULT '{}'::jsonb,
    transitioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent assignments table
CREATE TABLE IF NOT EXISTS rwa_agent_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rwa_id TEXT NOT NULL REFERENCES rwa_state_machines(rwa_id),
    agent_address TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rwa_state_machines_rwa_id ON rwa_state_machines(rwa_id);
CREATE INDEX IF NOT EXISTS idx_rwa_state_machines_current_state ON rwa_state_machines(current_state);
CREATE INDEX IF NOT EXISTS idx_rwa_state_transitions_rwa_id ON rwa_state_transitions(rwa_id);
CREATE INDEX IF NOT EXISTS idx_rwa_state_transitions_agent ON rwa_state_transitions(agent_address);
CREATE INDEX IF NOT EXISTS idx_rwa_agent_assignments_rwa_id ON rwa_agent_assignments(rwa_id);
CREATE INDEX IF NOT EXISTS idx_rwa_agent_assignments_agent ON rwa_agent_assignments(agent_address);

-- RLS policies
ALTER TABLE rwa_state_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_agent_assignments ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to state machines" ON rwa_state_machines
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to transitions" ON rwa_state_transitions
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to assignments" ON rwa_agent_assignments
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access to state machines" ON rwa_state_machines
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to transitions" ON rwa_state_transitions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to assignments" ON rwa_agent_assignments
    FOR ALL USING (auth.role() = 'service_role');
