# Supabase RLS Policies

RLS will isolate data by `user_id` and `app_id` (deny-by-default).

Only service-role access (keys kept in the TEE) may perform privileged writes.

Current status:

- Database schema + RLS policies are currently managed under `migrations/`.
- `platform/rls/` is reserved for platform-specific RLS policies and future
  Supabase migrations as the MiniApp host/SDK/Edge layer becomes primary.
