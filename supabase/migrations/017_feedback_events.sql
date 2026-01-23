-- Feedback Events Table
-- Tracks user feedback for services and agents

CREATE TABLE IF NOT EXISTS feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    agent_address TEXT,
    user_address TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    execution_id TEXT,
    payment_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_service ON feedback_events(service_id);
CREATE INDEX IF NOT EXISTS idx_feedback_agent ON feedback_events(agent_address);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_events(user_address);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_events(created_at DESC);

-- RLS
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read feedback" ON feedback_events FOR SELECT USING (true);

-- Service role write (using is_service_role function)
CREATE POLICY "Service write feedback" ON feedback_events FOR ALL
USING (is_service_role()) WITH CHECK (is_service_role());

-- Ensure update_updated_at_column function has proper security
-- (This is idempotent - safe to run even if already fixed)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY INVOKER
SET search_path = public;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS feedback_events_updated_at ON feedback_events;
CREATE TRIGGER feedback_events_updated_at
    BEFORE UPDATE ON feedback_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
