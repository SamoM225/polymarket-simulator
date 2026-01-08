export type OutcomeId = "home" | "draw" | "away";

export interface Outcome {
  id: OutcomeId;
  label: string;
  pool: number;
}

export interface MarketSnapshot {
  timestamp: number;
  probabilities: Record<OutcomeId, number>;
}

export interface Market {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  liquidity: number;
  outcomes: Outcome[];
  history: MarketSnapshot[];
}

export interface Position {
  id: string;
  marketId: string;
  outcomeId: OutcomeId;
  shares: number;
  avgPrice: number;
  amountSpent: number;
  createdAt: string;
  synced?: boolean;
}

export interface SimulationState {
  status: "idle" | "running";
  lastTickAt?: number;
  intervalMs: number;
  controllerId?: string;
}

export interface UserState {
  id: string | null;
  balance: number;
  authenticated?: boolean;
}

export interface MarketStoreState {
  markets: Market[];
  selectedMarketId: string | null;
  positions: Position[];
  user: UserState;
  simulation: SimulationState;
  betCooldowns: Record<string, number>;
  lastActionMessage?: string;
  loadingMarkets: boolean;
  loadingUserState: boolean;
  historyByMarket: Record<string, MarketSnapshot[]>;
}
