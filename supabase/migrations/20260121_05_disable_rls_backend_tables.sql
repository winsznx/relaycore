-- OPTION 1: Disable RLS entirely (recommended for backend-only tables)
-- These tables are only accessed via service role, so RLS is unnecessary

ALTER TABLE agent_earnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_invocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_session_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_invocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE on_chain_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_agent_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_state_machines DISABLE ROW LEVEL SECURITY;
ALTER TABLE rwa_state_transitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE x402_payments DISABLE ROW LEVEL SECURITY;

-- Drop all policies since RLS is disabled
DROP POLICY IF EXISTS "Service write agent_earnings" ON agent_earnings;
DROP POLICY IF EXISTS "Public read agent_earnings" ON agent_earnings;
DROP POLICY IF EXISTS "Service write agent_invocations" ON agent_invocations;
DROP POLICY IF EXISTS "Allow read access to invocations" ON agent_invocations;
DROP POLICY IF EXISTS "Performance metrics access" ON agent_performance_metrics;
DROP POLICY IF EXISTS "Service write escrow_session_events" ON escrow_session_events;
DROP POLICY IF EXISTS "Public read escrow_session_events" ON escrow_session_events;
DROP POLICY IF EXISTS "Service write escrow_sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Public read escrow_sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Service write mcp_invocations" ON mcp_invocations;
DROP POLICY IF EXISTS "Public read mcp_invocations" ON mcp_invocations;
DROP POLICY IF EXISTS "On chain transactions full access" ON on_chain_transactions;
DROP POLICY IF EXISTS "Payments full access" ON payments;
DROP POLICY IF EXISTS "Pending transactions full access" ON pending_transactions;
DROP POLICY IF EXISTS "RWA assignments access" ON rwa_agent_assignments;
DROP POLICY IF EXISTS "RWA alerts access" ON rwa_alerts;
DROP POLICY IF EXISTS "RWA metrics access" ON rwa_metrics;
DROP POLICY IF EXISTS "RWA state machines access" ON rwa_state_machines;
DROP POLICY IF EXISTS "RWA transitions access" ON rwa_state_transitions;
DROP POLICY IF EXISTS "X402 payments full access" ON x402_payments;

-- Fix the function search path warning
ALTER FUNCTION notify_payment_settled() SET search_path = public, pg_temp;
