"use client";

import { useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Market, MarketStoreState, OutcomeId, Position } from "../../lib/types";
import { createInitialMarkets } from "../../lib/marketUtils";
import { getOrCreateUserId } from "../../lib/user";
import { HISTORY_LIMIT } from "./types";

type SetState = React.Dispatch<React.SetStateAction<MarketStoreState>>;

/**
 * Hook pre načítanie dát z Supabase pri inicializácii.
 * Načíta markety, outcomes, históriu a pozície používateľa.
 */
export function useMarketData(setState: SetState) {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    
    const localId = getOrCreateUserId();
    let authUserId: string | null = null;

    async function load() {
      try {
        if (!supabase) throw new Error("Supabase client missing");

        const { data: sessionData } = await supabase.auth.getSession();
        authUserId = sessionData.session?.user?.id ?? null;

        const { data: marketsData } = await supabase.from("markets").select("*");
        const { data: outcomesData } = await supabase.from("outcomes").select("*");

        const historyPromises = (marketsData ?? []).map(async (m) => {
          const { data } = await supabase!
            .from("history")
            .select("*")
            .eq("market_id", m.id)
            .order("ts", { ascending: false })
            .limit(HISTORY_LIMIT);
          return data ?? [];
        });
        const historyResults = await Promise.all(historyPromises);
        const historyData = historyResults.flat();

        const { data: positionsData } = await supabase
          .from("positions")
          .select("*")
          .eq("user_id", authUserId ?? localId);

        let userBalance = 1000;
        if (authUserId) {
          const { data: userData } = await supabase
            .from("users")
            .select("balance")
            .eq("id", authUserId)
            .maybeSingle();
          if (userData?.balance !== undefined && userData?.balance !== null) {
            userBalance = Number(userData.balance);
          } else {
            await supabase.from("users").upsert({ id: authUserId, balance: 1000 });
            userBalance = 1000;
          }
        }

        const markets = parseMarketsData(marketsData, outcomesData, historyData);

        setState((prev) => ({
          ...prev,
          markets,
          selectedMarketId: markets[0]?.id ?? null,
          positions: parsePositionsData(positionsData),
          user: {
            ...prev.user,
            id: authUserId ?? localId,
            balance: userBalance,
            authenticated: Boolean(authUserId),
          },
          lastActionMessage: markets.length
            ? "Data nacitane zo Supabase."
            : "Supabase je prazdne - pouzivam lokalny seed len v UI.",
        }));
      } catch (error) {
        console.warn("Supabase load failed, falling back to seed", error);
        const markets = createInitialMarkets();
        setState((prev) => ({
          ...prev,
          markets,
          selectedMarketId: markets[0]?.id ?? null,
          user: {
            ...prev.user,
            id: authUserId ?? localId,
            balance: 1000,
            authenticated: false,
          },
          lastActionMessage: "Vitaj v simulatore - vyber zapas a vsad.",
        }));
      }
    }

    load();
  }, [setState]);
}

/**
 * Parsuje raw dáta z databázy na Market objekty.
 */
function parseMarketsData(
  marketsData: Array<Record<string, unknown>> | null,
  outcomesData: Array<Record<string, unknown>> | null,
  historyData: Array<Record<string, unknown>> | null,
): Market[] {
  return (marketsData ?? []).map((m) => {
    const marketHistory = (historyData ?? [])
      .filter((h) => h.market_id === m.id)
      .map((h) => ({
        timestamp: new Date((h.ts ?? h.created_at ?? Date.now()) as string).getTime(),
        probabilities: {
          home: Number(h.prob_home ?? 0),
          draw: Number(h.prob_draw ?? 0),
          away: Number(h.prob_away ?? 0),
        },
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      id: m.id as string,
      sport: m.sport as string,
      league: m.league as string,
      homeTeam: m.home_team as string,
      awayTeam: m.away_team as string,
      startTime: m.start_time as string,
      liquidity: Number(m.liquidity ?? 0),
      outcomes: (outcomesData ?? [])
        .filter((o) => o.market_id === m.id)
        .map((o) => ({
          id: o.outcome_id as string,
          label: o.label as string,
          pool: Number(o.pool ?? 0),
        })),
      history: marketHistory,
    };
  }) as Market[];
}

/**
 * Parsuje raw dáta z databázy na Position objekty.
 */
function parsePositionsData(positionsData: Array<Record<string, unknown>> | null): Position[] {
  return (
    positionsData?.map((p) => ({
      id: p.id as string,
      marketId: p.market_id as string,
      outcomeId: p.outcome_id as OutcomeId,
      shares: Number(p.shares ?? 0),
      avgPrice: Number(p.avg_price ?? 0),
      amountSpent: Number(p.amount_spent ?? 0),
      createdAt: (p.created_at as string) ?? new Date().toISOString(),
      synced: true,
    })) ?? []
  );
}
