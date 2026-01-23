-- Fix Multiple Permissive Policies Performance Warnings
-- Consolidates duplicate SELECT policies into single optimized policies
-- IDEMPOTENT: Safe to run multiple times

-- The issue: Each table has both "Public read" and "Service write" policies
-- Both allow SELECT, causing PostgreSQL to evaluate both policies per query
-- Solution: Drop the "Service write" policies and replace with specific INSERT/UPDATE/DELETE policies

-- ============================================
-- AGENT_ACTIVITY
-- ============================================
DROP POLICY IF EXISTS "Service write agent_activity" ON agent_activity;
DROP POLICY IF EXISTS "Service insert agent_activity" ON agent_activity;
DROP POLICY IF EXISTS "Service update agent_activity" ON agent_activity;
DROP POLICY IF EXISTS "Service delete agent_activity" ON agent_activity;

CREATE POLICY "Service insert agent_activity" ON agent_activity FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update agent_activity" ON agent_activity FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete agent_activity" ON agent_activity FOR DELETE
USING (is_service_role());

-- ============================================
-- DEX_VENUES
-- ============================================
DROP POLICY IF EXISTS "Service write dex_venues" ON dex_venues;
DROP POLICY IF EXISTS "Service insert dex_venues" ON dex_venues;
DROP POLICY IF EXISTS "Service update dex_venues" ON dex_venues;
DROP POLICY IF EXISTS "Service delete dex_venues" ON dex_venues;

CREATE POLICY "Service insert dex_venues" ON dex_venues FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update dex_venues" ON dex_venues FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete dex_venues" ON dex_venues FOR DELETE
USING (is_service_role());

-- ============================================
-- ESCROW_AUDIT_LOG
-- ============================================
DROP POLICY IF EXISTS "Service write audit" ON escrow_audit_log;
DROP POLICY IF EXISTS "Service insert audit" ON escrow_audit_log;
DROP POLICY IF EXISTS "Service update audit" ON escrow_audit_log;
DROP POLICY IF EXISTS "Service delete audit" ON escrow_audit_log;

CREATE POLICY "Service insert audit" ON escrow_audit_log FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update audit" ON escrow_audit_log FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete audit" ON escrow_audit_log FOR DELETE
USING (is_service_role());

-- ============================================
-- ESCROW_SESSIONS
-- ============================================
DROP POLICY IF EXISTS "Service write sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Public read sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Service insert sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Service update sessions" ON escrow_sessions;
DROP POLICY IF EXISTS "Service delete sessions" ON escrow_sessions;

CREATE POLICY "Service insert sessions" ON escrow_sessions FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update sessions" ON escrow_sessions FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete sessions" ON escrow_sessions FOR DELETE
USING (is_service_role());

-- ============================================
-- FEEDBACK_EVENTS
-- ============================================
DROP POLICY IF EXISTS "Service write feedback" ON feedback_events;
DROP POLICY IF EXISTS "Service insert feedback" ON feedback_events;
DROP POLICY IF EXISTS "Service update feedback" ON feedback_events;
DROP POLICY IF EXISTS "Service delete feedback" ON feedback_events;

CREATE POLICY "Service insert feedback" ON feedback_events FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update feedback" ON feedback_events FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete feedback" ON feedback_events FOR DELETE
USING (is_service_role());

-- ============================================
-- FUNDING_RATES_TIMESERIES
-- ============================================
DROP POLICY IF EXISTS "Service write funding_rates" ON funding_rates_timeseries;
DROP POLICY IF EXISTS "Service insert funding_rates" ON funding_rates_timeseries;
DROP POLICY IF EXISTS "Service update funding_rates" ON funding_rates_timeseries;
DROP POLICY IF EXISTS "Service delete funding_rates" ON funding_rates_timeseries;

CREATE POLICY "Service insert funding_rates" ON funding_rates_timeseries FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update funding_rates" ON funding_rates_timeseries FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete funding_rates" ON funding_rates_timeseries FOR DELETE
USING (is_service_role());

-- ============================================
-- INDEXED_BLOCKS
-- ============================================
DROP POLICY IF EXISTS "Service write indexed_blocks" ON indexed_blocks;
DROP POLICY IF EXISTS "Service insert indexed_blocks" ON indexed_blocks;
DROP POLICY IF EXISTS "Service update indexed_blocks" ON indexed_blocks;
DROP POLICY IF EXISTS "Service delete indexed_blocks" ON indexed_blocks;

CREATE POLICY "Service insert indexed_blocks" ON indexed_blocks FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update indexed_blocks" ON indexed_blocks FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete indexed_blocks" ON indexed_blocks FOR DELETE
USING (is_service_role());

