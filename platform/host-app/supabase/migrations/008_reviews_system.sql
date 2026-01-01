-- Migration: Reviews System (Ratings & Comments)
-- Description: Store user ratings and comments for MiniApps

-- 1. Ratings Table
CREATE TABLE IF NOT EXISTS miniapp_ratings (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    rating_value SMALLINT NOT NULL CHECK (rating_value >= 1 AND rating_value <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, wallet_address)
);

-- Indexes for ratings
CREATE INDEX IF NOT EXISTS idx_ratings_app ON miniapp_ratings(app_id);
CREATE INDEX IF NOT EXISTS idx_ratings_wallet ON miniapp_ratings(wallet_address);

-- 2. Comments Table
CREATE TABLE IF NOT EXISTS miniapp_comments (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    parent_id BIGINT REFERENCES miniapp_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 2000),
    is_developer_reply BOOLEAN DEFAULT FALSE,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_app ON miniapp_comments(app_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON miniapp_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_wallet ON miniapp_comments(wallet_address);

-- 3. Comment Votes Table
CREATE TABLE IF NOT EXISTS comment_votes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES miniapp_comments(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_comment ON comment_votes(comment_id);

-- 4. Enable RLS
ALTER TABLE miniapp_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE miniapp_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for ratings
CREATE POLICY "Anyone can read ratings"
    ON miniapp_ratings FOR SELECT USING (true);

CREATE POLICY "Users can insert own ratings"
    ON miniapp_ratings FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own ratings"
    ON miniapp_ratings FOR UPDATE USING (true);

-- 6. RLS Policies for comments
CREATE POLICY "Anyone can read comments"
    ON miniapp_comments FOR SELECT USING (true);

CREATE POLICY "Users can insert comments"
    ON miniapp_comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own comments"
    ON miniapp_comments FOR UPDATE USING (true);

-- 7. RLS Policies for votes
CREATE POLICY "Anyone can read votes"
    ON comment_votes FOR SELECT USING (true);

CREATE POLICY "Users can insert votes"
    ON comment_votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own votes"
    ON comment_votes FOR UPDATE USING (true);

CREATE POLICY "Users can delete own votes"
    ON comment_votes FOR DELETE USING (true);

-- 8. Function to update comment vote counts
CREATE OR REPLACE FUNCTION update_comment_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE miniapp_comments SET upvotes = upvotes + 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE miniapp_comments SET downvotes = downvotes + 1 WHERE id = NEW.comment_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote_type = 'upvote' THEN
            UPDATE miniapp_comments SET upvotes = upvotes - 1 WHERE id = OLD.comment_id;
        ELSE
            UPDATE miniapp_comments SET downvotes = downvotes - 1 WHERE id = OLD.comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_votes
AFTER INSERT OR DELETE ON comment_votes
FOR EACH ROW EXECUTE FUNCTION update_comment_votes();

-- 9. Function to update reply count
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE miniapp_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        UPDATE miniapp_comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reply_count
AFTER INSERT OR DELETE ON miniapp_comments
FOR EACH ROW EXECUTE FUNCTION update_reply_count();
