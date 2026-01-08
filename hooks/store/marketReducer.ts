"use client";

import {
  clampBetToLimits,
  formatCurrency,
  lmsrB,
  lmsrDeltaForPayment,
  lmsrSellPayout,
} from "../../lib/marketUtils";
import { MarketStoreState, OutcomeId, Position, SimulationState } from "../../lib/types";
import { SUPABASE_WRITE_THROUGH } from "../../lib/config";
import { loadSettings } from "../../lib/settingsStore";
import { MarketAction, MAX_POSITIONS, COOLDOWN_MS } from "./types";

type SendEdgeActionFn = (
  action: "place_bet" | "close_position" | "simulation_tick",
  payload: Record<string, unknown>,
) => Promise<boolean>;

interface ReducerContext {
  sendEdgeAction: SendEdgeActionFn;
  postActionRef: React.MutableRefObject<(() => void) | null>;
  setState: React.Dispatch<React.SetStateAction<MarketStoreState>>;
}

/**
 * Hlavný reducer pre spracovanie akcií v market store.
 * Spracováva stávky, pozície a simuláciu.
 */
export function marketReducer(
  prev: MarketStoreState,
  action: MarketAction,
  context: ReducerContext,
): MarketStoreState {
  const { sendEdgeAction, postActionRef, setState } = context;

  postActionRef.current = null;

  switch (action.type) {
    case "select_market":
      return handleSelectMarket(prev, action);
    case "set_message":
      return handleSetMessage(prev, action);
    case "toggle_simulation":
      return handleToggleSimulation(prev, action);
    case "simulation_tick":
      return handleSimulationTick(prev, action, { sendEdgeAction, postActionRef });
    case "place_bet":
      return handlePlaceBet(prev, action, { sendEdgeAction, postActionRef, setState });
    case "close_position":
      return handleClosePosition(prev, action, { sendEdgeAction, postActionRef });
    default:
      return prev;
  }
}

function handleSelectMarket(
  prev: MarketStoreState,
  action: { type: "select_market"; marketId: string },
): MarketStoreState {
  if (prev.selectedMarketId === action.marketId) return prev;
  return { ...prev, selectedMarketId: action.marketId };
}

function handleSetMessage(
  prev: MarketStoreState,
  action: { type: "set_message"; message?: string },
): MarketStoreState {
  return { ...prev, lastActionMessage: action.message };
}

function handleToggleSimulation(
  prev: MarketStoreState,
  action: { type: "toggle_simulation"; status: SimulationState["status"]; controllerId?: string },
): MarketStoreState {
  const nextSim: SimulationState = {
    ...prev.simulation,
    status: action.status,
    controllerId: action.controllerId ?? prev.user.id ?? undefined,
  };
  return { ...prev, simulation: nextSim, lastActionMessage: undefined };
}

function handleSimulationTick(
  prev: MarketStoreState,
  action: { type: "simulation_tick"; marketId: string; outcomeId: OutcomeId; amount: number; isSell?: boolean },
  context: { sendEdgeAction: SendEdgeActionFn; postActionRef: React.MutableRefObject<(() => void) | null> },
): MarketStoreState {
  const { sendEdgeAction, postActionRef } = context;

  const marketIndex = prev.markets.findIndex((m) => m.id === action.marketId);
  if (marketIndex === -1) return prev;

  const market = prev.markets[marketIndex];
  const b = lmsrB(market);
  const pools = market.outcomes.reduce((acc, o) => {
    acc[o.id] = o.pool;
    return acc;
  }, {} as Record<OutcomeId, number>);

  // Pri predaji ideme opačným smerom (záporný amount pre delta výpočet)
  const effectiveAmount = action.isSell ? -action.amount * 0.5 : action.amount;
  const deltaResult = lmsrDeltaForPayment(pools, b, action.outcomeId, Math.abs(effectiveAmount));
  if (!deltaResult) return prev;

  // Pri predaji delta ide opačne
  const delta = action.isSell ? -deltaResult.delta * 0.3 : deltaResult.delta;
  const updatedOutcomes = market.outcomes.map((o) =>
    o.id === action.outcomeId ? { ...o, pool: Math.max(100, o.pool + delta) } : o,
  );

  // Pri predaji likvidita klesá, pri nákupe rastie
  const liquidityChange = action.isSell ? -action.amount * 0.4 : action.amount * 0.3;
  const updatedMarket = {
    ...market,
    outcomes: updatedOutcomes,
    liquidity: Math.max(10000, market.liquidity + liquidityChange),
  };

  const nextMarkets = [...prev.markets];
  nextMarkets[marketIndex] = updatedMarket;

  if (SUPABASE_WRITE_THROUGH) {
    postActionRef.current = () => {
      sendEdgeAction("simulation_tick", {
        marketId: market.id,
        outcomeId: action.outcomeId,
        amount: action.amount,
      });
    };
  }

  return { ...prev, markets: nextMarkets };
}

