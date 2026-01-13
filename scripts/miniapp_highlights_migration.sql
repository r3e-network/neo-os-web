-- =============================================================================
-- MiniApp Highlights Migration
-- Creates the miniapp_highlights table for dynamic app card highlights
-- =============================================================================

-- =============================================================================
-- MiniApp Highlights Table
-- Stores dynamic highlight data displayed on MiniApp cards
-- =============================================================================
CREATE TABLE IF NOT EXISTS miniapp_highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    icon TEXT,
    trend TEXT CHECK (trend IN ('up', 'down', NULL)),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient app_id lookups
CREATE INDEX IF NOT EXISTS idx_miniapp_highlights_app_id
    ON miniapp_highlights(app_id);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_miniapp_highlights_order
    ON miniapp_highlights(app_id, display_order);

-- =============================================================================
-- Trigger to auto-update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_miniapp_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_miniapp_highlights_updated_at
    ON miniapp_highlights;

CREATE TRIGGER trigger_miniapp_highlights_updated_at
    BEFORE UPDATE ON miniapp_highlights
    FOR EACH ROW
    EXECUTE FUNCTION update_miniapp_highlights_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE miniapp_highlights ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on miniapp_highlights"
    ON miniapp_highlights
    FOR SELECT
    USING (true);

-- Allow authenticated users to insert/update (for admin operations)
CREATE POLICY "Allow authenticated insert on miniapp_highlights"
    ON miniapp_highlights
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on miniapp_highlights"
    ON miniapp_highlights
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
