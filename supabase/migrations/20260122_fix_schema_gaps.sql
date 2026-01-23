-- Migration: Fix Schema Gaps
-- Date: 2026-01-22
-- Fixes:
--   1. Creates session_payments table (MISSING)
--   2. Adds missing columns to escrow_refunds (reason, metadata)
--   3. Fixes outcomes table FK type and outcome_type enum
--   4. Adds synchronization trigger between RWA state systems

-- ============================================
-- 1. SESSION_PAYMENTS TABLE (MISSING)
-- ============================================

CREATE TABLE IF NOT EXISTS session_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    agent_address TEXT NOT NULL,
    agent_name TEXT,
    amount DECIMAL(20, 6) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'x402',
    tx_hash TEXT,
    facilitator_tx_hash TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_payment_amount CHECK (amount > 0)
);

-- Indexes for session_payments
CREATE INDEX IF NOT EXISTS idx_session_payments_session ON session_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_session_payments_agent ON session_payments(agent_address);
CREATE INDEX IF NOT EXISTS idx_session_payments_status ON session_payments(status);
CREATE INDEX IF NOT EXISTS idx_session_payments_created ON session_payments(created_at DESC);

-- RLS for session_payments
ALTER TABLE session_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read session payments" ON session_payments
    FOR SELECT USING (true);

CREATE POLICY "Service insert session payments" ON session_payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update session payments" ON session_payments
    FOR UPDATE USING (true);

-- ============================================
-- 2. FIX ESCROW_REFUNDS TABLE (ADD MISSING COLUMNS)
-- ============================================

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'escrow_refunds' AND column_name = 'reason'
    ) THEN
        ALTER TABLE escrow_refunds ADD COLUMN reason TEXT;
    END IF;

    -- Add metadata column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'escrow_refunds' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE escrow_refunds ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    -- Add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'escrow_refunds' AND column_name = 'status'
    ) THEN
        ALTER TABLE escrow_refunds ADD COLUMN status TEXT DEFAULT 'completed';
    END IF;

    -- Add refund_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'escrow_refunds' AND column_name = 'refund_type'
    ) THEN
        ALTER TABLE escrow_refunds ADD COLUMN refund_type TEXT DEFAULT 'session_close';
    END IF;
END $$;

-- ============================================
-- 3. FIX OUTCOMES TABLE
-- ============================================

-- Drop the old outcomes table constraints and recreate with correct schema
DO $$
BEGIN
    -- Drop existing FK constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'outcomes_payment_id_fkey'
        AND table_name = 'outcomes'
    ) THEN
        ALTER TABLE outcomes DROP CONSTRAINT outcomes_payment_id_fkey;
    END IF;

    -- Drop existing check constraint on outcome_type
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'outcomes_outcome_type_check'
    ) THEN
        ALTER TABLE outcomes DROP CONSTRAINT outcomes_outcome_type_check;
    END IF;
END $$;

-- Alter payment_id to TEXT (if it's UUID, recreate the column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'outcomes'
        AND column_name = 'payment_id'
        AND data_type = 'uuid'
    ) THEN
        -- Rename old column
        ALTER TABLE outcomes RENAME COLUMN payment_id TO payment_id_old;
        -- Add new TEXT column
        ALTER TABLE outcomes ADD COLUMN payment_id TEXT;
        -- Copy data with cast
        UPDATE outcomes SET payment_id = payment_id_old::text WHERE payment_id_old IS NOT NULL;
        -- Drop old column
        ALTER TABLE outcomes DROP COLUMN payment_id_old;
    END IF;
END $$;

-- Add new check constraint with expanded outcome types
ALTER TABLE outcomes
ADD CONSTRAINT outcomes_outcome_type_check
CHECK (outcome_type IN ('delivered', 'failed', 'timeout', 'success', 'refunded'));

-- Add index on payment_id if not exists
CREATE INDEX IF NOT EXISTS idx_outcomes_payment_text ON outcomes(payment_id);

-- ============================================
-- 4. STATE MACHINE SYNCHRONIZATION
-- ============================================

-- Create mapping table between asset lifecycle and settlement state machine
CREATE TABLE IF NOT EXISTS rwa_state_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT REFERENCES rwa_assets(asset_id) ON DELETE CASCADE,
    rwa_id TEXT REFERENCES rwa_state_machines(rwa_id) ON DELETE CASCADE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_id, rwa_id)
);

