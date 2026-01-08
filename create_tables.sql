-- =========================
-- SCHEMA (AUTH-LINKED)
-- =========================

create extension if not exists "pgcrypto";

-- =========
-- USERS
-- =========
create table if not exists public.users (
  id uuid primary key,
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint users_balance_nonnegative_chk check (balance >= 0),
  constraint users_id_fkey_auth
    foreign key (id) references auth.users(id) on delete cascade
);

create index if not exists users_created_at_idx
  on public.users (created_at);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, balance)
  values (new.id, 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========
-- MARKETS
-- =========
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  league text not null,
  home_team text not null,
  away_team text not null,
  start_time timestamptz not null,
  liquidity numeric not null default 0,
  constraint markets_liquidity_nonnegative_chk check (liquidity >= 0)
);

create index if not exists markets_start_time_idx
  on public.markets (start_time);

create index if not exists markets_sport_league_idx
  on public.markets (sport, league);

-- =========
-- OUTCOMES
-- =========
create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null check (outcome_id in ('home','draw','away')),
  label text not null,
  pool numeric not null default 0,
  constraint outcomes_pool_nonnegative_chk check (pool >= 0),
  constraint outcomes_market_outcome_unique unique (market_id, outcome_id)
);

create index if not exists outcomes_market_id_idx
  on public.outcomes (market_id);

-- =========
-- HISTORY
-- =========
create table if not exists public.history (
  id bigserial primary key,
  market_id uuid not null references public.markets(id) on delete cascade,
  ts timestamptz not null default now(),
  prob_home numeric,
  prob_draw numeric,
  prob_away numeric,
  constraint history_prob_home_chk check (prob_home is null or (prob_home >= 0 and prob_home <= 1)),
  constraint history_prob_draw_chk check (prob_draw is null or (prob_draw >= 0 and prob_draw <= 1)),
  constraint history_prob_away_chk check (prob_away is null or (prob_away >= 0 and prob_away <= 1))
);

create index if not exists history_market_ts_idx
  on public.history (market_id, ts desc);

-- =========
-- POSITIONS
-- =========
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null check (outcome_id in ('home','draw','away')),
  shares numeric not null check (shares > 0),
  avg_price numeric check (avg_price is null or avg_price >= 0),
  amount_spent numeric not null default 0 check (amount_spent >= 0),
  created_at timestamptz not null default now(),
  constraint positions_user_market_outcome_unique unique (user_id, market_id, outcome_id)
);

create index if not exists positions_user_market_idx
  on public.positions (user_id, market_id);

create index if not exists positions_market_outcome_idx
  on public.positions (market_id, outcome_id);

-- =========
-- TRADES (AUDIT LOG)
-- =========
create table if not exists public.trades (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null check (outcome_id in ('home','draw','away')),
  side text not null check (side in ('buy','sell')),
  shares numeric not null check (shares > 0),
  price numeric not null check (price > 0),
  amount numeric not null check (amount > 0),
  ts timestamptz not null default now()
);

create index if not exists trades_user_ts_idx
  on public.trades (user_id, ts desc);

create index if not exists trades_market_ts_idx
  on public.trades (market_id, ts desc);


-- =========================
-- RLS
-- =========================

alter table public.users enable row level security;
alter table public.markets enable row level security;
alter table public.outcomes enable row level security;
alter table public.history enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users
for insert
to authenticated
with check (id = auth.uid());

-- MARKETS
drop policy if exists "markets_select_public" on public.markets;
create policy "markets_select_public"
on public.markets
for select
to anon, authenticated
using (true);

-- OUTCOMES
drop policy if exists "outcomes_select_public" on public.outcomes;
create policy "outcomes_select_public"
on public.outcomes
for select
to anon, authenticated
using (true);

-- HISTORY
drop policy if exists "history_select_public" on public.history;
create policy "history_select_public"
on public.history
for select
to anon, authenticated
using (true);

-- POSITIONS
drop policy if exists "positions_select_own" on public.positions;
create policy "positions_select_own"
on public.positions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "positions_insert_own" on public.positions;
create policy "positions_insert_own"
on public.positions
for insert
to authenticated
with check (user_id = auth.uid());

-- TRADES
drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own"
on public.trades
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own"
on public.trades
for insert
to authenticated
with check (user_id = auth.uid());
