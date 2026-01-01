-- Migration: Developer Dashboard
-- Description: Developer statistics and revenue reports

-- Developer Stats Table
CREATE TABLE IF NOT EXISTS developer_stats (
    id BIGSERIAL PRIMARY KEY,
    developer_address TEXT NOT NULL,
    date DATE NOT NULL,
    total_apps INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    total_executions INTEGER DEFAULT 0,
    total_revenue BIGINT DEFAULT 0,
    UNIQUE(developer_address, date)
);

-- Indexes
CREATE INDEX idx_dev_stats_addr ON developer_stats(developer_address);
CREATE INDEX idx_dev_stats_date ON developer_stats(date DESC);

-- Enable RLS
ALTER TABLE developer_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_stats_policy" ON developer_stats FOR ALL USING (true);
