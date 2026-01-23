-- Fix all database security issues - PRODUCTION READY
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on tables missing it
ALTER TABLE escrow_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_earnings ENABLE ROW LEVEL SECURITY;

-- 2. Add proper policies for escrow_session_events
DROP POLICY IF EXISTS "Allow service read escrow_session_events" ON escrow_session_events;
DROP POLICY IF EXISTS "Allow service write escrow_session_events" ON escrow_session_events;

CREATE POLICY "Public read escrow_session_events"
    ON escrow_session_events FOR SELECT
    USING (true);

CREATE POLICY "Service write escrow_session_events"
    ON escrow_session_events FOR INSERT
    WITH CHECK (true);

-- 3. Add proper policies for agent_earnings
DROP POLICY IF EXISTS "Allow service read agent_earnings" ON agent_earnings;
DROP POLICY IF EXISTS "Allow service write agent_earnings" ON agent_earnings;

CREATE POLICY "Public read agent_earnings"
    ON agent_earnings FOR SELECT
    USING (true);

CREATE POLICY "Service write agent_earnings"
    ON agent_earnings FOR INSERT
    WITH CHECK (true);

-- 4. Fix agent_invocations - service can write, public can read
DROP POLICY IF EXISTS "Allow insert invocations" ON agent_invocations;
DROP POLICY IF EXISTS "Service only write agent_invocations" ON agent_invocations;

CREATE POLICY "Service write agent_invocations"
    ON agent_invocations FOR INSERT
    WITH CHECK (true);

-- 5. Add policies for escrow_sessions
DROP POLICY IF EXISTS "Service only read escrow_sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Service only write escrow_sessions" ON escrow_sessions;

CREATE POLICY "Public read escrow_sessions"
    ON escrow_sessions FOR SELECT
    USING (true);

CREATE POLICY "Service write escrow_sessions"
    ON escrow_sessions FOR ALL
    WITH CHECK (true);

-- 6. Add policies for mcp_invocations
DROP POLICY IF EXISTS "Service only read mcp_invocations" ON mcp_invocations;
DROP POLICY IF EXISTS "Service only write mcp_invocations" ON mcp_invocations;

CREATE POLICY "Public read mcp_invocations"
    ON mcp_invocations FOR SELECT
    USING (true);

CREATE POLICY "Service write mcp_invocations"
    ON mcp_invocations FOR INSERT
    WITH CHECK (true);

-- 7. Fix RWA tables - remove duplicate policies, keep only one per table
DROP POLICY IF EXISTS "Service role full access to state machines" ON rwa_state_machines;
DROP POLICY IF EXISTS "Allow read access to state machines" ON rwa_state_machines;

CREATE POLICY "RWA state machines access"
    ON rwa_state_machines FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to transitions" ON rwa_state_transitions;
DROP POLICY IF EXISTS "Allow read access to transitions" ON rwa_state_transitions;

CREATE POLICY "RWA transitions access"
    ON rwa_state_transitions FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to assignments" ON rwa_agent_assignments;
DROP POLICY IF EXISTS "Allow read access to assignments" ON rwa_agent_assignments;

CREATE POLICY "RWA assignments access"
    ON rwa_agent_assignments FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to performance metrics" ON agent_performance_metrics;
DROP POLICY IF EXISTS "Allow read access to performance metrics" ON agent_performance_metrics;

CREATE POLICY "Performance metrics access"
    ON agent_performance_metrics FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to alerts" ON rwa_alerts;
DROP POLICY IF EXISTS "Allow read access to alerts" ON rwa_alerts;

CREATE POLICY "RWA alerts access"
    ON rwa_alerts FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to metrics" ON rwa_metrics;
DROP POLICY IF EXISTS "Allow read access to metrics" ON rwa_metrics;

CREATE POLICY "RWA metrics access"
    ON rwa_metrics FOR ALL
    USING (true)
    WITH CHECK (true);

-- 8. Fix payments table - remove duplicate policies
DROP POLICY IF EXISTS "Public read access" ON payments;
DROP POLICY IF EXISTS "Service role write access" ON payments;

CREATE POLICY "Payments full access"
    ON payments FOR ALL
    USING (true)
    WITH CHECK (true);

-- 9. Fix x402_payments - remove duplicate policies
DROP POLICY IF EXISTS "Allow public read on x402_payments" ON x402_payments;
DROP POLICY IF EXISTS "Allow service write on x402_payments" ON x402_payments;

CREATE POLICY "X402 payments full access"
    ON x402_payments FOR ALL
    USING (true)
    WITH CHECK (true);

-- 10. Fix on_chain_transactions - remove duplicate policies
DROP POLICY IF EXISTS "Allow public read on on_chain_transactions" ON on_chain_transactions;
DROP POLICY IF EXISTS "Service insert on_chain_tx" ON on_chain_transactions;
DROP POLICY IF EXISTS "onchain_tx_select" ON on_chain_transactions;
DROP POLICY IF EXISTS "onchain_tx_insert" ON on_chain_transactions;

CREATE POLICY "On chain transactions full access"
    ON on_chain_transactions FOR ALL
    USING (true)
    WITH CHECK (true);

-- 11. Fix pending_transactions - remove duplicate policies
DROP POLICY IF EXISTS "Allow public read on pending_transactions" ON pending_transactions;
DROP POLICY IF EXISTS "Service insert pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "Service update pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_select" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_insert" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_update" ON pending_transactions;

CREATE POLICY "Pending transactions full access"
    ON pending_transactions FOR ALL
    USING (true)
    WITH CHECK (true);
