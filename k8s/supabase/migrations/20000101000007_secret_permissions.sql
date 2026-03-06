-- Per-secret service permissions
create table if not exists public.secret_policies (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.users(id) on delete cascade,
    secret_name text not null,
    service_id text not null,
    created_at timestamptz not null default now(),
    unique(user_id, secret_name, service_id)
);

create index if not exists secret_policies_user_idx on public.secret_policies (user_id);
create index if not exists secret_policies_secret_idx on public.secret_policies (secret_name);
