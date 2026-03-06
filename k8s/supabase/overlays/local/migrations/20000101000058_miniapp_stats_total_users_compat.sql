-- Ensure compatibility between stats rollup schema (`total_users`,
-- `total_gas_used`, `daily_active_users`, ...) and host-app schema
-- (`total_unique_users`, `total_volume_gas`, `active_users_daily`, ...).

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'miniapp_stats'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'total_users'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN total_users BIGINT NOT NULL DEFAULT 0;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'total_unique_users'
        ) THEN
            UPDATE public.miniapp_stats
            SET total_users = COALESCE(total_unique_users, total_users)
            WHERE (total_users IS NULL OR total_users = 0)
              AND total_unique_users IS NOT NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'total_gas_used'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN total_gas_used NUMERIC NOT NULL DEFAULT 0;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'total_volume_gas'
        ) THEN
            UPDATE public.miniapp_stats
            SET total_gas_used = CASE
                WHEN total_volume_gas IS NULL THEN total_gas_used
                WHEN trim(total_volume_gas::text) ~ '^-?[0-9]+(\.[0-9]+)?$' THEN total_volume_gas::numeric
                ELSE total_gas_used
            END
            WHERE total_volume_gas IS NOT NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'total_gas_earned'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN total_gas_earned NUMERIC NOT NULL DEFAULT 0;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'method_calls'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN method_calls JSONB NOT NULL DEFAULT '{}'::jsonb;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'daily_active_users'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN daily_active_users INTEGER NOT NULL DEFAULT 0;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'active_users_daily'
        ) THEN
            UPDATE public.miniapp_stats
            SET daily_active_users = CASE
                WHEN active_users_daily IS NULL THEN daily_active_users
                WHEN trim(active_users_daily::text) ~ '^-?[0-9]+$' THEN active_users_daily::integer
                ELSE daily_active_users
            END
            WHERE active_users_daily IS NOT NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'weekly_active_users'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN weekly_active_users INTEGER NOT NULL DEFAULT 0;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'active_users_weekly'
        ) THEN
            UPDATE public.miniapp_stats
            SET weekly_active_users = CASE
                WHEN active_users_weekly IS NULL THEN weekly_active_users
                WHEN trim(active_users_weekly::text) ~ '^-?[0-9]+$' THEN active_users_weekly::integer
                ELSE weekly_active_users
            END
            WHERE active_users_weekly IS NOT NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'stats_updated_at'
        ) THEN
            ALTER TABLE public.miniapp_stats
                ADD COLUMN stats_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'miniapp_stats'
              AND column_name = 'updated_at'
        ) THEN
            UPDATE public.miniapp_stats
            SET stats_updated_at = COALESCE(updated_at, stats_updated_at)
            WHERE stats_updated_at IS NULL;
        END IF;
    END IF;
END $$;

COMMIT;
