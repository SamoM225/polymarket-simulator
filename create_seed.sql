-- =========================
-- SEED DATA (AUTH USERS LINKED) - AUTO IDS
-- =========================
with
-- 0) pick 2 existing auth users (oldest 2)
au as (
  select id
  from auth.users
  order by created_at asc
  limit 2
),

-- 1) ensure profile rows exist in public.users for those auth users (set balances)
u as (
  insert into public.users (id, balance)
  select
    au.id,
    case
      when row_number() over (order by au.id) = 1 then 1000::numeric
      else 750::numeric
    end as balance
  from au
  on conflict (id) do update
    set balance = excluded.balance
  returning id, balance
),

-- 2) markets
m as (
  insert into public.markets (
    sport, league, home_team, away_team, start_time, liquidity
  )
  values
    (
      'football',
      'Premier League',
      'Arsenal',
      'Chelsea',
      now() + interval '2 days',
      5000
    ),
    (
      'football',
      'La Liga',
      'Real Madrid',
      'Barcelona',
      now() + interval '3 days',
      4200
    )
  returning id, home_team, away_team, league
),

-- 3) outcomes (3 per market)
o as (
  insert into public.outcomes (market_id, outcome_id, label, pool)
  select
    m.id,
    v.outcome_id,
    case
      when v.outcome_id = 'home' then m.home_team
      when v.outcome_id = 'away' then m.away_team
      else 'Draw'
    end as label,
    v.pool
  from m
  cross join (
    values
      ('home', 2000::numeric),
      ('draw', 1500::numeric),
      ('away', 1500::numeric)
  ) as v(outcome_id, pool)
  returning id, market_id, outcome_id
),

-- 4) history snapshots (1 row per market)
h as (
  insert into public.history (
    market_id, prob_home, prob_draw, prob_away
  )
  select
    m.id,
    case when m.league = 'Premier League' then 0.45 else 0.40 end,
    case when m.league = 'Premier League' then 0.28 else 0.30 end,
    case when m.league = 'Premier League' then 0.27 else 0.30 end
  from m
  returning id
),

-- 5) prepare rows for positions (use the 2 auth-linked users)
pos_rows as (
  select
    (select id from u order by balance desc limit 1) as user_id,
    (select id from m where league = 'Premier League' limit 1) as market_id,
    'home'::text as outcome_id,
    50::numeric as shares,
    0.55::numeric as avg_price,
    27.5::numeric as amount_spent

  union all

  select
    (select id from u order by balance asc limit 1) as user_id,
    (select id from m where league = 'La Liga' limit 1) as market_id,
    'away'::text as outcome_id,
    30::numeric as shares,
    0.62::numeric as avg_price,
    18.6::numeric as amount_spent
),

-- 6) positions
p as (
  insert into public.positions (
    user_id, market_id, outcome_id,
    shares, avg_price, amount_spent
  )
  select
    user_id, market_id, outcome_id,
    shares, avg_price, amount_spent
  from pos_rows
  returning user_id, market_id, outcome_id, shares, avg_price, amount_spent
),

-- 7) trades (audit, mirror positions as buys)
t as (
  insert into public.trades (
    user_id, market_id, outcome_id,
    side, shares, price, amount
  )
  select
    p.user_id,
    p.market_id,
    p.outcome_id,
    'buy'::text,
    p.shares,
    p.avg_price,
    p.amount_spent
  from p
  returning id
)

select
  (select count(*) from au) as auth_users_found,
  (select count(*) from u) as profiles_upserted,
  (select count(*) from m) as markets,
  (select count(*) from o) as outcomes,
  (select count(*) from h) as history_rows,
  (select count(*) from p) as positions,
  (select count(*) from t) as trades;
