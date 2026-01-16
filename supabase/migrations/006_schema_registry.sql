-- ============================================
-- SCHEMA REGISTRY FOR TYPE-SAFE DISCOVERY
-- Store input/output schemas for services
-- ============================================

-- Service schemas table
-- Stores JSON Schema for service inputs and outputs
CREATE TABLE IF NOT EXISTS service_schemas (
  service_id UUID PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  
  -- JSON Schema format for input/output validation
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  
  -- Semantic tags for discovery
  tags TEXT[] DEFAULT '{}',
  capabilities TEXT[] DEFAULT '{}',
  
  -- Input/output type names for matching
  input_type TEXT,
  output_type TEXT,
  
  -- Versioning
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN indexes for fast JSON and array queries
CREATE INDEX IF NOT EXISTS idx_schemas_input ON service_schemas USING GIN(input_schema);
CREATE INDEX IF NOT EXISTS idx_schemas_output ON service_schemas USING GIN(output_schema);
CREATE INDEX IF NOT EXISTS idx_schemas_tags ON service_schemas USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_schemas_capabilities ON service_schemas USING GIN(capabilities);

-- Btree indexes for type matching
CREATE INDEX IF NOT EXISTS idx_schemas_input_type ON service_schemas(input_type);
CREATE INDEX IF NOT EXISTS idx_schemas_output_type ON service_schemas(output_type);

-- Full-text search on tags (using a simpler approach)
-- Note: For FTS, consider adding a separate searchable tags_text column if needed

-- Function to find compatible services by input/output types
CREATE OR REPLACE FUNCTION find_compatible_services(
  p_input_type TEXT DEFAULT NULL,
  p_output_type TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_capabilities TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  service_id UUID,
  service_name TEXT,
  category TEXT,
  input_type TEXT,
  output_type TEXT,
  tags TEXT[],
  capabilities TEXT[],
  reputation_score DECIMAL,
  price_per_call DECIMAL
) AS $$
  SELECT 
    s.id AS service_id,
    s.name AS service_name,
    s.category,
    ss.input_type,
    ss.output_type,
    ss.tags,
    ss.capabilities,
    COALESCE(r.reputation_score, 0) AS reputation_score,
    s.price_per_call
  FROM services s
  JOIN service_schemas ss ON ss.service_id = s.id
  LEFT JOIN reputations r ON r.service_id = s.id
  WHERE s.is_active = true
    AND (p_input_type IS NULL OR ss.input_type = p_input_type)
    AND (p_output_type IS NULL OR ss.output_type = p_output_type)
    AND (p_tags IS NULL OR ss.tags && p_tags)
    AND (p_capabilities IS NULL OR ss.capabilities && p_capabilities)
  ORDER BY COALESCE(r.reputation_score, 0) DESC;
$$ LANGUAGE SQL;

-- Function to find services that can chain together
-- (output of first matches input of second)
CREATE OR REPLACE FUNCTION find_chainable_services(
  p_from_service_id UUID
)
RETURNS TABLE(
  service_id UUID,
  service_name TEXT,
  category TEXT,
  input_type TEXT,
  output_type TEXT,
  reputation_score DECIMAL
) AS $$
  WITH from_service AS (
    SELECT output_type
    FROM service_schemas
    WHERE service_id = p_from_service_id
  )
  SELECT 
    s.id AS service_id,
    s.name AS service_name,
    s.category,
    ss.input_type,
    ss.output_type,
    COALESCE(r.reputation_score, 0) AS reputation_score
  FROM services s
  JOIN service_schemas ss ON ss.service_id = s.id
  LEFT JOIN reputations r ON r.service_id = s.id
  CROSS JOIN from_service fs
  WHERE s.is_active = true
    AND s.id != p_from_service_id
    AND ss.input_type = fs.output_type
  ORDER BY COALESCE(r.reputation_score, 0) DESC;
$$ LANGUAGE SQL;

-- Function to suggest workflow based on input/output types
CREATE OR REPLACE FUNCTION suggest_workflow(
  p_start_input_type TEXT,
  p_end_output_type TEXT,
  p_max_steps INTEGER DEFAULT 3
)
RETURNS TABLE(
  workflow_services UUID[],
  workflow_names TEXT[],
  total_steps INTEGER
) AS $$
WITH RECURSIVE workflow_paths AS (
  -- Start with services that accept the initial input type
  SELECT 
    ARRAY[s.id] AS path,
    ARRAY[s.name] AS names,
    ss.output_type AS current_output,
    1 AS depth
  FROM services s
  JOIN service_schemas ss ON ss.service_id = s.id
  WHERE s.is_active = true
    AND ss.input_type = p_start_input_type
  
  UNION ALL
  
  -- Extend paths with compatible services
  SELECT 
    wp.path || s.id,
    wp.names || s.name,
    ss.output_type,
    wp.depth + 1
  FROM workflow_paths wp
  JOIN service_schemas ss ON ss.input_type = wp.current_output
  JOIN services s ON s.id = ss.service_id
  WHERE wp.depth < p_max_steps
    AND s.is_active = true
    AND NOT s.id = ANY(wp.path)
)
SELECT 
  path AS workflow_services,
  names AS workflow_names,
  depth AS total_steps
FROM workflow_paths
WHERE current_output = p_end_output_type
ORDER BY depth ASC
LIMIT 10;
$$ LANGUAGE SQL;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_schema_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schema_updated
  BEFORE UPDATE ON service_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_schema_timestamp();

-- Enable RLS
ALTER TABLE service_schemas ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read schemas" ON service_schemas 
  FOR SELECT USING (true);

-- Service role write policy
CREATE POLICY "Service write schemas" ON service_schemas 
  FOR ALL USING (true);

-- Insert example schema types
COMMENT ON TABLE service_schemas IS 'Stores JSON Schema definitions for service inputs and outputs, enabling type-safe discovery and workflow composition.';
COMMENT ON COLUMN service_schemas.input_type IS 'Semantic type name for the input (e.g., TradeRequest, PriceFeed)';
COMMENT ON COLUMN service_schemas.output_type IS 'Semantic type name for the output (e.g., TradeResult, NormalizedUSD)';
COMMENT ON COLUMN service_schemas.tags IS 'Discovery tags (e.g., low_latency, high_reliability)';
COMMENT ON COLUMN service_schemas.capabilities IS 'Service capabilities (e.g., perpetual_trading, stop_loss)';
