-- =============================================================================
-- Migration: Remove archived miniapps from all Supabase tables
-- Date: 2026-03-15
-- Description: Cleans up 17 miniapps that were archived due to being
--   duplicates, weak concepts, or overlapping with featured apps.
-- =============================================================================

BEGIN;

-- List of removed app_ids
-- candidate-vote, charity-vault, compound-capsule, ex-files, garden-of-neo,
-- grant-share, guardian-policy, hall-of-fame, heritage-trust, lottery,
-- masquerade-dao, million-piece-map, neo-news-today, piggy-bank,
-- prediction-market, social-karma, turtle-match

-- 1. Remove from main miniapps registry
DELETE FROM miniapps WHERE app_id IN (
  'miniapp-candidate-vote',
  'miniapp-charity-vault',
  'miniapp-compound-capsule',
  'miniapp-ex-files',
  'miniapp-garden-of-neo',
  'miniapp-grant-share',
  'miniapp-guardian-policy',
  'miniapp-hall-of-fame',
  'miniapp-heritage-trust',
  'miniapp-lottery',
  'miniapp-masquerade-dao',
  'miniapp-million-piece-map',
  'miniapp-neo-news-today',
  'miniapp-piggy-bank',
  'miniapp-prediction-market',
  'miniapp-social-karma',
  'miniapp-turtle-match'
);

-- 2. Remove from miniapp_usage
DELETE FROM miniapp_usage WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 3. Remove from miniapp_stats
DELETE FROM miniapp_stats WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 4. Remove from miniapp_stats_daily
DELETE FROM miniapp_stats_daily WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 5. Remove from miniapp_tx_events
DELETE FROM miniapp_tx_events WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 6. Remove from miniapp_notifications
DELETE FROM miniapp_notifications WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 7. Remove from miniapp_versions
DELETE FROM miniapp_versions WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 8. Remove from miniapp_submissions
DELETE FROM miniapp_submissions WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

-- 9. Remove from miniapp_publish_requests
DELETE FROM miniapp_publish_requests WHERE app_id IN (
  'miniapp-candidate-vote', 'miniapp-charity-vault', 'miniapp-compound-capsule',
  'miniapp-ex-files', 'miniapp-garden-of-neo', 'miniapp-grant-share',
  'miniapp-guardian-policy', 'miniapp-hall-of-fame', 'miniapp-heritage-trust',
  'miniapp-lottery', 'miniapp-masquerade-dao', 'miniapp-million-piece-map',
  'miniapp-neo-news-today', 'miniapp-piggy-bank', 'miniapp-prediction-market',
  'miniapp-social-karma', 'miniapp-turtle-match'
);

COMMIT;
