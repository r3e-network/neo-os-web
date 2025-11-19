-- Price feed rounds and observations

CREATE TABLE IF NOT EXISTS app_price_feed_rounds (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES app_price_feeds(id) ON DELETE CASCADE,
    round_id BIGINT NOT NULL,
    aggregated_price DOUBLE PRECISION NOT NULL,
    observation_count INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    finalized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_price_feed_rounds_feed_round
    ON app_price_feed_rounds (feed_id, round_id DESC);

CREATE INDEX IF NOT EXISTS idx_app_price_feed_rounds_feed_created
    ON app_price_feed_rounds (feed_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_price_feed_observations (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES app_price_feeds(id) ON DELETE CASCADE,
    round_id BIGINT NOT NULL,
    source TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_price_feed_observations_feed_round
    ON app_price_feed_observations (feed_id, round_id);
