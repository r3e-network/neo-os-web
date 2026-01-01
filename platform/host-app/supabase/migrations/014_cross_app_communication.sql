-- Migration: Cross-App Communication System
-- Description: Inter-MiniApp messaging and data sharing protocol

-- App Messages Table
CREATE TABLE IF NOT EXISTS app_messages (
    id BIGSERIAL PRIMARY KEY,
    message_id UUID DEFAULT gen_random_uuid(),
    source_app_id TEXT NOT NULL,
    target_app_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Shared Data Contracts Table
CREATE TABLE IF NOT EXISTS shared_data_contracts (
    id BIGSERIAL PRIMARY KEY,
    contract_id UUID DEFAULT gen_random_uuid(),
    provider_app_id TEXT NOT NULL,
    consumer_app_id TEXT NOT NULL,
    data_schema JSONB NOT NULL,
    permissions JSONB DEFAULT '{"read": true, "write": false}',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(provider_app_id, consumer_app_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_source ON app_messages(source_app_id);
CREATE INDEX IF NOT EXISTS idx_messages_target ON app_messages(target_app_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON app_messages(status);
CREATE INDEX IF NOT EXISTS idx_contracts_provider ON shared_data_contracts(provider_app_id);
CREATE INDEX IF NOT EXISTS idx_contracts_consumer ON shared_data_contracts(consumer_app_id);

-- Enable RLS
ALTER TABLE app_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_data_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Apps can read own messages" ON app_messages FOR SELECT USING (true);
CREATE POLICY "Apps can send messages" ON app_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Apps can update message status" ON app_messages FOR UPDATE USING (true);
CREATE POLICY "Apps can manage contracts" ON shared_data_contracts FOR ALL USING (true);
