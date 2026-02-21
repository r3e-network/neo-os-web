-- =============================================================================
-- Extend MiniApp status enum to include pending (AppRegistry lifecycle)
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'app_status'
          AND e.enumlabel = 'pending'
    ) THEN
        ALTER TYPE app_status ADD VALUE 'pending';
    END IF;
END $$;
