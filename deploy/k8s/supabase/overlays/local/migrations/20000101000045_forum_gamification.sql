-- =============================================================================
-- Forum persistence + gamification leaderboard/stats helpers
-- =============================================================================

CREATE TABLE IF NOT EXISTS forum_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_wallet TEXT NOT NULL,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'feature', 'help')),
    reply_count INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    last_reply_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_app
    ON forum_threads (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_threads_activity
    ON forum_threads (app_id, is_pinned DESC, last_reply_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_threads_author
    ON forum_threads (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_wallet TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    is_solution BOOLEAN NOT NULL DEFAULT FALSE,
    upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_thread
    ON forum_replies (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_forum_replies_app
    ON forum_replies (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_replies_author
    ON forum_replies (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_wallet TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'tip')),
    tip_amount TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_app
    ON chat_messages (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
    ON chat_messages (sender_wallet, created_at DESC);

ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'forum_threads'
          AND policyname = 'service_all_forum_threads'
    ) THEN
        CREATE POLICY service_all_forum_threads
            ON forum_threads FOR ALL TO service_role
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'forum_threads'
          AND policyname = 'public_read_forum_threads'
    ) THEN
        CREATE POLICY public_read_forum_threads
            ON forum_threads FOR SELECT TO anon
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'forum_replies'
          AND policyname = 'service_all_forum_replies'
    ) THEN
        CREATE POLICY service_all_forum_replies
            ON forum_replies FOR ALL TO service_role
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'forum_replies'
          AND policyname = 'public_read_forum_replies'
    ) THEN
        CREATE POLICY public_read_forum_replies
            ON forum_replies FOR SELECT TO anon
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chat_messages'
          AND policyname = 'service_all_chat_messages'
    ) THEN
        CREATE POLICY service_all_chat_messages
            ON chat_messages FOR ALL TO service_role
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chat_messages'
          AND policyname = 'public_read_chat_messages'
    ) THEN
        CREATE POLICY public_read_chat_messages
            ON chat_messages FOR SELECT TO anon
            USING (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION forum_replies_sync_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE forum_threads
        SET
            reply_count = reply_count + 1,
            last_reply_at = NEW.created_at,
            updated_at = NOW()
        WHERE id = NEW.thread_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE forum_threads
        SET
            reply_count = GREATEST(reply_count - 1, 0),
            last_reply_at = (
                SELECT MAX(created_at)
                FROM forum_replies
                WHERE thread_id = OLD.thread_id
            ),
            updated_at = NOW()
        WHERE id = OLD.thread_id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forum_replies_sync_thread_stats_insert ON forum_replies;
CREATE TRIGGER trg_forum_replies_sync_thread_stats_insert
    AFTER INSERT ON forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION forum_replies_sync_thread_stats();

DROP TRIGGER IF EXISTS trg_forum_replies_sync_thread_stats_delete ON forum_replies;
CREATE TRIGGER trg_forum_replies_sync_thread_stats_delete
    AFTER DELETE ON forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION forum_replies_sync_thread_stats();

DROP TRIGGER IF EXISTS trg_forum_threads_updated_at ON forum_threads;
CREATE TRIGGER trg_forum_threads_updated_at
    BEFORE UPDATE ON forum_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_forum_replies_updated_at ON forum_replies;
CREATE TRIGGER trg_forum_replies_updated_at
    BEFORE UPDATE ON forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION gamification_xp(
    p_total_tx BIGINT,
    p_apps_used INTEGER,
    p_total_votes BIGINT,
    p_streak INTEGER
) RETURNS INTEGER AS $$
    SELECT LEAST(
        2147483647,
        GREATEST(
            0,
            COALESCE(p_total_tx, 0) * 10
            + COALESCE(p_apps_used, 0) * 50
            + COALESCE(p_total_votes, 0) * 25
            + COALESCE(p_streak, 0) * 15
        )
    )::INTEGER;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION gamification_level(p_xp INTEGER)
RETURNS INTEGER AS $$
    SELECT CASE
        WHEN COALESCE(p_xp, 0) >= 2000 THEN 6
        WHEN COALESCE(p_xp, 0) >= 1000 THEN 5
        WHEN COALESCE(p_xp, 0) >= 600 THEN 4
        WHEN COALESCE(p_xp, 0) >= 300 THEN 3
        WHEN COALESCE(p_xp, 0) >= 100 THEN 2
        ELSE 1
    END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION gamification_badges(
    p_total_tx BIGINT,
    p_apps_used INTEGER,
    p_total_votes BIGINT,
    p_streak INTEGER
) RETURNS TEXT[] AS $$
    SELECT array_remove(ARRAY[
        CASE WHEN COALESCE(p_total_tx, 0) >= 1 THEN 'first_tx' END,
        CASE WHEN COALESCE(p_apps_used, 0) >= 5 THEN 'app_explorer' END,
        CASE WHEN COALESCE(p_total_votes, 0) >= 1 THEN 'governor' END,
        CASE WHEN COALESCE(p_total_tx, 0) >= 100 THEN 'power_user' END,
        CASE WHEN COALESCE(p_streak, 0) >= 7 THEN 'streak_7' END,
        CASE WHEN COALESCE(p_streak, 0) >= 30 THEN 'streak_30' END
    ], NULL);
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION get_gamification_leaderboard(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    rank INTEGER,
    wallet TEXT,
    xp INTEGER,
    level INTEGER,
    badges INTEGER
) AS $$
    WITH wallet_map AS (
        SELECT
            u.id AS user_id,
            LOWER(COALESCE(NULLIF(TRIM(u.address), ''), NULLIF(TRIM(uw.address), ''))) AS wallet_key,
            COALESCE(NULLIF(TRIM(u.address), ''), NULLIF(TRIM(uw.address), '')) AS wallet_display
        FROM users u
        LEFT JOIN LATERAL (
            SELECT w.address
            FROM user_wallets w
            WHERE w.user_id = u.id
            ORDER BY w.is_primary DESC, w.created_at ASC
            LIMIT 1
        ) uw ON TRUE
    ),
    usage_agg AS (
        SELECT
            wm.wallet_key,
            MAX(wm.wallet_display) AS wallet_display,
            COALESCE(SUM(mu.tx_count), 0)::BIGINT AS total_tx,
            COALESCE(SUM(CASE WHEN mu.governance_used > 0 THEN mu.tx_count ELSE 0 END), 0)::BIGINT AS total_votes,
            COUNT(DISTINCT mu.app_id)::INTEGER AS apps_used
        FROM miniapp_usage mu
        JOIN wallet_map wm ON wm.user_id = mu.user_id
        WHERE wm.wallet_key IS NOT NULL
        GROUP BY wm.wallet_key
    ),
    tx_agg AS (
        SELECT
            LOWER(NULLIF(TRIM(sender_address), '')) AS wallet_key,
            MAX(NULLIF(TRIM(sender_address), '')) AS wallet_display,
            COUNT(*)::BIGINT AS total_tx,
            COUNT(DISTINCT app_id)::INTEGER AS apps_used
        FROM miniapp_tx_events
        WHERE sender_address IS NOT NULL
          AND NULLIF(TRIM(sender_address), '') IS NOT NULL
        GROUP BY LOWER(NULLIF(TRIM(sender_address), ''))
    ),
    combined AS (
        SELECT
            COALESCE(u.wallet_key, t.wallet_key) AS wallet_key,
            COALESCE(u.wallet_display, t.wallet_display) AS wallet_display,
            GREATEST(COALESCE(u.total_tx, 0), COALESCE(t.total_tx, 0)) AS total_tx,
            COALESCE(u.total_votes, 0) AS total_votes,
            GREATEST(COALESCE(u.apps_used, 0), COALESCE(t.apps_used, 0)) AS apps_used
        FROM usage_agg u
        FULL OUTER JOIN tx_agg t ON t.wallet_key = u.wallet_key
    ),
    scored AS (
        SELECT
            wallet_key,
            wallet_display,
            gamification_xp(total_tx, apps_used, total_votes, 0) AS xp,
            gamification_level(gamification_xp(total_tx, apps_used, total_votes, 0)) AS level,
            CARDINALITY(gamification_badges(total_tx, apps_used, total_votes, 0)) AS badges
        FROM combined
        WHERE wallet_key IS NOT NULL
    ),
    ranked AS (
        SELECT
            DENSE_RANK() OVER (ORDER BY xp DESC, wallet_key ASC)::INTEGER AS rank,
            wallet_display AS wallet,
            xp,
            level,
            badges
        FROM scored
    )
    SELECT rank, wallet, xp, level, badges
    FROM ranked
    ORDER BY rank ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_gamification_wallet_stats(p_wallet TEXT)
RETURNS TABLE(
    wallet TEXT,
    xp INTEGER,
    level INTEGER,
    badges TEXT[],
    rank INTEGER,
    streak INTEGER,
    total_tx BIGINT,
    total_votes BIGINT,
    apps_used INTEGER
) AS $$
    WITH target_wallet AS (
        SELECT
            NULLIF(TRIM(p_wallet), '') AS wallet_raw,
            LOWER(NULLIF(TRIM(p_wallet), '')) AS wallet_key
    ),
    target_user AS (
        SELECT u.id
        FROM users u
        JOIN target_wallet tw ON tw.wallet_key IS NOT NULL
        WHERE LOWER(COALESCE(u.address, '')) = tw.wallet_key
        UNION
        SELECT uw.user_id
        FROM user_wallets uw
        JOIN target_wallet tw ON tw.wallet_key IS NOT NULL
        WHERE LOWER(COALESCE(uw.address, '')) = tw.wallet_key
        LIMIT 1
    ),
    usage_totals AS (
        SELECT
            COALESCE(SUM(mu.tx_count), 0)::BIGINT AS total_tx,
            COALESCE(SUM(CASE WHEN mu.governance_used > 0 THEN mu.tx_count ELSE 0 END), 0)::BIGINT AS total_votes,
            COUNT(DISTINCT mu.app_id)::INTEGER AS apps_used
        FROM miniapp_usage mu
        JOIN target_user tu ON tu.id = mu.user_id
    ),
    tx_totals AS (
        SELECT
            COUNT(*)::BIGINT AS total_tx,
            COUNT(DISTINCT app_id)::INTEGER AS apps_used
        FROM miniapp_tx_events e
        JOIN target_wallet tw ON tw.wallet_key IS NOT NULL
        WHERE LOWER(COALESCE(e.sender_address, '')) = tw.wallet_key
    ),
    activity_days AS (
        SELECT DISTINCT mu.usage_date::DATE AS day
        FROM miniapp_usage mu
        JOIN target_user tu ON tu.id = mu.user_id
        UNION
        SELECT DISTINCT e.event_date::DATE AS day
        FROM miniapp_tx_events e
        JOIN target_wallet tw ON tw.wallet_key IS NOT NULL
        WHERE LOWER(COALESCE(e.sender_address, '')) = tw.wallet_key
    ),
    ordered_days AS (
        SELECT
            day,
            LAG(day) OVER (ORDER BY day DESC) AS prev_day
        FROM activity_days
    ),
    streak_groups AS (
        SELECT
            day,
            SUM(
                CASE
                    WHEN prev_day = day - 1 THEN 0
                    ELSE 1
                END
            ) OVER (ORDER BY day DESC) AS grp
        FROM ordered_days
    ),
    streak_value AS (
        SELECT COALESCE(COUNT(*) FILTER (WHERE grp = 1), 0)::INTEGER AS streak
        FROM streak_groups
    ),
    base AS (
        SELECT
            tw.wallet_raw AS wallet,
            CASE
                WHEN COALESCE((SELECT total_tx FROM usage_totals), 0) > 0
                    THEN COALESCE((SELECT total_tx FROM usage_totals), 0)
                ELSE COALESCE((SELECT total_tx FROM tx_totals), 0)
            END AS total_tx,
            COALESCE((SELECT total_votes FROM usage_totals), 0) AS total_votes,
            CASE
                WHEN COALESCE((SELECT apps_used FROM usage_totals), 0) > 0
                    THEN COALESCE((SELECT apps_used FROM usage_totals), 0)
                ELSE COALESCE((SELECT apps_used FROM tx_totals), 0)
            END AS apps_used,
            COALESCE((SELECT streak FROM streak_value), 0) AS streak
        FROM target_wallet tw
        WHERE tw.wallet_raw IS NOT NULL
    ),
    scored AS (
        SELECT
            wallet,
            total_tx,
            total_votes,
            apps_used,
            streak,
            gamification_xp(total_tx, apps_used, total_votes, streak) AS xp,
            gamification_level(gamification_xp(total_tx, apps_used, total_votes, streak)) AS level,
            gamification_badges(total_tx, apps_used, total_votes, streak) AS badges,
            gamification_xp(total_tx, apps_used, total_votes, 0) AS rank_xp
        FROM base
    ),
    wallet_map AS (
        SELECT
            u.id AS user_id,
            LOWER(COALESCE(NULLIF(TRIM(u.address), ''), NULLIF(TRIM(uw.address), ''))) AS wallet_key
        FROM users u
        LEFT JOIN LATERAL (
            SELECT w.address
            FROM user_wallets w
            WHERE w.user_id = u.id
            ORDER BY w.is_primary DESC, w.created_at ASC
            LIMIT 1
        ) uw ON TRUE
    ),
    usage_agg_all AS (
        SELECT
            wm.wallet_key,
            COALESCE(SUM(mu.tx_count), 0)::BIGINT AS total_tx,
            COALESCE(SUM(CASE WHEN mu.governance_used > 0 THEN mu.tx_count ELSE 0 END), 0)::BIGINT AS total_votes,
            COUNT(DISTINCT mu.app_id)::INTEGER AS apps_used
        FROM miniapp_usage mu
        JOIN wallet_map wm ON wm.user_id = mu.user_id
        WHERE wm.wallet_key IS NOT NULL
        GROUP BY wm.wallet_key
    ),
    tx_agg_all AS (
        SELECT
            LOWER(NULLIF(TRIM(sender_address), '')) AS wallet_key,
            COUNT(*)::BIGINT AS total_tx,
            COUNT(DISTINCT app_id)::INTEGER AS apps_used
        FROM miniapp_tx_events
        WHERE sender_address IS NOT NULL
          AND NULLIF(TRIM(sender_address), '') IS NOT NULL
        GROUP BY LOWER(NULLIF(TRIM(sender_address), ''))
    ),
    combined_all AS (
        SELECT
            COALESCE(u.wallet_key, t.wallet_key) AS wallet_key,
            GREATEST(COALESCE(u.total_tx, 0), COALESCE(t.total_tx, 0)) AS total_tx,
            COALESCE(u.total_votes, 0) AS total_votes,
            GREATEST(COALESCE(u.apps_used, 0), COALESCE(t.apps_used, 0)) AS apps_used
        FROM usage_agg_all u
        FULL OUTER JOIN tx_agg_all t ON t.wallet_key = u.wallet_key
        WHERE COALESCE(u.wallet_key, t.wallet_key) IS NOT NULL
    ),
    scored_all AS (
        SELECT
            wallet_key,
            gamification_xp(total_tx, apps_used, total_votes, 0) AS xp
        FROM combined_all
    ),
    rank_value AS (
        SELECT
            (
                1 + COALESCE((
                    SELECT COUNT(*)
                    FROM scored_all s
                    CROSS JOIN scored me
                    WHERE s.xp > me.rank_xp
                ), 0)
            )::INTEGER AS rank
    )
    SELECT
        scored.wallet,
        scored.xp,
        scored.level,
        scored.badges,
        rank_value.rank,
        scored.streak,
        scored.total_tx,
        scored.total_votes,
        scored.apps_used
    FROM scored
    CROSS JOIN rank_value;
$$ LANGUAGE SQL STABLE;
