-- Ensure miniapp stats rollup ON CONFLICT targets exist even on drifted schemas.
-- This migration is idempotent and safe to re-run.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'miniapp_stats'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'miniapp_stats'
          AND column_name = 'app_id'
    ) THEN
        -- ON CONFLICT (app_id) requires a unique or exclusion target.
        DELETE FROM public.miniapp_stats
        WHERE app_id IS NULL;

        WITH ranked AS (
            SELECT
                ctid,
                ROW_NUMBER() OVER (
                    PARTITION BY app_id
                    ORDER BY ctid DESC
                ) AS rn
            FROM public.miniapp_stats
        )
        DELETE FROM public.miniapp_stats t
        USING ranked r
        WHERE t.ctid = r.ctid
          AND r.rn > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_miniapp_stats_app_id_uq
            ON public.miniapp_stats (app_id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'miniapp_stats_daily'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'miniapp_stats_daily'
          AND column_name = 'app_id'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'miniapp_stats_daily'
          AND column_name = 'date'
    ) THEN
        -- ON CONFLICT (app_id, date) requires a unique or exclusion target.
        DELETE FROM public.miniapp_stats_daily
        WHERE app_id IS NULL
           OR "date" IS NULL;

        WITH ranked AS (
            SELECT
                ctid,
                ROW_NUMBER() OVER (
                    PARTITION BY app_id, "date"
                    ORDER BY ctid DESC
                ) AS rn
            FROM public.miniapp_stats_daily
        )
        DELETE FROM public.miniapp_stats_daily t
        USING ranked r
        WHERE t.ctid = r.ctid
          AND r.rn > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_miniapp_stats_daily_app_date_uq
            ON public.miniapp_stats_daily (app_id, "date");
    END IF;
END $$;

COMMIT;
