-- Migration: MiniApp Statistics Tables
-- Description: Aggregated statistics and rollup tracking for MiniApps

-- ============================================
-- MiniApp Stats Table
-- Aggregated statistics for each MiniApp
-- ============================================
CREATE TABLE public.miniapp_stats (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_id text NOT NULL UNIQUE,
    
    -- User metrics
    active_users_monthly integer DEFAULT 0 NOT NULL,
    active_users_weekly integer DEFAULT 0 NOT NULL,
    active_users_daily integer DEFAULT 0 NOT NULL,
    
    -- Transaction metrics
    total_transactions bigint DEFAULT 0 NOT NULL,
    transactions_weekly integer DEFAULT 0 NOT NULL,
    transactions_daily integer DEFAULT 0 NOT NULL,
    
    -- Volume metrics (in GAS)
    total_volume_gas numeric(78, 0) DEFAULT 0 NOT NULL,
    volume_weekly_gas numeric(78, 0) DEFAULT 0 NOT NULL,
    volume_daily_gas numeric(78, 0) DEFAULT 0 NOT NULL,
    
    -- Rating & reviews
    rating numeric(3, 2) DEFAULT 0 NOT NULL CHECK (rating >= 0 AND rating <= 5),
    review_count integer DEFAULT 0 NOT NULL,
    
    -- View count
    view_count integer DEFAULT 0 NOT NULL,
    
    -- Live status data (Gaming, DeFi, Governance specific)
    live_status jsonb DEFAULT '{}'::jsonb,
    
    -- Extended analytics
    retention_d1 numeric(5, 2), -- Day 1 retention %
    retention_d7 numeric(5, 2), -- Day 7 retention %
    avg_session_duration integer, -- seconds
    funnel_view_to_connect numeric(5, 2), -- % who connect wallet
    funnel_connect_to_tx numeric(5, 2), -- % who make transaction
    
    -- Timestamps
    last_rollup_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for miniapp_stats
CREATE INDEX idx_miniapp_stats_app_id ON public.miniapp_stats(app_id);
CREATE INDEX idx_miniapp_stats_updated_at ON public.miniapp_stats(updated_at);
CREATE INDEX idx_miniapp_stats_rating ON public.miniapp_stats(rating DESC);
CREATE INDEX idx_miniapp_stats_users_weekly ON public.miniapp_stats(active_users_weekly DESC);

-- ============================================
-- App Transactions Table
-- Individual transaction records for rollup
-- ============================================
CREATE TABLE public.app_transactions (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_id text NOT NULL,
    tx_hash text NOT NULL UNIQUE,
    chain_id text NOT NULL,
    user_address text,
    
    -- Transaction details
    method_name text,
    gas_consumed numeric(78, 0),
    
    -- Event data
    event_count integer DEFAULT 0,
    events jsonb DEFAULT '[]'::jsonb,
    
    -- Block info
    block_number bigint,
    block_timestamp timestamp with time zone,
    
    -- Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone
);

-- Indexes for app_transactions
CREATE INDEX idx_app_tx_app_id ON public.app_transactions(app_id);
CREATE INDEX idx_app_tx_user ON public.app_transactions(user_address) WHERE user_address IS NOT NULL;
CREATE INDEX idx_app_tx_block ON public.app_transactions(block_number DESC);
CREATE INDEX idx_app_tx_created ON public.app_transactions(created_at DESC);
CREATE INDEX idx_app_tx_status ON public.app_transactions(status);

-- ============================================
-- Stats Rollup Log Table
-- Tracks rollup job executions
-- ============================================
CREATE TABLE public.stats_rollup_log (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    
    -- Rollup range
    from_block bigint,
    to_block bigint,
    from_timestamp timestamp with time zone,
    to_timestamp timestamp with time zone,
    
    -- Stats
    apps_processed integer DEFAULT 0,
    events_processed integer DEFAULT 0,
    transactions_processed integer DEFAULT 0,
    
    -- Status
    status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message text,
    
    -- Metadata
    triggered_by text DEFAULT 'cron', -- 'cron', 'manual', 'webhook'
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes for stats_rollup_log
CREATE INDEX idx_rollup_log_status ON public.stats_rollup_log(status);
CREATE INDEX idx_rollup_log_started ON public.stats_rollup_log(started_at DESC);

-- ============================================
-- User Sessions Table (for retention analytics)
-- ============================================
CREATE TABLE public.user_sessions (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_address text NOT NULL,
    app_id text NOT NULL,
    
    -- Session data
    session_start timestamp with time zone DEFAULT now() NOT NULL,
    session_end timestamp with time zone,
    duration_seconds integer,
    
    -- Context
    chain_id text,
    wallet_provider text,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for user_sessions
CREATE INDEX idx_sessions_user ON public.user_sessions(user_address, app_id);
CREATE INDEX idx_sessions_app ON public.user_sessions(app_id, session_start DESC);
CREATE INDEX idx_sessions_start ON public.user_sessions(session_start DESC);

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.miniapp_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats_rollup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Read-only access for authenticated users
CREATE POLICY "miniapp_stats_read_all" ON public.miniapp_stats
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "app_tx_read_all" ON public.app_transactions
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "rollup_log_read_all" ON public.stats_rollup_log
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "sessions_read_all" ON public.user_sessions
    FOR SELECT TO authenticated, anon USING (true);

-- Service role can do everything
CREATE POLICY "miniapp_stats_service_all" ON public.miniapp_stats
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "app_tx_service_all" ON public.app_transactions
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "rollup_log_service_all" ON public.stats_rollup_log
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sessions_service_all" ON public.user_sessions
    TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- Functions
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_miniapp_stats_updated_at
    BEFORE UPDATE ON public.miniapp_stats
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE public.miniapp_stats IS 'Aggregated statistics for MiniApps, updated periodically by rollup job';
COMMENT ON TABLE public.app_transactions IS 'Individual transactions for MiniApps, used for rollup aggregation';
COMMENT ON TABLE public.stats_rollup_log IS 'Execution log for the stats rollup cron job';
COMMENT ON TABLE public.user_sessions IS 'User session tracking for retention analytics';
