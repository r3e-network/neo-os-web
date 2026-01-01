-- Migration: In-App Purchases
-- Description: Subscriptions and payment history

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS app_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    app_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(wallet_address, app_id)
);

-- Payment History Table
CREATE TABLE IF NOT EXISTS payment_history (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    app_id TEXT NOT NULL,
    amount BIGINT NOT NULL,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subs_wallet ON app_subscriptions(wallet_address);
CREATE INDEX idx_payments_wallet ON payment_history(wallet_address);

-- Enable RLS
ALTER TABLE app_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_policy" ON app_subscriptions FOR ALL USING (true);
CREATE POLICY "payments_policy" ON payment_history FOR ALL USING (true);
