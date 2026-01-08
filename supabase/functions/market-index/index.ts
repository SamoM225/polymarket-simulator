// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  lmsrB,
  lmsrDeltaForPayment,
  lmsrPrices,
  lmsrSellPayout,
  type OutcomeId,
  type Pools,
} from "./lmsr.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Vytvorí HTTP response s CORS hlavičkami.
 */
function respond(body: string, status = 200) {
  return new Response(body, { status, headers: corsHeaders });
}

interface ActionPayload {
  marketId: string;
  outcomeId?: OutcomeId;
  amount?: number;
  positionId?: string;
  userId?: string;
}

/**
 * Získa user ID z JWT tokenu alebo použije fallback.
 */
async function resolveUserId(token: string | null, fallback?: string) {
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  }
  return fallback ?? null;
}

/**
 * Limituje stávku na max. 10% celkového poolu.
 */
function clampAmount(amount: number, pools: Pools) {
  const totalPool = pools.home + pools.draw + pools.away;
  const maxStake = totalPool * 0.1;
  return Math.min(amount, maxStake);
}

/**
 * Načíta market a jeho outcomes z databázy.
 * 
 * @throws Error ak market alebo outcomes neexistujú
 */
async function loadMarket(marketId: string) {
  const { data: market, error: mErr } = await supabase.from("markets").select("*").eq("id", marketId).single();
  if (mErr || !market) throw new Error("Market not found");

  const { data: outcomes, error: oErr } = await supabase.from("outcomes").select("*").eq("market_id", marketId);
  if (oErr || !outcomes?.length) throw new Error("Outcomes not found");

  const pools: Pools = {
    home: Number(outcomes.find((o: any) => o.outcome_id === "home")?.pool ?? 0),
    draw: Number(outcomes.find((o: any) => o.outcome_id === "draw")?.pool ?? 0),
    away: Number(outcomes.find((o: any) => o.outcome_id === "away")?.pool ?? 0),
  };
  
  const totalPool = pools.home + pools.draw + pools.away;

  return { market, outcomes, pools, totalPool };
}

/**
 * Spracuje stávku používateľa.
 * Aktualizuje pool, pozíciu, balance a zapíše históriu + trade audit.
 */
async function handlePlaceBet(userId: string, payload: ActionPayload) {
  if (!payload.marketId || !payload.outcomeId || !payload.amount) {
    return respond("Missing fields", 400);
  }
  const { market, pools, totalPool } = await loadMarket(payload.marketId);
  const amount = clampAmount(payload.amount, pools);
  if (amount <= 0) return respond("Amount too small", 400);

  const { data: userRow, error: userErr } = await supabase.from("users").select("balance").eq("id", userId).maybeSingle();
  if (userErr) return respond("User balance fetch failed", 500);
  const currentBalance = Number(userRow?.balance ?? 0);
  if (currentBalance < amount) return respond("Insufficient balance", 400);

  const b = lmsrB(totalPool);
  const deltaResult = lmsrDeltaForPayment(pools, b, payload.outcomeId, amount);
  if (!deltaResult) return respond("Pricing failed", 400);
  const { delta, avgPrice } = deltaResult;

  const nextPools: Pools = { ...pools, [payload.outcomeId]: pools[payload.outcomeId] + delta } as Pools;
  const probs = lmsrPrices(nextPools, b);

  const { data: existing } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", userId)
    .eq("market_id", payload.marketId)
    .eq("outcome_id", payload.outcomeId)
    .single();

  const newShares = (existing?.shares ?? 0) + delta;
  const newAmount = (existing?.amount_spent ?? 0) + amount;
  const newAvg = newAmount / newShares;

  await supabase.from("positions").upsert(
    {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      market_id: payload.marketId,
      outcome_id: payload.outcomeId,
      shares: newShares,
      avg_price: newAvg,
      amount_spent: newAmount,
      created_at: existing?.created_at ?? new Date().toISOString(),
    },
    { onConflict: "user_id,market_id,outcome_id" },
  );

  const { error: outcomeErr } = await supabase
    .from("outcomes")
    .update({ pool: nextPools[payload.outcomeId] })
    .eq("market_id", payload.marketId)
    .eq("outcome_id", payload.outcomeId);
  if (outcomeErr) return respond("Outcome update failed", 500);

  const { error: histErr } = await supabase.from("history").insert({
    market_id: payload.marketId,
    prob_home: probs.home,
    prob_draw: probs.draw,
    prob_away: probs.away,
    ts: new Date().toISOString(),
  });
  if (histErr) return respond("History insert failed", 500);

  const { error: marketErr } = await supabase
    .from("markets")
    .update({ liquidity: Number(market.liquidity ?? 0) + amount })
    .eq("id", payload.marketId);
  if (marketErr) return respond("Market update failed", 500);

  const newBalance = currentBalance - amount;
  const { error: balErr } = await supabase
    .from("users")
    .upsert({ id: userId, balance: newBalance }, { onConflict: "id" });
  if (balErr) return respond("Balance update failed", 500);

  const { error: tradeErr } = await supabase.from("trades").insert({
    user_id: userId,
    market_id: payload.marketId,
    outcome_id: payload.outcomeId,
    side: "buy",
    shares: delta,
    price: avgPrice,
    amount,
  });
  if (tradeErr) return respond("Trade insert failed", 500);

  return respond(JSON.stringify({ status: "ok", balance: newBalance }), 200);
}

