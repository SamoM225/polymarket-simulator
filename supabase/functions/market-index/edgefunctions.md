# Nasadenie Edge Functions do Supabase

Tento návod popisuje, ako nahodiť edge funkcie do Supabase projektu.

## Prehľad

Edge funkcia `market-index` spracúva všetky zápisy do databázy:
- `place_bet` - umiestnenie stávky
- `close_position` - zatvorenie pozície
- `simulation_tick` - simulované stávky od botov

## Dôležité: LMSR parameter b

Parameter `b` sa počíta z **celkového poolu** (suma všetkých outcome poolov: home + draw + away), NIE z `market.liquidity` stĺpca. Toto zabezpečuje správny slippage výpočet.

```typescript
const totalPool = pools.home + pools.draw + pools.away;
const b = lmsrB(totalPool); // b = max(300, totalPool / 4)
```

## 1. Príprava súborov

Skopíruj obsah `lmsr.ts` do novovytvoreného `lmsr.ts` v supabase, a to isté urobíme s `index.ts`

## 2. Deploy cez Supabase Dashboard

1. Otvor **Supabase Dashboard** → **Edge Functions**
2. Klikni **New Function**
3. Názov: `market-index`
4. Vlož upravený kód
5. Deploy

## 3. Environment Variables

Funkcia vyžaduje tieto premenné (automaticky dostupné v Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
