-- Add missing columns to existing agent_activity table
ALTER TABLE agent_activity 
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Update activity_type constraint to include new types
ALTER TABLE agent_activity 
  DROP CONSTRAINT IF EXISTS agent_activity_activity_type_check;

ALTER TABLE agent_activity 
  ADD CONSTRAINT agent_activity_activity_type_check 
  CHECK (activity_type IN ('service_registration', 'service_call', 'validation', 'trade', 'other'));

-- RLS policies (using DROP/CREATE pattern)
DROP POLICY IF EXISTS "Public read agent_activity" ON agent_activity;
CREATE POLICY "Public read agent_activity" ON agent_activity 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service write agent_activity" ON agent_activity;
CREATE POLICY "Service write agent_activity" ON agent_activity 
    FOR ALL 
    USING (true);

-- Create additional indexes (note: some may already exist from 001_relay_core_schema.sql)
CREATE INDEX IF NOT EXISTS idx_agent_activity_service ON agent_activity(service_name) WHERE service_name IS NOT NULL;