/**
 * Uzavrie pozíciu používateľa a vyplatí mu peniaze podľa LMSR.
 */
async function handleClosePosition(userId: string, payload: ActionPayload) {
  if (!payload.positionId || !payload.marketId || !payload.outcomeId) {
    return respond("Missing fields", 400);
  }
  const { market, pools, totalPool } = await loadMarket(payload.marketId);

  const { data: posById } = await supabase
    .from("positions")
    .select("*")
    .eq("id", payload.positionId)
    .eq("user_id", userId)
    .maybeSingle();
  const { data: posByOutcome } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", userId)
    .eq("market_id", payload.marketId)
    .eq("outcome_id", payload.outcomeId)
    .maybeSingle();
  const pos = posById ?? posByOutcome;
  if (!pos) return respond("Position not found", 404);

  const b = lmsrB(totalPool);
  const payout = lmsrSellPayout(pools, b, payload.outcomeId!, Number(pos.shares ?? 0));

  const nextPools: Pools = {
    ...pools,
    [payload.outcomeId!]: Math.max(pools[payload.outcomeId!] - Number(pos.shares ?? 0), 0),
  } as Pools;
  const probs = lmsrPrices(nextPools, b);

  const { error: delErr } = await supabase.from("positions").delete().eq("id", pos.id);
  if (delErr) return respond("Position delete failed", 500);
  const { error: outErr } = await supabase
    .from("outcomes")
    .update({ pool: nextPools[payload.outcomeId!] })
    .eq("market_id", payload.marketId)
    .eq("outcome_id", payload.outcomeId);
  if (outErr) return respond("Outcome update failed", 500);
  const { error: histErr2 } = await supabase
    .from("history")
    .insert({
      market_id: payload.marketId,
      prob_home: probs.home,
      prob_draw: probs.draw,
      prob_away: probs.away,
      ts: new Date().toISOString(),
    });
  if (histErr2) return respond("History insert failed", 500);

  const newLiquidity = Math.max(0, Number(market.liquidity ?? 0) - payout);
  const { error: marketErr } = await supabase
    .from("markets")
    .update({ liquidity: newLiquidity })
    .eq("id", payload.marketId);
  if (marketErr) return respond("Market update failed", 500);

  const { data: userRow } = await supabase.from("users").select("balance").eq("id", userId).single();
  const currentBalance = Number(userRow?.balance ?? 0);
  const newBalance = currentBalance + payout;
  const { error: balErr } = await supabase.from("users").upsert({ id: userId, balance: newBalance }, { onConflict: "id" });
  if (balErr) return respond("Balance update failed", 500);

  const sellPrice = Number(pos.shares ?? 0) > 0 ? payout / Number(pos.shares ?? 0) : 0;
  const { error: tradeErr } = await supabase.from("trades").insert({
    user_id: userId,
    market_id: payload.marketId,
    outcome_id: payload.outcomeId,
    side: "sell",
    shares: pos.shares ?? 0,
    price: sellPrice,
    amount: payout,
  });
  if (tradeErr) return respond("Trade insert failed", 500);

  return respond(JSON.stringify({ status: "ok", payout, balance: newBalance }), 200);
}

