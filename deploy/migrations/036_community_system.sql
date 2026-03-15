-- =============================================================================
-- Community System: Comments, Ratings, Votes, Proof of Interaction
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Social Comments (with nested replies support)
-- -----------------------------------------------------------------------------
CREATE TABLE social_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES social_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 2000),
    is_developer_reply BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_social_comments_app ON social_comments(app_id, created_at DESC);
CREATE INDEX idx_social_comments_parent ON social_comments(parent_id, created_at DESC);
CREATE INDEX idx_social_comments_author ON social_comments(author_user_id);
CREATE INDEX idx_social_comments_active ON social_comments(app_id)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Comment Votes (upvote/downvote with deduplication)
-- -----------------------------------------------------------------------------
CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');

CREATE TABLE social_comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES social_comments(id) ON DELETE CASCADE,
    voter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type vote_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, voter_user_id)
);

CREATE INDEX idx_comment_votes_comment ON social_comment_votes(comment_id);
CREATE INDEX idx_comment_votes_voter ON social_comment_votes(voter_user_id);

-- -----------------------------------------------------------------------------
-- 3. App Ratings (1-5 stars with proof of interaction)
-- -----------------------------------------------------------------------------
CREATE TABLE social_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    rater_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating_value INTEGER NOT NULL CHECK (rating_value >= 1 AND rating_value <= 5),
    review_text TEXT CHECK (review_text IS NULL OR char_length(review_text) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, rater_user_id)
);

CREATE INDEX idx_social_ratings_app ON social_ratings(app_id);
CREATE INDEX idx_social_ratings_rater ON social_ratings(rater_user_id);

-- -----------------------------------------------------------------------------
-- 4. Proof of Interaction (verified user engagement)
-- -----------------------------------------------------------------------------
CREATE TABLE social_proof_of_interaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL REFERENCES miniapps(app_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tx_hash TEXT NOT NULL,
    interaction_type TEXT NOT NULL DEFAULT 'transaction',
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, user_id, tx_hash)
);

CREATE INDEX idx_proof_app_user ON social_proof_of_interaction(app_id, user_id);

-- -----------------------------------------------------------------------------
-- 5. Anti-spam tracking
-- -----------------------------------------------------------------------------
CREATE TABLE social_spam_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    app_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spam_user_action ON social_spam_tracking(user_id, action_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. Row Level Security Policies
-- -----------------------------------------------------------------------------
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_proof_of_interaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_spam_tracking ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY service_all_comments ON social_comments FOR ALL TO service_role USING (true);
CREATE POLICY service_all_votes ON social_comment_votes FOR ALL TO service_role USING (true);
CREATE POLICY service_all_ratings ON social_ratings FOR ALL TO service_role USING (true);
CREATE POLICY service_all_proof ON social_proof_of_interaction FOR ALL TO service_role USING (true);
CREATE POLICY service_all_spam ON social_spam_tracking FOR ALL TO service_role USING (true);

-- Public read access for non-deleted comments
CREATE POLICY public_read_comments ON social_comments FOR SELECT TO anon
    USING (deleted_at IS NULL);
CREATE POLICY public_read_votes ON social_comment_votes FOR SELECT TO anon USING (true);
CREATE POLICY public_read_ratings ON social_ratings FOR SELECT TO anon USING (true);

-- -----------------------------------------------------------------------------
-- 7. PL/pgSQL Functions
-- -----------------------------------------------------------------------------

-- Verify user has interacted with app
CREATE OR REPLACE FUNCTION verify_user_interaction(
    p_app_id TEXT,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    interaction_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO interaction_count
    FROM social_proof_of_interaction
    WHERE app_id = p_app_id AND user_id = p_user_id;
    RETURN interaction_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check spam rate limit
CREATE OR REPLACE FUNCTION check_spam_limit(
    p_user_id UUID,
    p_action_type TEXT,
    p_app_id TEXT DEFAULT NULL,
    p_window_minutes INTEGER DEFAULT 5,
    p_max_per_window INTEGER DEFAULT 3
) RETURNS BOOLEAN AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO recent_count
    FROM social_spam_tracking
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND (p_app_id IS NULL OR app_id = p_app_id)
      AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    RETURN recent_count < p_max_per_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log spam action for rate limiting
CREATE OR REPLACE FUNCTION log_spam_action(
    p_user_id UUID,
    p_action_type TEXT,
    p_app_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO social_spam_tracking (user_id, action_type, app_id)
    VALUES (p_user_id, p_action_type, p_app_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate weighted app rating
CREATE OR REPLACE FUNCTION calculate_app_rating_weighted(p_app_id TEXT)
RETURNS TABLE(
    avg_rating NUMERIC,
    total_ratings INTEGER,
    rating_distribution JSONB,
    weighted_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH rating_stats AS (
        SELECT
            COUNT(*)::INTEGER as total,
            COALESCE(AVG(rating_value), 0)::NUMERIC as avg_val,
            COALESCE(
                jsonb_object_agg(rating_value::TEXT, cnt),
                '{}'::jsonb
            ) as distribution
        FROM (
            SELECT rating_value, COUNT(*) as cnt
            FROM social_ratings
            WHERE app_id = p_app_id
            GROUP BY rating_value
        ) sub
    )
    SELECT
        avg_val,
        total,
        distribution,
        (avg_val * 0.7 + LEAST(total::NUMERIC / 10, 1) * 5 * 0.3)::NUMERIC
    FROM rating_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
