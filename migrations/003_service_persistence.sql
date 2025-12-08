-- Supabase tables for Mixer, VRF, and supporting service persistence.

-- Shared pool accounts (used by accountpool service; mixer locks/uses)
create table if not exists public.pool_accounts (
    id uuid primary key,
    address text not null unique,
    balance bigint not null default 0,
    created_at timestamptz not null default now(),
    last_used_at timestamptz not null default now(),
    tx_count bigint not null default 0,
    is_retiring boolean not null default false,
    locked_by text,
    locked_at timestamptz
);

create index if not exists pool_accounts_locked_by_idx on public.pool_accounts (locked_by);
create index if not exists pool_accounts_is_retiring_idx on public.pool_accounts (is_retiring);

-- Mixer requests
create table if not exists public.mixer_requests (
    id uuid primary key,
    user_id uuid not null,
    status text not null,
    total_amount bigint not null,
    service_fee bigint not null,
    net_amount bigint not null,
    target_addresses jsonb not null default '[]'::jsonb,
    initial_splits integer not null,
    mixing_duration_seconds bigint not null,
    deposit_address text not null,
    deposit_tx_hash text,
    pool_accounts jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    deposited_at timestamptz,
    mixing_start_at timestamptz,
    delivered_at timestamptz,
    error text
);

create index if not exists mixer_requests_user_id_idx on public.mixer_requests (user_id);
create index if not exists mixer_requests_status_idx on public.mixer_requests (status);
create index if not exists mixer_requests_deposit_address_idx on public.mixer_requests (deposit_address);

-- VRF requests
create table if not exists public.vrf_requests (
    id uuid primary key,
    request_id text not null unique,
    user_id uuid,
    requester_address text,
    seed text not null,
    num_words integer not null,
    callback_gas_limit bigint not null,
    status text not null,
    random_words jsonb default '[]'::jsonb,
    proof text,
    fulfill_tx_hash text,
    error text,
    created_at timestamptz not null default now(),
    fulfilled_at timestamptz
);

create index if not exists vrf_requests_status_idx on public.vrf_requests (status);

-- Automation triggers (ensure JSON columns exist)
alter table if exists public.automation_triggers
    alter column condition type jsonb using condition::jsonb,
    alter column action type jsonb using action::jsonb;

-- Price feeds (ensure sources is JSON array)
alter table if exists public.price_feeds
    alter column sources type jsonb using sources::jsonb;