/** Bot používatelia pre simuláciu */
const BOT_USER_IDS = [
  "f168def6-0358-4117-9257-15c8984aadf5",
  "c7b34e02-c76e-4a0a-b94d-95365adf05d6",
];

/**
 * Spracuje simulačný tick - automatická stávka od bota.
 * Používa sa na simuláciu pohybu trhu.
 */
async function handleSimulationTick(payload: ActionPayload) {
  if (!payload.marketId || !payload.outcomeId || !payload.amount) {
    return respond("Missing fields", 400);
  }
  const { market, pools, totalPool } = await loadMarket(payload.marketId);
  const amount = clampAmount(payload.amount, pools);
  if (amount <= 0) return respond("Amount too small", 400);
  const b = lmsrB(totalPool);
  const deltaResult = lmsrDeltaForPayment(pools, b, payload.outcomeId, amount);
  if (!deltaResult) return respond("Pricing failed", 400);
  const { delta, avgPrice } = deltaResult;

  const botUserId = BOT_USER_IDS[Math.floor(Math.random() * BOT_USER_IDS.length)];

  const nextPools: Pools = { ...pools, [payload.outcomeId]: pools[payload.outcomeId] + delta } as Pools;
  const probs = lmsrPrices(nextPools, b);

  const { data: existing } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", botUserId)
    .eq("market_id", payload.marketId)
    .eq("outcome_id", payload.outcomeId)
    .single();

  const newShares = (existing?.shares ?? 0) + delta;
  const newAmount = (existing?.amount_spent ?? 0) + amount;
  const newAvg = newShares > 0 ? newAmount / newShares : 0;

  await supabase.from("positions").upsert(
    {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: botUserId,
      market_id: payload.marketId,
      outcome_id: payload.outcomeId,
      shares: newShares,
      avg_price: newAvg,
      amount_spent: newAmount,
      created_at: existing?.created_at ?? new Date().toISOString(),
    },
    { onConflict: "user_id,market_id,outcome_id" },
  );

  await supabase
    .from("outcomes")
    .update({ pool: nextPools[payload.outcomeId] })
    .eq("market_id", payload.marketId)
    .eq("outcome_id", payload.outcomeId);
  await supabase.from("history").insert({
    market_id: payload.marketId,
    prob_home: probs.home,
    prob_draw: probs.draw,
    prob_away: probs.away,
    ts: new Date().toISOString(),
  });
  await supabase
    .from("markets")
    .update({ liquidity: Number(market.liquidity ?? 0) + amount * 0.3 })
    .eq("id", payload.marketId);

  await supabase.from("trades").insert({
    user_id: botUserId,
    market_id: payload.marketId,
    outcome_id: payload.outcomeId,
    side: "buy",
    shares: delta,
    price: avgPrice,
    amount,
  });

  return respond(JSON.stringify({ status: "ok", botUserId }), 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return respond("ok", 200);
  }
  if (req.method !== "POST") {
    return respond("Method not allowed", 405);
  }
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? null;
  const { action, payload } = (await req.json()) as { action: string; payload: ActionPayload };
  // Prefer explicit userId from payload (client sends it), fallback to JWT lookup.
  const userId = payload?.userId ?? (await resolveUserId(authHeader, undefined));

  try {
    if (action === "simulation_tick") {
      return await handleSimulationTick(payload);
    }
    if (!userId) return respond("Unauthorized", 401);
    if (action === "place_bet") {
      return await handlePlaceBet(userId, payload);
    }
    if (action === "close_position") {
      return await handleClosePosition(userId, payload);
    }
    return respond("Unknown action", 400);
  } catch (error) {
    console.error(error);
    return respond("Server error", 500);
  }
});
