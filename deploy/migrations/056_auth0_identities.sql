-- =============================================================================
-- Auth0 Identities & Social Sync
-- =============================================================================

CREATE TABLE IF NOT EXISTS linked_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    auth0_sub VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_linked_identities_user ON linked_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_identities_sub ON linked_identities(auth0_sub);
CREATE INDEX IF NOT EXISTS idx_linked_identities_email ON linked_identities(email);