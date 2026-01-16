-- ============================================
-- TEMPORAL INDEXING FOR SERVICE METRICS
-- Time-series data for service performance tracking
-- ============================================

-- Time-series metrics table
-- Stores rolling metrics for each service at regular intervals
CREATE TABLE IF NOT EXISTS service_metrics_timeseries (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Performance metrics
  success_rate DECIMAL(5,2),
  avg_latency_ms INTEGER,
  call_volume INTEGER DEFAULT 0,
  
  -- Reputation metrics
  reputation_score DECIMAL(5,2),
  mtbf_hours DECIMAL(10,2),
  
  -- Cost metrics
  total_revenue_usd DECIMAL(18,8) DEFAULT 0,
  avg_cost_per_call DECIMAL(18,8),
  
  PRIMARY KEY (service_id, timestamp)
);

-- Indexes for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON service_metrics_timeseries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_service_time ON service_metrics_timeseries(service_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_reputation ON service_metrics_timeseries(reputation_score DESC);

-- Composite metrics view for quick lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS service_composite_metrics AS
SELECT 
  s.id AS service_id,
  s.name,
  s.category,
  s.owner_address,
  s.price_per_call,
  s.is_active,
  
  -- Reputation metrics from reputations table
  COALESCE(r.reputation_score, 0) AS reputation_score,
  COALESCE(r.total_payments, 0) AS total_payments,
  COALESCE(r.successful_payments, 0) AS successful_payments,
  COALESCE(r.failed_payments, 0) AS failed_payments,
  
  -- Success rate calculation
  CASE WHEN COALESCE(r.total_payments, 0) > 0 
    THEN (COALESCE(r.successful_payments, 0)::FLOAT / r.total_payments) * 100 
    ELSE 0 
  END AS success_rate,
  
  -- MTBF calculation (Mean Time Between Failures in hours)
  CASE WHEN COALESCE(r.failed_payments, 0) > 0
    THEN EXTRACT(EPOCH FROM (NOW() - s.created_at)) / r.failed_payments / 3600
    ELSE 999999
  END AS mtbf_hours,
  
  -- Latency
  COALESCE(r.avg_latency_ms, 0) AS avg_latency_ms,
  
  -- Trend detection (last 7 days vs previous 7 days)
  CASE 
    WHEN (
      SELECT AVG(reputation_score)
      FROM service_metrics_timeseries
      WHERE service_id = s.id
        AND timestamp > NOW() - INTERVAL '7 days'
    ) > (
      SELECT AVG(reputation_score)
      FROM service_metrics_timeseries
      WHERE service_id = s.id
        AND timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
    ) THEN 'improving'
    WHEN (
      SELECT AVG(reputation_score)
      FROM service_metrics_timeseries
      WHERE service_id = s.id
        AND timestamp > NOW() - INTERVAL '7 days'
    ) < (
      SELECT AVG(reputation_score)
      FROM service_metrics_timeseries
      WHERE service_id = s.id
        AND timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
    ) THEN 'declining'
    ELSE 'stable'
  END AS trend,
  
  s.last_active,
  s.created_at
  
FROM services s
LEFT JOIN reputations r ON s.id = r.service_id
WHERE s.is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_composite_metrics_id ON service_composite_metrics(service_id);

-- Function to refresh composite metrics
CREATE OR REPLACE FUNCTION refresh_composite_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY service_composite_metrics;
END;
$$ LANGUAGE plpgsql;

-- Hourly aggregation view for dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS service_metrics_hourly AS
SELECT 
  service_id,
  date_trunc('hour', timestamp) AS hour,
  AVG(success_rate) AS avg_success_rate,
  AVG(avg_latency_ms) AS avg_latency,
  SUM(call_volume) AS total_calls,
  AVG(reputation_score) AS avg_reputation
FROM service_metrics_timeseries
GROUP BY service_id, date_trunc('hour', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_hourly_pk ON service_metrics_hourly(service_id, hour);

-- Daily aggregation view for analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS service_metrics_daily AS
SELECT 
  service_id,
  date_trunc('day', timestamp) AS day,
  AVG(success_rate) AS avg_success_rate,
  AVG(avg_latency_ms) AS avg_latency,
  SUM(call_volume) AS total_calls,
  AVG(reputation_score) AS avg_reputation,
  MAX(reputation_score) - MIN(reputation_score) AS reputation_variance
FROM service_metrics_timeseries
GROUP BY service_id, date_trunc('day', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_daily_pk ON service_metrics_daily(service_id, day);

-- Function to record service metrics
CREATE OR REPLACE FUNCTION record_service_metrics(
  p_service_id UUID,
  p_success_rate DECIMAL,
  p_avg_latency_ms INTEGER,
  p_call_volume INTEGER,
  p_reputation_score DECIMAL
)
RETURNS void AS $$
BEGIN
  INSERT INTO service_metrics_timeseries (
    service_id,
    timestamp,
    success_rate,
    avg_latency_ms,
    call_volume,
    reputation_score
  ) VALUES (
    p_service_id,
    NOW(),
    p_success_rate,
    p_avg_latency_ms,
    p_call_volume,
    p_reputation_score
  );
END;
$$ LANGUAGE plpgsql;
