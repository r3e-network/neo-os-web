-- =============================================================================
-- Community System Index Optimizations
-- =============================================================================

-- Composite index for vote lookups (user checking their vote on a comment)
-- Covers: SELECT ... WHERE comment_id = ? AND voter_user_id = ?
CREATE INDEX IF NOT EXISTS idx_comment_votes_lookup
    ON social_comment_votes(comment_id, voter_user_id);

-- Composite index for vote aggregation by type
-- Covers: SELECT vote_type, COUNT(*) FROM ... WHERE comment_id = ? GROUP BY vote_type
CREATE INDEX IF NOT EXISTS idx_comment_votes_type
    ON social_comment_votes(comment_id, vote_type);

-- Composite index for user's rating on an app (faster upsert checks)
CREATE INDEX IF NOT EXISTS idx_ratings_app_user
    ON social_ratings(app_id, rater_user_id);

-- Index for fetching recent comments with author info
CREATE INDEX IF NOT EXISTS idx_comments_recent_active
    ON social_comments(app_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Partial index for top-level comments only (no parent)
CREATE INDEX IF NOT EXISTS idx_comments_toplevel
    ON social_comments(app_id, created_at DESC)
    WHERE parent_id IS NULL AND deleted_at IS NULL;
