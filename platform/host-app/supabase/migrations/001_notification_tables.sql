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

-- Allow public read/write for now (adjust based on auth strategy)
CREATE POLICY "Allow all on preferences" ON notification_preferences FOR ALL USING (true);
CREATE POLICY "Allow all on events" ON notification_events FOR ALL USING (true);

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
CREATE POLICY "Allow all on verifications" ON email_verifications FOR ALL USING (true);
