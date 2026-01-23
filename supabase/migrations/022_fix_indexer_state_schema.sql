-- Ensure indexer_state table has correct schema
-- This is idempotent and safe to run multiple times

-- Drop and recreate if schema is wrong
DROP TABLE IF EXISTS indexer_state CASCADE;

CREATE TABLE indexer_state (
    indexer_name TEXT PRIMARY KEY,
    last_block BIGINT NOT NULL DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "indexer_state_select" ON indexer_state
    FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "indexer_state_insert" ON indexer_state
    FOR INSERT WITH CHECK (is_service_role());

CREATE POLICY "indexer_state_update" ON indexer_state
    FOR UPDATE USING (is_service_role()) WITH CHECK (is_service_role());

-- Trigger for updated_at
CREATE TRIGGER update_indexer_state_updated_at
    BEFORE UPDATE ON indexer_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
