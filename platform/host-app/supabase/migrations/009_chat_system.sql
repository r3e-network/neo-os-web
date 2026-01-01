-- Migration: Chat System
-- Description: Store chat messages for MiniApp discussions

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'tip')),
    tip_amount TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_app ON chat_messages(app_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(app_id, created_at DESC);

-- Chat Participants (for online count)
CREATE TABLE IF NOT EXISTS chat_participants (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_participants_app ON chat_participants(app_id);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert messages" ON chat_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read participants" ON chat_participants FOR SELECT USING (true);
CREATE POLICY "Users can upsert participants" ON chat_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update participants" ON chat_participants FOR UPDATE USING (true);

-- Cleanup old messages (keep last 200 per app)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM chat_messages
    WHERE app_id = NEW.app_id
    AND id NOT IN (
        SELECT id FROM chat_messages
        WHERE app_id = NEW.app_id
        ORDER BY created_at DESC
        LIMIT 200
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_chat
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION cleanup_old_chat_messages();
