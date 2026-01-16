-- Function to create bot API keys (bypasses PostgREST schema cache)
CREATE OR REPLACE FUNCTION create_bot_api_key(
    p_key_hash TEXT,
    p_user_id TEXT,
    p_permissions JSONB,
    p_rate_limit INTEGER,
    p_expires_at TIMESTAMPTZ
) RETURNS TABLE (
    id UUID,
    key_hash TEXT,
    user_id TEXT,
    permissions JSONB,
    rate_limit INTEGER,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO api_keys (key_hash, user_id, permissions, rate_limit, expires_at, is_active)
    VALUES (p_key_hash, p_user_id, p_permissions, p_rate_limit, p_expires_at, true)
    RETURNING 
        api_keys.id,
        api_keys.key_hash,
        api_keys.user_id,
        api_keys.permissions,
        api_keys.rate_limit,
        api_keys.expires_at,
        api_keys.is_active,
        api_keys.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION create_bot_api_key TO service_role;
