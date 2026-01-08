# Polymarket Simulator 🏆

Realtime predikčný trh simulátor inšpirovaný [Polymarket](https://polymarket.com/). Postavaný na Next.js + Supabase s LMSR (Logarithmic Market Scoring Rule) algoritmom pre výpočet cien.


---

## 🚀 Lokálne spustenie

### Predpoklady

- Node.js 18+
- npm alebo pnpm

### 1. Klonovanie a inštalácia

```bash
git clone <repo-url>
cd polymarket-simulator
npm install
```

### 2. Nastavenie environment premenných

Vytvor súbor `.env` v root priečinku:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Spustenie

```bash
npm run dev
```

Otvor [http://localhost:3000](http://localhost:3000) v prehliadači.

---


## Supabase Setup

Aplikácia vyžaduje Supabase pre plnú funkcionalitu. Nasleduj tieto kroky:

### Dôležité nastavenia Auth

Pre jednoduchý demo login (bez emailovej verifikácie) nastav v Supabase Dashboard:

1. **Authentication** → **Providers** → **Email**:
   - **Vypnúť "JWT Check"** - Simple auth, nepotrebujeme reálne overenie, iba sa prihlásiť za uživateľa xy
   - **Vypnúť "Confirm email"** - používatelia sa prihlasujú ihneď bez potvrdenia

> **Ako funguje prihlásenie**: 
> - Používateľ zadá iba email
> - Ak účet neexistuje, automaticky sa vytvorí s heslom "password"  
> - Používateľ je okamžite prihlásený (žiadny email sa neposiela)

---

### Krok 1: Vytvorenie tabuliek

Otvor **Supabase Dashboard** → **SQL Editor** a spusti obsah súboru `create_tables.sql`:

#### 1.1 Tabuľky

```sql
-- =====================
-- USERS - používatelia prepojení s auth.users
-- =====================
create table if not exists public.users (
  id uuid primary key,
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint users_balance_nonnegative_chk check (balance >= 0),
  constraint users_id_fkey_auth
    foreign key (id) references auth.users(id) on delete cascade
);

-- =====================
-- MARKETS - zápasy/udalosti
-- =====================
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  league text not null,
  home_team text not null,
  away_team text not null,
  start_time timestamptz not null,
  liquidity numeric not null default 0
);

-- =====================
-- OUTCOMES - výsledky (home/draw/away) pre každý zápas
-- =====================
create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null check (outcome_id in ('home','draw','away')),
  label text not null,
  pool numeric not null default 0,
  constraint outcomes_market_outcome_unique unique (market_id, outcome_id)
);

-- =====================
-- HISTORY - história pravdepodobností (pre graf)
-- =====================
create table if not exists public.history (
  id bigserial primary key,
  market_id uuid not null references public.markets(id) on delete cascade,
  ts timestamptz not null default now(),
  prob_home numeric,
  prob_draw numeric,
  prob_away numeric
);

-- =====================
-- POSITIONS - otvorené pozície používateľov
-- =====================
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null check (outcome_id in ('home','draw','away')),
  shares numeric not null check (shares > 0),
  avg_price numeric,
  amount_spent numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint positions_user_market_outcome_unique unique (user_id, market_id, outcome_id)
);

-- =====================
-- TRADES - audit log všetkých obchodov
-- =====================
create table if not exists public.trades (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null check (outcome_id in ('home','draw','away')),
  side text not null check (side in ('buy','sell')),
  shares numeric not null,
  price numeric not null,
  amount numeric not null,
  ts timestamptz not null default now()
);
```

#### 1.2 Trigger pre automatické vytvorenie profilu

```sql
-- Automaticky vytvorí záznam v users pri registrácii
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
```

#### 1.3 Row Level Security (RLS)

```sql
-- Zapnutie RLS na všetkých tabuľkách
alter table public.users enable row level security;
alter table public.markets enable row level security;
alter table public.outcomes enable row level security;
alter table public.history enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;

-- USERS - čítanie vlastného profilu
create policy "users_select_own" on public.users
for select to authenticated using (id = auth.uid());

-- MARKETS - verejné čítanie
create policy "markets_select_public" on public.markets
for select to anon, authenticated using (true);

-- OUTCOMES - verejné čítanie
create policy "outcomes_select_public" on public.outcomes
for select to anon, authenticated using (true);

-- HISTORY - verejné čítanie
create policy "history_select_public" on public.history
for select to anon, authenticated using (true);

-- POSITIONS - iba vlastné pozície
create policy "positions_select_own" on public.positions
for select to authenticated using (user_id = auth.uid());

-- TRADES - iba vlastné obchody
create policy "trades_select_own" on public.trades
for select to authenticated using (user_id = auth.uid());
```

#### 1.4 Realtime povolenia

```sql
-- Pridanie tabuliek do Realtime publikácie
alter publication supabase_realtime add table outcomes;
alter publication supabase_realtime add table markets;
alter publication supabase_realtime add table positions;
alter publication supabase_realtime add table history;
alter publication supabase_realtime add table users;
```

---

### Krok 2: Seed dáta (voliteľné)

Pre testovacie zápasy spusti `create_seed.sql` v SQL Editore. Tento skript:
- Vytvorí 2 testovacie zápasy (Arsenal-Chelsea, Real-Barcelona)
- Priradí pozície existujúcim auth používateľom
- Vytvorí počiatočnú históriu pravdepodobností

---

### Krok 3: Edge funkcie

Edge funkcie spracúvajú zápisy do databázy (stávky, zatvorenie pozícií).

#### 3.1 Príprava súborov

1. Skopíruj obsah `supabase/functions/market-index/index.ts`
2. Skopíruj obsah `supabase/functions/market-index/_shared/lmsr.ts`

#### 3.2 Vytvorenie v Supabase

1. **Supabase Dashboard** → **Edge Functions** → **New Function**
2. Názov: `market-index`
3. Vlož kód z `index.ts`

## LMSR Model

Cost funkcia:
```
C(q) = b * ln(Σ exp(q_i / b))
```

- **Pravdepodobnosť**: `p_i = exp(q_i/b) / Σ exp(q_j/b)`
- **Cena nákupu**: `C(q + Δ) - C(q)`
- **Parameter b**: odvodzuje sa z likvidity (vyššie b = menší slippage)

---

## Dostupné skripty

```bash
npm run dev      # Vývojový server
npm run build    # Produkčný build
npm run start    # Spustenie produkcie
```

