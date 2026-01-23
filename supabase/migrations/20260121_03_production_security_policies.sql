-- PRODUCTION SECURITY: RLS with proper policies
-- Allows frontend to READ, backend to WRITE

-- 1. Keep RLS enabled (already done)
-- 2. Set proper policies for each table

-- Agent earnings: Public read, service write
DROP POLICY IF EXISTS "Service write agent_earnings" ON agent_earnings;
DROP POLICY IF EXISTS "Public read agent_earnings" ON agent_earnings;

CREATE POLICY "Public read agent_earnings"
    ON agent_earnings FOR SELECT
    USING (true);

-- Agent invocations: Public read, service write  
DROP POLICY IF EXISTS "Service write agent_invocations" ON agent_invocations;
DROP POLICY IF EXISTS "Allow read access to invocations" ON agent_invocations;

CREATE POLICY "Public read agent_invocations"
    ON agent_invocations FOR SELECT
    USING (true);

-- Agent performance metrics: Public read
DROP POLICY IF EXISTS "Performance metrics access" ON agent_performance_metrics;
DROP POLICY IF EXISTS "Allow read access to performance metrics" ON agent_performance_metrics;
DROP POLICY IF EXISTS "Service role full access to performance metrics" ON agent_performance_metrics;

CREATE POLICY "Public read agent_performance_metrics"
    ON agent_performance_metrics FOR SELECT
    USING (true);

-- Escrow session events: Public read
DROP POLICY IF EXISTS "Service write escrow_session_events" ON escrow_session_events;
DROP POLICY IF EXISTS "Public read escrow_session_events" ON escrow_session_events;

CREATE POLICY "Public read escrow_session_events"
    ON escrow_session_events FOR SELECT
    USING (true);

-- Escrow sessions: Public read
DROP POLICY IF EXISTS "Service write escrow_sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Public read escrow_sessions" ON escrow_sessions;

CREATE POLICY "Public read escrow_sessions"
    ON escrow_sessions FOR SELECT
    USING (true);

-- MCP invocations: Public read
DROP POLICY IF EXISTS "Service write mcp_invocations" ON mcp_invocations;
DROP POLICY IF EXISTS "Public read mcp_invocations" ON mcp_invocations;

CREATE POLICY "Public read mcp_invocations"
    ON mcp_invocations FOR SELECT
    USING (true);

-- On chain transactions: Public read
DROP POLICY IF EXISTS "On chain transactions full access" ON on_chain_transactions;
DROP POLICY IF EXISTS "Allow public read on on_chain_transactions" ON on_chain_transactions;
DROP POLICY IF EXISTS "Service insert on_chain_tx" ON on_chain_transactions;
DROP POLICY IF EXISTS "onchain_tx_select" ON on_chain_transactions;
DROP POLICY IF EXISTS "onchain_tx_insert" ON on_chain_transactions;

CREATE POLICY "Public read on_chain_transactions"
    ON on_chain_transactions FOR SELECT
    USING (true);

-- Payments: Public read
DROP POLICY IF EXISTS "Payments full access" ON payments;
DROP POLICY IF EXISTS "Public read access" ON payments;
DROP POLICY IF EXISTS "Service role write access" ON payments;

CREATE POLICY "Public read payments"
    ON payments FOR SELECT
    USING (true);

-- Pending transactions: Public read
DROP POLICY IF EXISTS "Pending transactions full access" ON pending_transactions;
DROP POLICY IF EXISTS "Allow public read on pending_transactions" ON pending_transactions;
DROP POLICY IF EXISTS "Service insert pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "Service update pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_select" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_insert" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_update" ON pending_transactions;

CREATE POLICY "Public read pending_transactions"
    ON pending_transactions FOR SELECT
    USING (true);

-- RWA tables: Public read
DROP POLICY IF EXISTS "RWA assignments access" ON rwa_agent_assignments;
DROP POLICY IF EXISTS "Allow read access to assignments" ON rwa_agent_assignments;
DROP POLICY IF EXISTS "Service role full access to assignments" ON rwa_agent_assignments;

CREATE POLICY "Public read rwa_agent_assignments"
    ON rwa_agent_assignments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "RWA alerts access" ON rwa_alerts;
DROP POLICY IF EXISTS "Allow read access to alerts" ON rwa_alerts;
DROP POLICY IF EXISTS "Service role full access to alerts" ON rwa_alerts;

CREATE POLICY "Public read rwa_alerts"
    ON rwa_alerts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "RWA metrics access" ON rwa_metrics;
DROP POLICY IF EXISTS "Allow read access to metrics" ON rwa_metrics;
DROP POLICY IF EXISTS "Service role full access to metrics" ON rwa_metrics;

CREATE POLICY "Public read rwa_metrics"
    ON rwa_metrics FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "RWA state machines access" ON rwa_state_machines;
DROP POLICY IF EXISTS "Allow read access to state machines" ON rwa_state_machines;
DROP POLICY IF EXISTS "Service role full access to state machines" ON rwa_state_machines;

CREATE POLICY "Public read rwa_state_machines"
    ON rwa_state_machines FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "RWA transitions access" ON rwa_state_transitions;
DROP POLICY IF EXISTS "Allow read access to transitions" ON rwa_state_transitions;
DROP POLICY IF EXISTS "Service role full access to transitions" ON rwa_state_transitions;

CREATE POLICY "Public read rwa_state_transitions"
    ON rwa_state_transitions FOR SELECT
    USING (true);

-- X402 payments: Public read
DROP POLICY IF EXISTS "X402 payments full access" ON x402_payments;
DROP POLICY IF EXISTS "Allow public read on x402_payments" ON x402_payments;
DROP POLICY IF EXISTS "Allow service write on x402_payments" ON x402_payments;

CREATE POLICY "Public read x402_payments"
    ON x402_payments FOR SELECT
    USING (true);

-- Fix function search path
ALTER FUNCTION notify_payment_settled() SET search_path = public, pg_temp;
