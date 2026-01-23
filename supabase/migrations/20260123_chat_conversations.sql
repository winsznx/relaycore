-- Chat Conversations Table
-- Stores conversation history for memory persistence

CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    session_id TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT unique_wallet_session UNIQUE (wallet_address, session_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_wallet 
    ON chat_conversations(wallet_address);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_session 
    ON chat_conversations(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated 
    ON chat_conversations(updated_at DESC);

-- RLS Policies
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only read their own conversations
CREATE POLICY chat_conversations_select_policy ON chat_conversations
    FOR SELECT
    USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only insert their own conversations
CREATE POLICY chat_conversations_insert_policy ON chat_conversations
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only update their own conversations
CREATE POLICY chat_conversations_update_policy ON chat_conversations
    FOR UPDATE
    USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
CREATE TRIGGER chat_conversations_updated_at_trigger
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_conversations_updated_at();

-- Comments
COMMENT ON TABLE chat_conversations IS 'Stores conversation history for LangGraph chatbot memory';
COMMENT ON COLUMN chat_conversations.wallet_address IS 'User wallet address (lowercase)';
COMMENT ON COLUMN chat_conversations.session_id IS 'Conversation session identifier';
COMMENT ON COLUMN chat_conversations.messages IS 'Array of message objects with role and content';
COMMENT ON COLUMN chat_conversations.summary IS 'Auto-generated summary for long conversations';
