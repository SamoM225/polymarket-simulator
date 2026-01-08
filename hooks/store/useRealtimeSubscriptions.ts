"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { MarketStoreState, OutcomeId } from "../../lib/types";
import { HISTORY_LIMIT } from "./types";

type SetState = React.Dispatch<React.SetStateAction<MarketStoreState>>;

/**
 * Hook pre realtime subscriptions na Supabase.
 * Počúva na zmeny v outcomes, markets, history, positions a users.
 */
export function useRealtimeSubscriptions(userId: string | null, setState: SetState) {
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel("realtime-markets")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outcomes" },
        (payload) => handleOutcomesUpdate(payload, setState),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (payload) => handleMarketsUpdate(payload, setState),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "history" },
        (payload) => handleHistoryInsert(payload, setState),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "positions", filter: `user_id=eq.${userId}` },
        () => handlePositionsChange(userId, setState),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${userId}` },
        (payload) => handleUsersUpdate(payload, setState),
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [userId, setState]);
}

/**
 * Spracuje UPDATE udalosť z outcomes tabuľky.
 */
function handleOutcomesUpdate(
  payload: { new: Record<string, unknown> },
  setState: React.Dispatch<React.SetStateAction<MarketStoreState>>,
) {
  const row = payload.new as {
    market_id: string;
    outcome_id: OutcomeId;
    pool: number;
  };

  setState((prev) => {
    const marketIndex = prev.markets.findIndex((m) => m.id === row.market_id);
    if (marketIndex === -1) return prev;

    const market = prev.markets[marketIndex];
    const updatedOutcomes = market.outcomes.map((o) =>
      o.id === row.outcome_id ? { ...o, pool: Number(row.pool ?? o.pool) } : o,
    );
    const updatedMarket = { ...market, outcomes: updatedOutcomes };
    const nextMarkets = [...prev.markets];
    nextMarkets[marketIndex] = updatedMarket;

    return { ...prev, markets: nextMarkets };
  });
}

/**
 * Spracuje UPDATE udalosť z markets tabuľky.
 */
function handleMarketsUpdate(
  payload: { new: Record<string, unknown> },
  setState: React.Dispatch<React.SetStateAction<MarketStoreState>>,
) {
  const row = payload.new as {
    id: string;
    liquidity: number;
  };

  setState((prev) => {
    const marketIndex = prev.markets.findIndex((m) => m.id === row.id);
    if (marketIndex === -1) return prev;

    const market = prev.markets[marketIndex];
    const updatedMarket = {
      ...market,
      liquidity: Number(row.liquidity ?? market.liquidity),
    };
    const nextMarkets = [...prev.markets];
    nextMarkets[marketIndex] = updatedMarket;

    return { ...prev, markets: nextMarkets };
  });
}

/**
 * Spracuje INSERT udalosť z history tabuľky.
 * Obsahuje deduplikačnú logiku.
 */
function handleHistoryInsert(
  payload: { new: Record<string, unknown> },
  setState: React.Dispatch<React.SetStateAction<MarketStoreState>>,
) {
  const row = payload.new as {
    market_id: string;
    ts?: string;
    prob_home?: number;
    prob_draw?: number;
    prob_away?: number;
    created_at?: string;
  };

  setState((prev) => {
    const marketIndex = prev.markets.findIndex((m) => m.id === row.market_id);
    if (marketIndex === -1) return prev;

    const market = prev.markets[marketIndex];
    const historyEntry = {
      timestamp: new Date(row.ts ?? row.created_at ?? Date.now()).getTime(),
      probabilities: {
        home: Number(row.prob_home ?? 0),
        draw: Number(row.prob_draw ?? 0),
        away: Number(row.prob_away ?? 0),
      },
    };

    // Deduplikácia
    const isDuplicate = market.history.some((h) => {
      const timeSimilar = Math.abs(h.timestamp - historyEntry.timestamp) < 2000;
      const probsSimilar =
        Math.abs(h.probabilities.home - historyEntry.probabilities.home) < 0.001 &&
        Math.abs(h.probabilities.draw - historyEntry.probabilities.draw) < 0.001 &&
        Math.abs(h.probabilities.away - historyEntry.probabilities.away) < 0.001;
      return timeSimilar && probsSimilar;
    });

    if (isDuplicate) {
      return prev;
    }

    const nextHistory = [...market.history, historyEntry];
    if (nextHistory.length > HISTORY_LIMIT) nextHistory.shift();

    const updatedMarket = { ...market, history: nextHistory };
    const nextMarkets = [...prev.markets];
    nextMarkets[marketIndex] = updatedMarket;

    return { ...prev, markets: nextMarkets };
  });
}

/**
 * Spracuje zmeny v positions tabuľke.
 * Detekáuje pridané/odstránené pozície a aktualizuje správy.
 */
async function handlePositionsChange(
  userId: string,
  setState: React.Dispatch<React.SetStateAction<MarketStoreState>>,
) {
  if (!supabase) return;

  const { data } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", userId);

  if (data) {
    setState((prev) => {
      const prevIds = new Set(prev.positions.map((p) => p.id));
      const newIds = new Set(data.map((p) => p.id));
      
      // Detect if position was added (bet confirmed) or removed (position closed)
      const positionAdded = data.some((p) => !prevIds.has(p.id));
      const positionRemoved = prev.positions.some((p) => !newIds.has(p.id));
      
      // Check if we had unsynced positions that are now synced
      const hadUnsyncedBet = prev.positions.some((p) => !p.synced);
      const betConfirmed = hadUnsyncedBet && positionAdded;
      
      // Detect if closing was in progress (message contains closing indicator)
      const wasClosingPosition = prev.lastActionMessage?.toLowerCase().includes("uzatvar") ||
                                  prev.lastActionMessage?.toLowerCase().includes("zatvar");
      
      let message = prev.lastActionMessage;
      if (positionRemoved && wasClosingPosition) {
        // Position closed - show success immediately
        message = "Pozicia bola uzavreta.";
      } else if (betConfirmed) {
        message = "Stavka bola uspesne ulozena.";
      }
      
      return {
        ...prev,
        lastActionMessage: message,
        positions: data.map((p) => ({
          id: p.id,
          marketId: p.market_id,
          outcomeId: p.outcome_id,
          shares: Number(p.shares ?? 0),
          avgPrice: Number(p.avg_price ?? 0),
          amountSpent: Number(p.amount_spent ?? 0),
          createdAt: p.created_at ?? new Date().toISOString(),
          synced: true,
        })),
      };
    });
  }
}

/**
 * Spracuje UPDATE udalosť z users tabuľky (balance zmeny).
 */
function handleUsersUpdate(
  payload: { new: Record<string, unknown> },
  setState: React.Dispatch<React.SetStateAction<MarketStoreState>>,
) {
  const row = payload.new as {
    id: string;
    balance: number;
  };

  setState((prev) => {
    const newBalance = Number(row.balance ?? prev.user.balance);
    if (newBalance !== prev.user.balance) {
      return {
        ...prev,
        user: { ...prev.user, balance: newBalance },
      };
    }
    return prev;
  });
}
