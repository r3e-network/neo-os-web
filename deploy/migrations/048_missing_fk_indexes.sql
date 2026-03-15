-- Migration 048: Add missing indexes on foreign key columns
-- Improves JOIN/DELETE performance for cascading FK lookups.

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_user_id
    ON chat_messages (sender_user_id) WHERE sender_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_miniapp_submissions_reviewed_by
    ON miniapp_submissions (reviewed_by) WHERE reviewed_by IS NOT NULL;
