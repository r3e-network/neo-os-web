# Supabase RLS Policies

RLS will isolate data by `user_id` and `app_id` (deny-by-default).

Only service-role access (keys kept in the TEE) may perform privileged writes.