-- ============================================
-- LIQUIDITY_SNAPSHOTS
-- ============================================
DROP POLICY IF EXISTS "Service write liquidity_snapshots" ON liquidity_snapshots;
DROP POLICY IF EXISTS "Service insert liquidity_snapshots" ON liquidity_snapshots;
DROP POLICY IF EXISTS "Service update liquidity_snapshots" ON liquidity_snapshots;
DROP POLICY IF EXISTS "Service delete liquidity_snapshots" ON liquidity_snapshots;

CREATE POLICY "Service insert liquidity_snapshots" ON liquidity_snapshots FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update liquidity_snapshots" ON liquidity_snapshots FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete liquidity_snapshots" ON liquidity_snapshots FOR DELETE
USING (is_service_role());

-- ============================================
-- ON_CHAIN_TRANSACTIONS
-- ============================================
DROP POLICY IF EXISTS "Service write on_chain_tx" ON on_chain_transactions;
DROP POLICY IF EXISTS "Service insert on_chain_tx" ON on_chain_transactions;
DROP POLICY IF EXISTS "Service update on_chain_tx" ON on_chain_transactions;
DROP POLICY IF EXISTS "Service delete on_chain_tx" ON on_chain_transactions;

CREATE POLICY "Service insert on_chain_tx" ON on_chain_transactions FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update on_chain_tx" ON on_chain_transactions FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete on_chain_tx" ON on_chain_transactions FOR DELETE
USING (is_service_role());

-- ============================================
-- PENDING_TRANSACTIONS
-- ============================================
DROP POLICY IF EXISTS "Service write pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "Service insert pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "Service update pending_tx" ON pending_transactions;
DROP POLICY IF EXISTS "Service delete pending_tx" ON pending_transactions;

CREATE POLICY "Service insert pending_tx" ON pending_transactions FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update pending_tx" ON pending_transactions FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete pending_tx" ON pending_transactions FOR DELETE
USING (is_service_role());

-- ============================================
-- POSITION_EVENTS
-- ============================================
DROP POLICY IF EXISTS "Service write position_events" ON position_events;
DROP POLICY IF EXISTS "Service insert position_events" ON position_events;
DROP POLICY IF EXISTS "Service update position_events" ON position_events;
DROP POLICY IF EXISTS "Service delete position_events" ON position_events;

CREATE POLICY "Service insert position_events" ON position_events FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update position_events" ON position_events FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete position_events" ON position_events FOR DELETE
USING (is_service_role());

-- ============================================
-- RWA_EXECUTION_REQUESTS
-- ============================================
DROP POLICY IF EXISTS "Service write rwa requests" ON rwa_execution_requests;
DROP POLICY IF EXISTS "Service update rwa requests" ON rwa_execution_requests;
DROP POLICY IF EXISTS "Service insert rwa requests" ON rwa_execution_requests;
DROP POLICY IF EXISTS "Service delete rwa requests" ON rwa_execution_requests;

CREATE POLICY "Service insert rwa requests" ON rwa_execution_requests FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update rwa requests" ON rwa_execution_requests FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete rwa requests" ON rwa_execution_requests FOR DELETE
USING (is_service_role());

-- ============================================
-- RWA_LIFECYCLE_EVENTS
-- ============================================
DROP POLICY IF EXISTS "Service write rwa lifecycle" ON rwa_lifecycle_events;
DROP POLICY IF EXISTS "Service insert rwa lifecycle" ON rwa_lifecycle_events;
DROP POLICY IF EXISTS "Service update rwa lifecycle" ON rwa_lifecycle_events;
DROP POLICY IF EXISTS "Service delete rwa lifecycle" ON rwa_lifecycle_events;

CREATE POLICY "Service insert rwa lifecycle" ON rwa_lifecycle_events FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update rwa lifecycle" ON rwa_lifecycle_events FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete rwa lifecycle" ON rwa_lifecycle_events FOR DELETE
USING (is_service_role());

-- ============================================
-- SESSION_PAYMENTS
-- ============================================
DROP POLICY IF EXISTS "Service write payments" ON session_payments;
DROP POLICY IF EXISTS "Service insert payments" ON session_payments;
DROP POLICY IF EXISTS "Service update payments" ON session_payments;
DROP POLICY IF EXISTS "Service delete payments" ON session_payments;

CREATE POLICY "Service insert payments" ON session_payments FOR INSERT
WITH CHECK (is_service_role());
CREATE POLICY "Service update payments" ON session_payments FOR UPDATE
USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "Service delete payments" ON session_payments FOR DELETE
USING (is_service_role());

-- ============================================
-- FIX FUNCTION SEARCH PATH
-- ============================================
CREATE OR REPLACE FUNCTION increment_session_spending()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE escrow_sessions 
    SET spent = spent + NEW.amount 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;

-- Fix the second signature of increment_session_spending (regular function, not trigger)
CREATE OR REPLACE FUNCTION increment_session_spending(p_session_id integer, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE escrow_sessions
    SET 
        spent = spent + p_amount,
        payment_count = payment_count + 1,
        updated_at = NOW()
    WHERE session_id = p_session_id;
END;
$$;

