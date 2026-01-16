-- ==============================================
-- SECURITY: Lock Down Supabase Functions
-- ==============================================
-- This migration removes public execution access from all custom functions
-- and grants access only to service_role (used by backend only)
--
-- Reference: https://x.com/burakeregar/status/2011425140987601281
-- "PostgreSQL database functions are PUBLIC executable by default"

-- Step 1: Revoke public access from all custom functions
-- Replace with your actual function names

-- API Key Generation Function (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_api_key_for_wallet') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION generate_api_key_for_wallet FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION generate_api_key_for_wallet FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION generate_api_key_for_wallet FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION generate_api_key_for_wallet TO service_role';
    END IF;
END $$;

-- Reputation Calculation Function (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_agent_reputation') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION calculate_agent_reputation FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION calculate_agent_reputation FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION calculate_agent_reputation FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION calculate_agent_reputation TO service_role';
    END IF;
END $$;

-- Payment Settlement Function (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'settle_payment') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION settle_payment FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION settle_payment FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION settle_payment FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION settle_payment TO service_role';
    END IF;
END $$;

-- Credit/Balance Functions (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_credits') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION add_credits FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION add_credits FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION add_credits FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION add_credits TO service_role';
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'deduct_credits') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION deduct_credits FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION deduct_credits FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION deduct_credits FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION deduct_credits TO service_role';
    END IF;
END $$;

-- ==============================================
-- Step 2: Set default for future functions
-- ==============================================
-- Any new functions will NOT be executable by public by default

ALTER DEFAULT PRIVILEGES 
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES 
    REVOKE EXECUTE ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES 
    REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

-- ==============================================
-- Step 3: Validate RLS is enabled on sensitive tables
-- ==============================================

-- Ensure RLS is enabled on critical tables
ALTER TABLE IF EXISTS api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- NOTES:
-- ==============================================
-- 1. After running this migration, only service_role can execute these functions
-- 2. service_role is used by backend code via SUPABASE_SERVICE_ROLE_KEY
-- 3. Frontend uses anon key which cannot call these functions
-- 4. This prevents direct database manipulation from client code
