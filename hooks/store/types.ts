import { MarketStoreState, OutcomeId, SimulationState } from "../../lib/types";

/** Maximum počet súčasných pozícií pre používateľa */
export const MAX_POSITIONS = 3;

/** Cooldown medzi stávkami v ms */
export const COOLDOWN_MS = 1000;

/** Limit záznamov histórie na market */
export const HISTORY_LIMIT = 40;

/** Typy akcií pre market reducer */
export type MarketAction =
  | { type: "select_market"; marketId: string }
  | {
      type: "place_bet";
      marketId: string;
      outcomeId: OutcomeId;
      amount: number;
      actor: string;
    }
  | { type: "close_position"; positionId: string }
  | {
      type: "simulation_tick";
      marketId: string;
      outcomeId: OutcomeId;
      amount: number;
    }
  | {
      type: "toggle_simulation";
      status: SimulationState["status"];
      controllerId?: string;
    }
  | { type: "set_message"; message?: string };

/** Počiatočný stav store */
export const initialState: MarketStoreState = {
  markets: [],
  selectedMarketId: null,
  positions: [],
  user: { id: null, balance: 0, authenticated: false },
  simulation: { status: "idle", intervalMs: 900 },
  betCooldowns: {},
  lastActionMessage: "Nacitavam data...",
  loadingMarkets: true,
  loadingUserState: false,
  historyByMarket: {},
};

/**
 * Vyberie náhodný prvok z poľa.
 */
export function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}
