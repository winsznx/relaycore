-- ============================================================================
-- USER SETTINGS & CONFIGURATION
-- ============================================================================
-- Stores user preferences, bot links, and API keys with proper security

-- User Profiles (linked to wallet addresses)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    display_name TEXT,
    email TEXT,
    email_verified BOOLEAN DEFAULT false,
    avatar_url TEXT,
    bio TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Notification Settings per user
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE REFERENCES user_profiles(wallet_address) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT false,
    telegram_enabled BOOLEAN DEFAULT true,
    discord_enabled BOOLEAN DEFAULT false,
    -- Notification types
    notify_payments_received BOOLEAN DEFAULT true,
    notify_payments_sent BOOLEAN DEFAULT true,
    notify_service_calls BOOLEAN DEFAULT true,
    notify_reputation_changes BOOLEAN DEFAULT true,
    notify_health_alerts BOOLEAN DEFAULT true,
    notify_daily_summary BOOLEAN DEFAULT false,
    -- Thresholds
    min_payment_notify_amount TEXT DEFAULT '0.01',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Bot Link Requests (temporary, for one-time codes)
CREATE TABLE IF NOT EXISTS bot_link_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Linked Bot Accounts (Telegram, Discord, etc)
CREATE TABLE IF NOT EXISTS linked_bot_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('telegram', 'discord')),
    platform_user_id TEXT NOT NULL,
    platform_username TEXT,
    api_key_id UUID,
    linked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(platform, platform_user_id)
);

-- API Keys (with permissions, rate limits, expiration)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the key
    user_id TEXT NOT NULL, -- wallet address
    name TEXT DEFAULT 'Default Key',
    permissions JSONB NOT NULL DEFAULT '{
        "read_services": true,
        "read_reputation": true,
        "read_outcomes": true,
        "read_payments": true,
        "execute_payments": false
    }'::jsonb,
    rate_limit INTEGER DEFAULT 100, -- requests per hour
    queries_used INTEGER DEFAULT 0,
    allowed_ips TEXT[], -- empty means all allowed
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Bot Notification Queue (for async delivery)
CREATE TABLE IF NOT EXISTS bot_notification_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    linked_account_id UUID REFERENCES linked_bot_accounts(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=urgent
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_linked_bot_accounts_wallet ON linked_bot_accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_linked_bot_accounts_platform ON linked_bot_accounts(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_bot_notification_queue_pending ON bot_notification_queue(is_sent, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_link_requests_code ON bot_link_requests(code, is_used);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE linked_bot_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_notification_queue ENABLE ROW LEVEL SECURITY;

-- Public read for your own data (authenticated via API)
-- In production, use Supabase Auth with JWT validation
-- For now, we'll control access at the API layer

-- Clean up expired link requests (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_link_requests()
RETURNS void AS $$
BEGIN
    DELETE FROM bot_link_requests 
    WHERE expires_at < NOW() - INTERVAL '1 day'
    AND is_used = false;
END;
$$ LANGUAGE plpgsql;

-- Clean up old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM bot_notification_queue 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
