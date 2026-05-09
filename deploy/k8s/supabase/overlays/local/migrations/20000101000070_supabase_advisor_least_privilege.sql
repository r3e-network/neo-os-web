-- Migration 070: tighten Supabase advisor findings without exposing service-only data.
--
-- Goals:
-- - set deterministic search_path on public functions to avoid search-path hijacking
-- - remove SECURITY DEFINER from public-read rating aggregation
-- - make sensitive RPCs service-role only
-- - remove broad anon/public write policies from legacy service tables
-- - switch security-definer views to security-invoker where public access is still intended

-- 1) Set search_path on existing public functions that do not define one.
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end
$$;

-- 2) Public rating aggregation does not need SECURITY DEFINER; it only reads public ratings.
do $$
begin
  if to_regprocedure('public.calculate_app_rating_weighted(text)') is not null then
    alter function public.calculate_app_rating_weighted(text) security invoker;
  end if;
end
$$;

-- 3) Sensitive SECURITY DEFINER RPCs are only for server/Edge service-role callers.
revoke execute on function public.check_spam_limit(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.log_spam_action(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.rate_limit_bump(text, text, integer) from public, anon, authenticated;
revoke execute on function public.trigger_internal_miniapp_sync(text, text, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.verify_api_key(text) from public, anon, authenticated;
revoke execute on function public.verify_user_interaction(text, uuid) from public, anon, authenticated;

grant execute on function public.check_spam_limit(uuid, text, text, integer, integer) to service_role;
grant execute on function public.log_spam_action(uuid, text, text) to service_role;
grant execute on function public.rate_limit_bump(text, text, integer) to service_role;
grant execute on function public.trigger_internal_miniapp_sync(text, text, text, boolean, text, text) to service_role;
grant execute on function public.verify_api_key(text) to service_role;
grant execute on function public.verify_user_interaction(text, uuid) to service_role;

-- 4) Remove known broad public/anon policies that allowed unrestricted writes.
do $$
declare
  item text;
  parts text[];
begin
  foreach item in array array[
    'account_balances|anon_all',
    'email_verifications|Allow all on verifications',
    'notification_events|Allow all on events',
    'notification_preferences|Allow all on preferences',
    'pool_account_balances|Service role full access',
    'pool_accounts|anon_all',
    'price_feeds|Service role full access',
    'simulation_txs|anon_all',
    'user_collections|Users can delete own collections',
    'user_collections|Users can insert own collections'
  ]
  loop
    parts := string_to_array(item, '|');
    if to_regclass(format('public.%I', parts[1])) is not null then
      execute format('drop policy if exists %I on public.%I', parts[2], parts[1]);
    end if;
  end loop;
end
$$;

-- 5) Service-only tables: no direct public Data API access; explicit deny policy prevents
-- accidental future grants from becoming readable/writable rows.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'account_balances',
    'api_keys',
    'email_verifications',
    'notification_events',
    'notification_preferences',
    'pool_account_balances',
    'pool_accounts',
    'secrets',
    'simulation_txs',
    'user_activity',
    'user_collections'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
      execute format('grant all on table public.%I to service_role', table_name);
      execute format('drop policy if exists %I on public.%I', 'deny_public_all', table_name);
      execute format(
        'create policy %I on public.%I for all to public using (false) with check (false)',
        'deny_public_all',
        table_name
      );
    end if;
  end loop;
end
$$;

-- 6) Price feed rows remain publicly readable but never publicly writable.
do $$
begin
  if to_regclass('public.price_feeds') is not null then
    alter table public.price_feeds enable row level security;
    revoke all on table public.price_feeds from public, anon, authenticated;
    grant select on table public.price_feeds to anon, authenticated;
    grant all on table public.price_feeds to service_role;

    drop policy if exists "Anon read access" on public.price_feeds;
    drop policy if exists price_feeds_public_read on public.price_feeds;
    create policy price_feeds_public_read
      on public.price_feeds
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

-- 7) Security-invoker views. latest_prices stays public SELECT through price_feeds RLS.
do $$
begin
  if to_regclass('public.latest_prices') is not null then
    alter view public.latest_prices set (security_invoker = true);
    revoke all on table public.latest_prices from public, anon, authenticated;
    grant select on table public.latest_prices to anon, authenticated;
  end if;

  if to_regclass('public.miniapp_registry_view') is not null then
    alter view public.miniapp_registry_view set (security_invoker = true);
    revoke all on table public.miniapp_registry_view from public, anon, authenticated;
  end if;
end
$$;
