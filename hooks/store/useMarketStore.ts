"use client";

import { useCallback, useRef, useState } from "react";
import { MarketStoreState, OutcomeId, SimulationState } from "../../lib/types";

import { initialState, MarketAction, MAX_POSITIONS } from "./types";
import { sendEdgeAction, useUserStateRef } from "./useEdgeActions";
import { useMarketData } from "./useMarketData";
import { useRealtimeSubscriptions } from "./useRealtimeSubscriptions";
import { useSimulation } from "./useSimulation";
import { marketReducer } from "./marketReducer";
import { useAuth } from "./useAuth";

/**
 * Hlavný store hook pre správu stavu trhov, pozícií a používateľa.
 * Kombinuje reducer pattern s realtime subscriptions.
 */
export function useMarketStore() {
  const [state, setState] = useState<MarketStoreState>(initialState);

  const postActionRef = useRef<(() => void) | null>(null);
  const userRef = useUserStateRef(state.user);

  const boundSendEdgeAction = useCallback(
    (
      action: "place_bet" | "close_position" | "simulation_tick",
      payload: Record<string, unknown>,
    ) => sendEdgeAction(action, payload, userRef),
    [userRef],
  );

  const dispatch = useCallback(
    (action: MarketAction) => {
      setState((prev) => {
        const next = marketReducer(prev, action, {
          sendEdgeAction: boundSendEdgeAction,
          postActionRef,
          setState,
        });
        return next;
      });

      queueMicrotask(() => {
        postActionRef.current?.();
        postActionRef.current = null;
      });
    },
    [boundSendEdgeAction],
  );

  useMarketData(setState);
  useRealtimeSubscriptions(state.user.id, setState);
  useSimulation(state.simulation, state.markets, dispatch);

  const { handleLogin, handleLogout, handleAddBalance } = useAuth(setState);

  const selectMarket = useCallback(
    (marketId: string) => dispatch({ type: "select_market", marketId }),
    [dispatch],
  );

  const placeBet = useCallback(
    (marketId: string, outcomeId: OutcomeId, amount: number) => {
      if (!state.user.id) return;
      dispatch({ type: "place_bet", marketId, outcomeId, amount, actor: state.user.id });
    },
    [dispatch, state.user.id],
  );

  const closePosition = useCallback(
    (positionId: string) => dispatch({ type: "close_position", positionId }),
    [dispatch],
  );

  const toggleSimulation = useCallback(
    (status: SimulationState["status"]) =>
      dispatch({ type: "toggle_simulation", status, controllerId: state.user.id ?? undefined }),
    [dispatch, state.user.id],
  );

  const clearMessage = useCallback(
    () => dispatch({ type: "set_message", message: undefined }),
    [dispatch],
  );

  const selectedMarket = state.markets.find((m) => m.id === state.selectedMarketId) ?? null;
  const userPositions = state.positions;
  const marketHistory = selectedMarket
    ? state.historyByMarket[selectedMarket.id] ?? []
    : [];

  return {
    markets: state.markets,
    selectedMarketId: state.selectedMarketId,
    selectedMarket,
    positions: userPositions,
    user: state.user,
    simulation: state.simulation,
    loadingMarkets: state.loadingMarkets,
    loadingUserState: state.loadingUserState,
    lastActionMessage: state.lastActionMessage,
    marketHistory,

    selectMarket,
    placeBet,
    closePosition,
    toggleSimulation,
    clearMessage,
    login: handleLogin,
    logout: handleLogout,
    addBalance: handleAddBalance,

    maxPositions: MAX_POSITIONS,
  };
}
