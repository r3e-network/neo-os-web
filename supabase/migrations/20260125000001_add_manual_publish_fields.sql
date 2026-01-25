-- Add manual publish fields for external submissions

ALTER TABLE public.miniapp_submissions
  ADD COLUMN IF NOT EXISTS entry_url TEXT,
  ADD COLUMN IF NOT EXISTS assets_selected JSONB,
  ADD COLUMN IF NOT EXISTS build_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS build_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (build_mode IN ('manual', 'platform'));
