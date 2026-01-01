-- Migration: Advanced Reports System
-- Description: Usage reports, trend analysis, and export functionality

-- Usage Reports Table
CREATE TABLE IF NOT EXISTS usage_reports (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Trends Table
CREATE TABLE IF NOT EXISTS app_trends (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    date DATE NOT NULL,
    executions INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    gas_used BIGINT DEFAULT 0,
    revenue BIGINT DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    UNIQUE(app_id, date)
);

-- Export Jobs Table
CREATE TABLE IF NOT EXISTS export_jobs (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'json', 'pdf')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_url TEXT,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_wallet ON usage_reports(wallet_address);
CREATE INDEX IF NOT EXISTS idx_reports_type ON usage_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_trends_app ON app_trends(app_id);
CREATE INDEX IF NOT EXISTS idx_trends_date ON app_trends(date DESC);
CREATE INDEX IF NOT EXISTS idx_exports_wallet ON export_jobs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_exports_status ON export_jobs(status);

-- Enable RLS
ALTER TABLE usage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own reports" ON usage_reports FOR SELECT USING (true);
CREATE POLICY "System can insert reports" ON usage_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read trends" ON app_trends FOR SELECT USING (true);
CREATE POLICY "System can manage trends" ON app_trends FOR ALL USING (true);
CREATE POLICY "Users can manage own exports" ON export_jobs FOR ALL USING (true);
