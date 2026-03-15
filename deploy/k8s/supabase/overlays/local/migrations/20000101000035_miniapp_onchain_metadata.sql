-- =============================================================================
-- MiniApp metadata cached from AppRegistry (on-chain source of truth)
-- =============================================================================

ALTER TABLE miniapps
    ADD COLUMN IF NOT EXISTS contract_hash TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS icon TEXT,
    ADD COLUMN IF NOT EXISTS banner TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_miniapps_contract_hash ON miniapps(contract_hash);
