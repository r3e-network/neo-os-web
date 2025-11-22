-- JAM accumulators and receipts for package/report inclusion tracking

CREATE TABLE IF NOT EXISTS jam_accumulators (
    service_id UUID PRIMARY KEY REFERENCES jam_services(id) ON DELETE CASCADE,
    seq BIGINT NOT NULL DEFAULT 0,
    root TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jam_receipts (
    hash TEXT PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES jam_services(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL,
    seq BIGINT NOT NULL,
    prev_root TEXT NOT NULL DEFAULT '',
    new_root TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata_hash TEXT NOT NULL DEFAULT '',
    extra JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jam_receipts_service_seq
    ON jam_receipts(service_id, seq);

CREATE INDEX IF NOT EXISTS idx_jam_receipts_service_hash
    ON jam_receipts(service_id, hash);