function handlePlaceBet(
  prev: MarketStoreState,
  action: { type: "place_bet"; marketId: string; outcomeId: OutcomeId; amount: number; actor: string },
  context: ReducerContext,
): MarketStoreState {
  const { sendEdgeAction, postActionRef, setState } = context;

  if (!prev.user.authenticated) {
    return { ...prev, lastActionMessage: "Prihlas sa, az potom mozes vsadit." };
  }

  const marketIndex = prev.markets.findIndex((m) => m.id === action.marketId);
  if (marketIndex === -1) return prev;

  const market = prev.markets[marketIndex];
  const cappedAmount = clampBetToLimits(action.amount, market);

  // Cooldown check
  const now = Date.now();
  const lastBet = prev.betCooldowns[action.actor] ?? 0;
  if (now - lastBet < COOLDOWN_MS) {
    return { ...prev, lastActionMessage: "Cooldown 1s medzi stavkami." };
  }

  // Validácie
  if (action.amount <= 0) {
    return { ...prev, lastActionMessage: "Zadaj kladnu sumu." };
  }
  if (action.amount > cappedAmount) {
    return { ...prev, lastActionMessage: `Max jedna stavka je ${formatCurrency(cappedAmount)}.` };
  }

  const existingPos = prev.positions.find(
    (p) => p.marketId === market.id && p.outcomeId === action.outcomeId,
  );
  if (!existingPos && prev.positions.length >= MAX_POSITIONS) {
    return { ...prev, lastActionMessage: "Mas otvorene 3 pozicie. Najprv jednu zavri." };
  }
  if (prev.user.balance < action.amount) {
    return { ...prev, lastActionMessage: "Nedostatok prostriedkov." };
  }

  const pools = market.outcomes.reduce((acc, o) => {
    acc[o.id] = o.pool;
    return acc;
  }, {} as Record<OutcomeId, number>);
  const b = lmsrB(market);
  
  // Načítaj aktuálne fee nastavenia z localStorage
  const feeSettings = loadSettings().fee;
  const fee = feeSettings.enabled ? action.amount * feeSettings.rate : 0;
  const tradable = action.amount - fee;

  if (tradable <= 0) {
    return { ...prev, lastActionMessage: "Suma po fee je prilis mala." };
  }

  const deltaResult = lmsrDeltaForPayment(pools, b, action.outcomeId, tradable);
  if (!deltaResult) {
    return { ...prev, lastActionMessage: "Transakcia zlyhala (LMSR)." };
  }

  const { delta, avgPrice } = deltaResult;
  const updatedOutcomes = market.outcomes.map((o) =>
    o.id === action.outcomeId ? { ...o, pool: o.pool + delta } : o,
  );

  const updatedMarket = {
    ...market,
    outcomes: updatedOutcomes,
    liquidity: market.liquidity + tradable,
  };

  // Aktualizácia pozícií
  let newPositions: Position[];
  let createdPositionId: string | null = null;

  if (existingPos) {
    const totalShares = existingPos.shares + delta;
    const totalCost = existingPos.amountSpent + action.amount;
    const newAvg = totalCost / totalShares;
    newPositions = prev.positions.map((p) =>
      p.id === existingPos.id
        ? { ...p, shares: totalShares, avgPrice: newAvg, amountSpent: totalCost }
        : p,
    );
  } else {
    const newPosition: Position = {
      id: crypto.randomUUID(),
      marketId: market.id,
      outcomeId: action.outcomeId,
      shares: delta,
      avgPrice,
      amountSpent: action.amount,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    newPositions = [...prev.positions, newPosition];
    createdPositionId = newPosition.id;
  }

  const nextMarkets = [...prev.markets];
  nextMarkets[marketIndex] = updatedMarket;
  const nextCooldowns = { ...prev.betCooldowns, [action.actor]: now };

  // Edge action
  if (SUPABASE_WRITE_THROUGH) {
    const positionIdToSync = createdPositionId;
    const existingPosId = existingPos?.id ?? null;
    const prevState = {
      positions: prev.positions,
      userBalance: prev.user.balance,
      markets: prev.markets,
    };

    postActionRef.current = () => {
      sendEdgeAction("place_bet", {
        marketId: market.id,
        outcomeId: action.outcomeId,
        amount: action.amount,
      }).then((ok) => {
        if (ok && positionIdToSync) {
          setState((prev2) => ({
            ...prev2,
            positions: prev2.positions.map((p) =>
              p.id === positionIdToSync ? { ...p, synced: true } : p,
            ),
          }));
        }
        if (ok && existingPosId) {
          setState((prev2) => ({
            ...prev2,
            positions: prev2.positions.map((p) =>
              p.id === existingPosId ? { ...p, synced: true } : p,
            ),
          }));
        }
        if (!ok) {
          setState((prev2) => ({
            ...prev2,
            positions: prevState.positions,
            markets: prevState.markets,
            user: { ...prev2.user, balance: prevState.userBalance },
            lastActionMessage: "Zapis do Supabase zlyhal, stavka vratena.",
          }));
        }
      });
    };
  }

  // Pre správu o fee
  const feeMessage = feeSettings.enabled ? ` s fee ${(feeSettings.rate * 100).toFixed(1)}%` : "";

  return {
    ...prev,
    markets: nextMarkets,
    positions: newPositions,
    betCooldowns: nextCooldowns,
    lastActionMessage: `Stavka ${formatCurrency(action.amount)}${feeMessage} na ${action.outcomeId}. Cakam na potvrdenie...`,
  };
}

function handleClosePosition(
  prev: MarketStoreState,
  action: { type: "close_position"; positionId: string },
  context: { sendEdgeAction: SendEdgeActionFn; postActionRef: React.MutableRefObject<(() => void) | null> },
): MarketStoreState {
  const { sendEdgeAction, postActionRef } = context;

  if (!prev.user.authenticated) {
    return { ...prev, lastActionMessage: "Prihlas sa, az potom mozes uzavriet poziciu." };
  }

  const posIndex = prev.positions.findIndex((p) => p.id === action.positionId);
  if (posIndex === -1) return prev;

  const position = prev.positions[posIndex];
  if (!position.synced) {
    return { ...prev, lastActionMessage: "Cakaj na synchronizaciu pozicie so Supabase, potom ju zavri." };
  }

  const marketIndex = prev.markets.findIndex((m) => m.id === position.marketId);
  if (marketIndex === -1) return prev;

  const market = prev.markets[marketIndex];
  const pools = market.outcomes.reduce((acc, o) => {
    acc[o.id] = o.pool;
    return acc;
  }, {} as Record<OutcomeId, number>);
  const b = lmsrB(market);
  const rawPayout = lmsrSellPayout(pools, b, position.outcomeId, position.shares);
  
  // Načítaj aktuálne fee nastavenia z localStorage
  const closeFeeSettings = loadSettings().fee;
  const fee = closeFeeSettings.enabled ? rawPayout * closeFeeSettings.rate : 0;
  const payout = rawPayout - fee;

  const updatedOutcomes = market.outcomes.map((o) =>
    o.id === position.outcomeId ? { ...o, pool: Math.max(o.pool - position.shares, 0) } : o,
  );

  const updatedMarket = { ...market, outcomes: updatedOutcomes };
  const nextMarkets = [...prev.markets];
  nextMarkets[marketIndex] = updatedMarket;

  const nextPositions = [...prev.positions];
  nextPositions.splice(posIndex, 1);

  if (SUPABASE_WRITE_THROUGH) {
    const feeRateToSend = closeFeeSettings.enabled ? closeFeeSettings.rate : 0;
    postActionRef.current = () => {
      sendEdgeAction("close_position", {
        positionId: position.id,
        marketId: market.id,
        outcomeId: position.outcomeId,
        feeRate: feeRateToSend,
      });
    };
  }

  return {
    ...prev,
    markets: nextMarkets,
    positions: nextPositions,
    lastActionMessage: `Pozicia uzatvarana, cakam na potvrdenie...`,
  };
}
