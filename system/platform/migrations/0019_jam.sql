-- JAM core tables (services, work packages, reports, attestations, messages, preimages)

CREATE TABLE IF NOT EXISTS jam_services (
    id UUID PRIMARY KEY,
    owner TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    state_namespace TEXT NOT NULL DEFAULT '',
    state_bytes BIGINT NOT NULL DEFAULT 0,
    balance BIGINT NOT NULL DEFAULT 0,
    max_state_bytes BIGINT NOT NULL DEFAULT 0,
    max_compute_millis BIGINT NOT NULL DEFAULT 0,
    max_package_items INTEGER NOT NULL DEFAULT 0,
    valid_until TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jam_service_versions (
    service_id UUID NOT NULL REFERENCES jam_services(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    migrate_hook TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (service_id, version)
);

CREATE TABLE IF NOT EXISTS jam_work_packages (
    id UUID PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES jam_services(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL DEFAULT '',
    nonce TEXT NOT NULL DEFAULT '',
    expiry TIMESTAMPTZ,
    signature BYTEA,
    preimage_hashes TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jam_work_packages_status_created
    ON jam_work_packages(status, created_at);

CREATE TABLE IF NOT EXISTS jam_work_items (
    id UUID PRIMARY KEY,
    package_id UUID NOT NULL REFERENCES jam_work_packages(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    params_hash TEXT NOT NULL,
    preimage_hashes TEXT[] NOT NULL DEFAULT '{}',
    max_fee BIGINT NOT NULL DEFAULT 0,
    memo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS jam_work_reports (
    id UUID PRIMARY KEY,
    package_id UUID NOT NULL REFERENCES jam_work_packages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES jam_services(id) ON DELETE CASCADE,
    refine_output_hash TEXT NOT NULL,
    refine_output_compact BYTEA,
    traces BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jam_attestations (
    report_id UUID NOT NULL REFERENCES jam_work_reports(id) ON DELETE CASCADE,
    worker_id TEXT NOT NULL,
    signature BYTEA,
    weight BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    engine TEXT,
    engine_version TEXT,
    PRIMARY KEY (report_id, worker_id)
);

CREATE TABLE IF NOT EXISTS jam_messages (
    id UUID PRIMARY KEY,
    from_service UUID NOT NULL REFERENCES jam_services(id) ON DELETE CASCADE,
    to_service UUID NOT NULL REFERENCES jam_services(id) ON DELETE CASCADE,
    payload_hash TEXT NOT NULL,
    token_amount BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jam_messages_status_available
    ON jam_messages(status, available_at, created_at);

CREATE TABLE IF NOT EXISTS jam_preimages (
    hash TEXT PRIMARY KEY,
    size BIGINT NOT NULL,
    media_type TEXT NOT NULL DEFAULT '',
    data BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploader TEXT NOT NULL DEFAULT '',
    storage_class TEXT NOT NULL DEFAULT '',
    refcount BIGINT NOT NULL DEFAULT 0
);
