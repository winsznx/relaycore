-- Migration: 008_bot_linking.sql
-- Bot linking tables for secure Telegram/Discord integration

-- Bot link requests (one-time codes for linking wallet to bot)
CREATE TABLE IF NOT EXISTS bot_link_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT false
);

CREATE INDEX idx_bot_link_code ON bot_link_requests(code);
CREATE INDEX idx_bot_link_wallet ON bot_link_requests(wallet_address);
CREATE INDEX idx_bot_link_expires ON bot_link_requests(expires_at) WHERE NOT is_used;

-- Linked bot accounts
CREATE TABLE IF NOT EXISTS linked_bot_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'telegram', 'discord'
    platform_user_id TEXT NOT NULL,
    platform_username TEXT,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(platform, platform_user_id)
);

CREATE INDEX idx_linked_bot_wallet ON linked_bot_accounts(wallet_address);
CREATE INDEX idx_linked_bot_platform ON linked_bot_accounts(platform, platform_user_id);

-- Bot notifications preferences
CREATE TABLE IF NOT EXISTS bot_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linked_account_id UUID REFERENCES linked_bot_accounts(id) ON DELETE CASCADE,
    
    -- Notification types
    notify_service_calls BOOLEAN DEFAULT true,
    notify_payments_received BOOLEAN DEFAULT true,
    notify_payments_sent BOOLEAN DEFAULT true,
    notify_reputation_changes BOOLEAN DEFAULT true,
    notify_health_alerts BOOLEAN DEFAULT true,
    notify_daily_summary BOOLEAN DEFAULT true,
    
    -- Thresholds
    min_payment_amount DECIMAL(18,8) DEFAULT 0.01,
    reputation_change_threshold DECIMAL(5,2) DEFAULT 5.0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification queue for pending bot messages
CREATE TABLE IF NOT EXISTS bot_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linked_account_id UUID REFERENCES linked_bot_accounts(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=urgent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    is_sent BOOLEAN DEFAULT false,
    error_message TEXT
);

CREATE INDEX idx_notification_queue_pending ON bot_notification_queue(linked_account_id, is_sent) WHERE NOT is_sent;
CREATE INDEX idx_notification_queue_created ON bot_notification_queue(created_at) WHERE NOT is_sent;

-- Function to clean up expired link requests
CREATE OR REPLACE FUNCTION cleanup_expired_link_requests()
RETURNS void AS $$
BEGIN
    DELETE FROM bot_link_requests
    WHERE expires_at < NOW() AND NOT is_used;
END;
$$ LANGUAGE plpgsql;

-- Function to generate link code
CREATE OR REPLACE FUNCTION generate_link_code(p_wallet_address TEXT)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- Generate a unique 8-character code
    v_code := 'RELAY-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Insert the request
    INSERT INTO bot_link_requests (code, wallet_address, expires_at)
    VALUES (v_code, p_wallet_address, NOW() + INTERVAL '5 minutes');
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to complete bot linking
CREATE OR REPLACE FUNCTION complete_bot_link(
    p_code TEXT,
    p_platform TEXT,
    p_platform_user_id TEXT,
    p_platform_username TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, wallet_address TEXT, error_message TEXT) AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- Find and validate the link request
    SELECT * INTO v_request
    FROM bot_link_requests
    WHERE code = p_code AND NOT is_used
    LIMIT 1;
    
    IF v_request IS NULL THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Invalid or expired link code'::TEXT;
        RETURN;
    END IF;
    
    IF v_request.expires_at < NOW() THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Link code has expired'::TEXT;
        RETURN;
    END IF;
    
    -- Mark the request as used
    UPDATE bot_link_requests
    SET is_used = true, used_at = NOW()
    WHERE id = v_request.id;
    
    -- Create or update the linked account
    INSERT INTO linked_bot_accounts (wallet_address, platform, platform_user_id, platform_username)
    VALUES (v_request.wallet_address, p_platform, p_platform_user_id, p_platform_username)
    ON CONFLICT (platform, platform_user_id) DO UPDATE
    SET wallet_address = v_request.wallet_address,
        platform_username = p_platform_username,
        is_active = true,
        last_active_at = NOW();
    
    RETURN QUERY SELECT true, v_request.wallet_address, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default notification settings
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO bot_notification_settings (linked_account_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_notification_settings
    AFTER INSERT ON linked_bot_accounts
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_settings();
