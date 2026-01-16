-- ============================================
-- GRAPH INDEXING FOR SERVICE RELATIONSHIPS
-- Track service-to-service interactions and dependencies
-- ============================================

-- Service relationships table
-- Tracks which services call which other services
CREATE TABLE IF NOT EXISTS service_relationships (
  from_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  to_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'calls',
  
  -- Interaction metrics
  call_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(18,8) DEFAULT 0,
  
  -- Temporal tracking
  first_interaction TIMESTAMPTZ DEFAULT NOW(),
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (from_service_id, to_service_id, relationship_type),
  
  -- Prevent self-references
  CONSTRAINT no_self_reference CHECK (from_service_id != to_service_id)
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS idx_relationships_from ON service_relationships(from_service_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON service_relationships(to_service_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON service_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_relationships_call_count ON service_relationships(call_count DESC);

-- Path finding function using recursive CTE
-- Finds shortest paths between services
CREATE OR REPLACE FUNCTION find_service_path(
  start_service UUID,
  end_service UUID,
  max_depth INTEGER DEFAULT 5
) 
RETURNS TABLE(
  path UUID[],
  total_latency INTEGER,
  total_cost DECIMAL,
  path_length INTEGER
) AS $$
WITH RECURSIVE service_paths AS (
  -- Base case: direct connections from start service
  SELECT 
    ARRAY[from_service_id, to_service_id] AS path,
    avg_latency_ms AS total_latency,
    total_cost_usd::DECIMAL AS total_cost,
    1 AS depth
  FROM service_relationships
  WHERE from_service_id = start_service
    AND call_count > 0
  
  UNION ALL
  
  -- Recursive case: extend paths
  SELECT 
    sp.path || sr.to_service_id,
    sp.total_latency + sr.avg_latency_ms,
    (sp.total_cost + sr.total_cost_usd)::DECIMAL AS total_cost,
    sp.depth + 1
  FROM service_paths sp
  JOIN service_relationships sr 
    ON sr.from_service_id = sp.path[array_length(sp.path, 1)]
  WHERE sp.depth < max_depth
    AND NOT sr.to_service_id = ANY(sp.path)
    AND sr.call_count > 0
)
SELECT 
  path,
  total_latency,
  total_cost,
  array_length(path, 1) AS path_length
FROM service_paths
WHERE path[array_length(path, 1)] = end_service
ORDER BY total_latency ASC
LIMIT 10;
$$ LANGUAGE SQL;

-- Get service dependencies (services this service calls)
CREATE OR REPLACE FUNCTION get_service_dependencies(p_service_id UUID)
RETURNS TABLE(
  service_id UUID,
  service_name TEXT,
  call_count INTEGER,
  success_rate DECIMAL,
  avg_latency_ms INTEGER
) AS $$
  SELECT 
    sr.to_service_id AS service_id,
    s.name AS service_name,
    sr.call_count,
    sr.success_rate,
    sr.avg_latency_ms
  FROM service_relationships sr
  JOIN services s ON s.id = sr.to_service_id
  WHERE sr.from_service_id = p_service_id
    AND sr.call_count > 0
  ORDER BY sr.call_count DESC;
$$ LANGUAGE SQL;

-- Get service dependents (services that call this service)
CREATE OR REPLACE FUNCTION get_service_dependents(p_service_id UUID)
RETURNS TABLE(
  service_id UUID,
  service_name TEXT,
  call_count INTEGER,
  success_rate DECIMAL,
  avg_latency_ms INTEGER
) AS $$
  SELECT 
    sr.from_service_id AS service_id,
    s.name AS service_name,
    sr.call_count,
    sr.success_rate,
    sr.avg_latency_ms
  FROM service_relationships sr
  JOIN services s ON s.id = sr.from_service_id
  WHERE sr.to_service_id = p_service_id
    AND sr.call_count > 0
  ORDER BY sr.call_count DESC;
$$ LANGUAGE SQL;

-- Record or update a service relationship
CREATE OR REPLACE FUNCTION record_service_interaction(
  p_from_service UUID,
  p_to_service UUID,
  p_success BOOLEAN,
  p_latency_ms INTEGER,
  p_cost_usd DECIMAL DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO service_relationships (
    from_service_id,
    to_service_id,
    relationship_type,
    call_count,
    success_rate,
    avg_latency_ms,
    total_cost_usd,
    first_interaction,
    last_interaction
  ) VALUES (
    p_from_service,
    p_to_service,
    'calls',
    1,
    CASE WHEN p_success THEN 100 ELSE 0 END,
    p_latency_ms,
    p_cost_usd,
    NOW(),
    NOW()
  )
  ON CONFLICT (from_service_id, to_service_id, relationship_type) 
  DO UPDATE SET
    call_count = service_relationships.call_count + 1,
    success_rate = (
      (service_relationships.success_rate * service_relationships.call_count + 
       CASE WHEN p_success THEN 100 ELSE 0 END) / 
      (service_relationships.call_count + 1)
    ),
    avg_latency_ms = (
      (service_relationships.avg_latency_ms * service_relationships.call_count + p_latency_ms) / 
      (service_relationships.call_count + 1)
    ),
    total_cost_usd = service_relationships.total_cost_usd + p_cost_usd,
    last_interaction = NOW();
END;
$$ LANGUAGE plpgsql;

-- Materialized view for top service connections
CREATE MATERIALIZED VIEW IF NOT EXISTS top_service_connections AS
SELECT 
  sr.from_service_id,
  fs.name AS from_service_name,
  sr.to_service_id,
  ts.name AS to_service_name,
  sr.call_count,
  sr.success_rate,
  sr.avg_latency_ms,
  sr.total_cost_usd
FROM service_relationships sr
JOIN services fs ON fs.id = sr.from_service_id
JOIN services ts ON ts.id = sr.to_service_id
WHERE sr.call_count > 0
ORDER BY sr.call_count DESC
LIMIT 100;

CREATE UNIQUE INDEX IF NOT EXISTS idx_top_connections_pk 
  ON top_service_connections(from_service_id, to_service_id);

-- Enable RLS
ALTER TABLE service_relationships ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read relationships" ON service_relationships 
  FOR SELECT USING (true);

-- Service role write policy
CREATE POLICY "Service write relationships" ON service_relationships 
  FOR ALL USING (true);