CREATE INDEX IF NOT EXISTS idx_rwa_state_sync_asset ON rwa_state_sync(asset_id);
CREATE INDEX IF NOT EXISTS idx_rwa_state_sync_rwa ON rwa_state_sync(rwa_id);

-- Trigger function to sync asset status with state machine
CREATE OR REPLACE FUNCTION sync_rwa_state_machines()
RETURNS TRIGGER AS $$
DECLARE
    v_mapped_state TEXT;
    v_rwa_id TEXT;
BEGIN
    -- Map asset status to state machine state
    v_mapped_state := CASE NEW.status
        WHEN 'pending' THEN 'created'
        WHEN 'minted' THEN 'verified'
        WHEN 'active' THEN 'in_process'
        WHEN 'frozen' THEN 'disputed'
        WHEN 'redeemed' THEN 'settled'
        ELSE 'created'
    END;

    -- Check if linked state machine exists
    SELECT rwa_id INTO v_rwa_id
    FROM rwa_state_sync
    WHERE asset_id = NEW.asset_id;

    IF v_rwa_id IS NOT NULL THEN
        -- Update state machine
        UPDATE rwa_state_machines
        SET
            previous_state = current_state,
            current_state = v_mapped_state,
            updated_at = NOW()
        WHERE rwa_id = v_rwa_id;

        -- Log transition
        INSERT INTO rwa_state_transitions (
            rwa_id,
            from_state,
            to_state,
            agent_address,
            agent_role,
            payment_hash
        ) VALUES (
            v_rwa_id,
            (SELECT current_state FROM rwa_state_machines WHERE rwa_id = v_rwa_id),
            v_mapped_state,
            'system_sync',
            'synchronizer',
            'auto_sync_' || extract(epoch from now())::text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on rwa_assets for status changes
DROP TRIGGER IF EXISTS rwa_asset_state_sync ON rwa_assets;
CREATE TRIGGER rwa_asset_state_sync
    AFTER UPDATE OF status ON rwa_assets
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION sync_rwa_state_machines();

-- ============================================
-- 5. ADD SPENT COLUMN TO ESCROW_SESSIONS
-- ============================================

-- The x402-session-service uses 'spent' column but it may not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'escrow_sessions' AND column_name = 'spent'
    ) THEN
        ALTER TABLE escrow_sessions ADD COLUMN spent DECIMAL(20, 6) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'escrow_sessions' AND column_name = 'payment_count'
    ) THEN
        ALTER TABLE escrow_sessions ADD COLUMN payment_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- 6. INCREMENT_SESSION_SPENDING FUNCTION (TEXT session_id)
-- ============================================

CREATE OR REPLACE FUNCTION increment_session_spending(p_session_id TEXT, p_amount DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE escrow_sessions
    SET
        spent = COALESCE(spent, 0) + p_amount,
        released = COALESCE(released::decimal, 0) + p_amount,
        payment_count = COALESCE(payment_count, 0) + 1,
        updated_at = NOW()
    WHERE session_id = p_session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found: %', p_session_id;
    END IF;
END;
$$;

-- ============================================
-- 7. SESSION PAYMENT TRACKING VIEW
-- ============================================

CREATE OR REPLACE VIEW session_payment_summary AS
SELECT
    sp.session_id,
    es.owner_address,
    es.max_spend,
    es.deposited,
    COALESCE(es.spent::text, es.released) as total_spent,
    (es.deposited::decimal - COALESCE(es.spent, es.released::decimal, 0)) as remaining,
    COUNT(sp.id) as payment_count,
    array_agg(DISTINCT sp.agent_address) as agents_paid,
    MAX(sp.created_at) as last_payment_at
FROM escrow_sessions es
LEFT JOIN session_payments sp ON es.session_id = sp.session_id
GROUP BY sp.session_id, es.owner_address, es.max_spend, es.deposited, es.spent, es.released;

-- ============================================
-- 8. X402 PAYMENT AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS x402_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    session_id TEXT,
    payment_id TEXT,
    agent_address TEXT,
    amount DECIMAL(20, 6),
    facilitator_tx_hash TEXT,
    status TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x402_audit_session ON x402_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_x402_audit_action ON x402_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_x402_audit_created ON x402_audit_log(created_at DESC);

ALTER TABLE x402_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read x402 audit" ON x402_audit_log
    FOR SELECT USING (true);

CREATE POLICY "Service insert x402 audit" ON x402_audit_log
    FOR INSERT WITH CHECK (true);
