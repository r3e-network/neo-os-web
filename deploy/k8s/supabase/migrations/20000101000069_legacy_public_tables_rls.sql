-- =============================================================================
-- Legacy public table RLS hardening
-- =============================================================================
-- Older bootstrap migrations left several public tables exposed to anon and
-- authenticated roles with full table grants and no RLS. These tables are
-- either service-layer internals or should be exposed only through sanitized
-- API/RPC responses, so direct Data API access is removed.

BEGIN;

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'attestation_artifacts',
    'chain_txs',
    'contract_events',
    'datafeeds',
    'deposits',
    'feed_updates',
    'gas_sponsor_quotas',
    'gas_sponsor_requests',
    'lottery_accounts',
    'lottery_rounds',
    'lottery_tickets',
    'merkle_roots',
    'miniapp_stats_summary',
    'miniapp_update_notifications',
    'platform_stats',
    'processed_events',
    'rate_limits',
    'secret_policies',
    'seen_requests',
    'service_requests',
    'signer_key_rotations',
    'simulation_transactions',
    'users'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v_table);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        'service_role_all_' || v_table,
        v_table
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        'service_role_all_' || v_table,
        v_table
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
