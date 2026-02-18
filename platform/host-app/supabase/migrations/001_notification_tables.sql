-- Notification System Tables
-- Run this migration in Supabase SQL Editor

-- 1. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  notify_miniapp_results BOOLEAN DEFAULT TRUE,
  notify_balance_changes BOOLEAN DEFAULT TRUE,
  notify_chain_alerts BOOLEAN DEFAULT FALSE,
  digest_frequency TEXT DEFAULT 'instant' CHECK (digest_frequency IN ('instant', 'hourly', 'daily')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_prefs_wallet ON notification_preferences(wallet_address);

-- 2. Notification Events Table
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_events_wallet ON notification_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_events_wallet_read ON notification_events(wallet_address, read);
CREATE INDEX IF NOT EXISTS idx_events_created ON notification_events(created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access; authenticated users access own rows only
CREATE POLICY "Service role full access on preferences" ON notification_preferences FOR ALL TO service_role USING (true);
CREATE POLICY "Users own preferences" ON notification_preferences FOR ALL TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet')
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet');

CREATE POLICY "Service role full access on events" ON notification_events FOR ALL TO service_role USING (true);
CREATE POLICY "Users own events" ON notification_events FOR ALL TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet')
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet');

-- 4. Email Verifications Table
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verify_wallet ON email_verifications(wallet_address);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on verifications" ON email_verifications FOR ALL TO service_role USING (true);
CREATE POLICY "Users own verifications" ON email_verifications FOR ALL TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet')
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet');
