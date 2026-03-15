-- Introduce shared account pool for accountpool service and retire mixer-local pool.
-- Migration is conservative: preserve any existing mixer_pool_accounts data, add lock columns, and
-- ensure the table is named pool_accounts for the accountpool service.

do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'pool_accounts'
    ) then
        -- Ensure required lock columns exist.
        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'pool_accounts' and column_name = 'locked_by'
        ) then
            alter table public.pool_accounts add column locked_by text;
        end if;
        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'pool_accounts' and column_name = 'locked_at'
        ) then
            alter table public.pool_accounts add column locked_at timestamptz;
        end if;
    elsif exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'mixer_pool_accounts'
    ) then
        -- Rename legacy mixer table to shared pool_accounts and add lock columns.
        alter table public.mixer_pool_accounts rename to pool_accounts;

        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'pool_accounts' and column_name = 'locked_by'
        ) then
            alter table public.pool_accounts add column locked_by text;
        end if;
        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'pool_accounts' and column_name = 'locked_at'
        ) then
            alter table public.pool_accounts add column locked_at timestamptz;
        end if;
    else
        -- Fresh setup: create the shared pool table.
        create table public.pool_accounts (
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
    end if;
end $$;

create index if not exists pool_accounts_locked_by_idx on public.pool_accounts (locked_by);
create index if not exists pool_accounts_is_retiring_idx on public.pool_accounts (is_retiring);
