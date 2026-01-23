-- =============================================================================
-- Security: Enable RLS and tighten access for MiniApp + community tables
-- =============================================================================

-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS miniapps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS miniapp_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS miniapp_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS miniapp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS miniapp_tx_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS miniapp_stats_rollup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_proof_of_interaction ENABLE ROW LEVEL SECURITY;

-- Public read policies (read-only via anon for discovery + realtime)
DROP POLICY IF EXISTS public_read_miniapps ON miniapps;
CREATE POLICY public_read_miniapps ON miniapps
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_miniapp_stats ON miniapp_stats;
CREATE POLICY public_read_miniapp_stats ON miniapp_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_miniapp_stats_daily ON miniapp_stats_daily;
CREATE POLICY public_read_miniapp_stats_daily ON miniapp_stats_daily
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_miniapp_notifications ON miniapp_notifications;
CREATE POLICY public_read_miniapp_notifications ON miniapp_notifications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_miniapp_tx_events ON miniapp_tx_events;
CREATE POLICY public_read_miniapp_tx_events ON miniapp_tx_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_social_comments ON social_comments;
CREATE POLICY public_read_social_comments ON social_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_social_comment_votes ON social_comment_votes;
CREATE POLICY public_read_social_comment_votes ON social_comment_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_social_ratings ON social_ratings;
CREATE POLICY public_read_social_ratings ON social_ratings
  FOR SELECT USING (true);

-- Service-role-only policies (all writes + internal tables)
DROP POLICY IF EXISTS service_role_all_miniapps ON miniapps;
CREATE POLICY service_role_all_miniapps ON miniapps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_miniapp_stats ON miniapp_stats;
CREATE POLICY service_role_all_miniapp_stats ON miniapp_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_miniapp_stats_daily ON miniapp_stats_daily;
CREATE POLICY service_role_all_miniapp_stats_daily ON miniapp_stats_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_miniapp_notifications ON miniapp_notifications;
CREATE POLICY service_role_all_miniapp_notifications ON miniapp_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_miniapp_tx_events ON miniapp_tx_events;
CREATE POLICY service_role_all_miniapp_tx_events ON miniapp_tx_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_miniapp_stats_rollup_log ON miniapp_stats_rollup_log;
CREATE POLICY service_role_all_miniapp_stats_rollup_log ON miniapp_stats_rollup_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_social_comments ON social_comments;
CREATE POLICY service_role_all_social_comments ON social_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_social_comment_votes ON social_comment_votes;
CREATE POLICY service_role_all_social_comment_votes ON social_comment_votes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_social_ratings ON social_ratings;
CREATE POLICY service_role_all_social_ratings ON social_ratings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF to_regclass('public.social_proof_of_interaction') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS service_role_all_social_proof ON social_proof_of_interaction';
    EXECUTE 'CREATE POLICY service_role_all_social_proof ON social_proof_of_interaction FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
