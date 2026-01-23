-- RWA Indexer Support Tables
-- Additional tables for RWA state tracking, metrics, and alerts

-- Agent performance metrics
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_address, metric_type, recorded_at)
);

-- RWA alerts for stale states and issues
CREATE TABLE IF NOT EXISTS rwa_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rwa_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- RWA metrics aggregation
CREATE TABLE IF NOT EXISTS rwa_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL UNIQUE,
    total_transitions INTEGER DEFAULT 0,
    state_distribution JSONB DEFAULT '{}'::jsonb,
    role_distribution JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent ON agent_performance_metrics(agent_address);
CREATE INDEX IF NOT EXISTS idx_agent_performance_type ON agent_performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_rwa_alerts_rwa_id ON rwa_alerts(rwa_id);
CREATE INDEX IF NOT EXISTS idx_rwa_alerts_resolved ON rwa_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_rwa_metrics_date ON rwa_metrics(metric_date);

-- RLS policies
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to performance metrics" ON agent_performance_metrics
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to alerts" ON rwa_alerts
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to metrics" ON rwa_metrics
    FOR SELECT USING (true);

CREATE POLICY "Service role full access to performance metrics" ON agent_performance_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to alerts" ON rwa_alerts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to metrics" ON rwa_metrics
    FOR ALL USING (auth.role() = 'service_role');
