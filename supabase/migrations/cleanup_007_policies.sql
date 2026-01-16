-- Clean up partial migration policies before re-running 007_perp_indexing.sql
DROP POLICY IF EXISTS "Public read funding_rates" ON funding_rates_timeseries;
DROP POLICY IF EXISTS "Public read position_events" ON position_events;
DROP POLICY IF EXISTS "Public read liquidity_snapshots" ON liquidity_snapshots;
DROP POLICY IF EXISTS "Public read indexed_blocks" ON indexed_blocks;
DROP POLICY IF EXISTS "Service write funding_rates" ON funding_rates_timeseries;
DROP POLICY IF EXISTS "Service write position_events" ON position_events;
DROP POLICY IF EXISTS "Service write liquidity_snapshots" ON liquidity_snapshots;
DROP POLICY IF EXISTS "Service write indexed_blocks" ON indexed_blocks;

SELECT 'Policies dropped successfully' as status;
