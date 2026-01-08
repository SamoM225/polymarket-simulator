"use client";

import { useEffect } from "react";
import { OUTCOME_ORDER } from "../../lib/marketUtils";
import { Market, SimulationState } from "../../lib/types";
import { SIMULATION } from "../../lib/config";
import { MarketAction, pickRandom } from "./types";

/**
 * Hook pre automatickú simuláciu stávok.
 * Periodicky generátor náhodné stávky na rôzne outcomes.
 */
export function useSimulation(
  simulation: SimulationState, 
  markets: Market[], 
  dispatch: (action: MarketAction) => void
) {
  const { status, controllerId, intervalMs } = simulation;

  useEffect(() => {
    if (status !== "running" || markets.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      const market = pickRandom(markets);
      if (!market) return;

      const outcomeId = pickRandom(OUTCOME_ORDER);
      if (!outcomeId) return;

      const amount = Math.round(
        SIMULATION.minAmount + Math.random() * (SIMULATION.maxAmount - SIMULATION.minAmount),
      );

      dispatch({
        type: "simulation_tick",
        marketId: market.id,
        outcomeId,
        amount,
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [status, controllerId, intervalMs, markets, dispatch]);
}
