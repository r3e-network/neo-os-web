-- =============================================================================
-- Migration: Remove unsupported third-party swap miniapps
-- Date: 2026-05-03
-- Description: Neo Swap / Flamingo and NeoBurger surfaces are no longer
--   supported by the platform catalog. Remove any stale rows from production
--   Supabase tables so API catalog reads cannot republish them from DB state.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  archived_app_ids text[] := ARRAY[
    'miniapp-neo-swap',
    'miniapp-neoburger',
    'miniapp-neo-burger',
    'miniapp-flamingo',
    'miniapp-flaminggo'
  ];
BEGIN
  IF to_regclass('public.miniapp_publish_request_audit') IS NOT NULL THEN
    DELETE FROM miniapp_publish_request_audit WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_publish_requests') IS NOT NULL THEN
    DELETE FROM miniapp_publish_requests WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_submissions') IS NOT NULL THEN
    DELETE FROM miniapp_submissions WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_versions') IS NOT NULL THEN
    DELETE FROM miniapp_versions WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_release_history') IS NOT NULL THEN
    DELETE FROM miniapp_release_history WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_releases') IS NOT NULL THEN
    DELETE FROM miniapp_releases WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_tx_events') IS NOT NULL THEN
    DELETE FROM miniapp_tx_events WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_notifications') IS NOT NULL THEN
    DELETE FROM miniapp_notifications WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_stats_daily') IS NOT NULL THEN
    DELETE FROM miniapp_stats_daily WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_stats') IS NOT NULL THEN
    DELETE FROM miniapp_stats WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapp_usage') IS NOT NULL THEN
    DELETE FROM miniapp_usage WHERE app_id = ANY (archived_app_ids);
  END IF;
  IF to_regclass('public.miniapps') IS NOT NULL THEN
    DELETE FROM miniapps WHERE app_id = ANY (archived_app_ids);
  END IF;
END $$;

COMMIT;
