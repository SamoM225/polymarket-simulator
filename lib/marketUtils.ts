import { Market, MarketSnapshot, OutcomeId } from "./types";

export const OUTCOME_LABELS: Record<OutcomeId, string> = {
  home: "Domáci",
  draw: "Remíza",
  away: "Hostia",
};

/** Hex farby pre SVG chart */
export const OUTCOME_COLORS: Record<OutcomeId, string> = {
  home: "#3b82f6",
  draw: "#f59e0b",
  away: "#f43f5e",
};

export const OUTCOME_ORDER: OutcomeId[] = ["home", "draw", "away"];

type Q = [number, number, number];

const DEFAULT_B = 800;

function toQ(pools: Record<OutcomeId, number>): Q {
  return [pools.home, pools.draw, pools.away];
}

/**
 * Vypočíta LMSR parameter b z celkového poolu.
 * Vyšší b = menší slippage pri veľkých stávkach.
 */
export function lmsrB(market: Market): number {
  const totalPool = market.outcomes.reduce((sum, o) => sum + (o.pool ?? 0), 0);
  return Math.max(300, (totalPool || DEFAULT_B) / 4);
}

/**
 * LMSR cost funkcia s log-sum-exp trikom pre numerickú stabilitu.
 */
export function lmsrCost(q: Q, b: number): number {
  const a = q.map((x) => x / b);
  const m = Math.max(...a);
  const sum = a.map((v) => Math.exp(v - m)).reduce((s, v) => s + v, 0);
  return b * (m + Math.log(sum));
}

/**
 * Vráti spot ceny (pravdepodobnosti) pre každý outcome.
 */
export function lmsrPricesFromPools(
  pools: Record<OutcomeId, number>,
  b: number,
): Record<OutcomeId, number> {
  const q = toQ(pools);
  const exps = q.map((x) => Math.exp(x / b));
  const sum = exps.reduce((s, v) => s + v, 0);
  return {
    home: exps[0] / sum,
    draw: exps[1] / sum,
    away: exps[2] / sum,
  };
}

/**
 * Vypočíta cenu za nákup delta shares na daný outcome.
 */
export function lmsrPaymentForDelta(
  pools: Record<OutcomeId, number>,
  b: number,
  outcome: OutcomeId,
  delta: number,
): number {
  const q = toQ(pools);
  const before = lmsrCost(q, b);
  const nextQ: Q = [...q] as Q;
  const idx = OUTCOME_ORDER.indexOf(outcome);
  nextQ[idx] += delta;
  const after = lmsrCost(nextQ, b);
  return after - before;
}

/**
 * Nájde počet shares (delta), ktorý môžeš kúpiť za daný payment.
 * Používa binárne vyhľadávanie.
 */
export function lmsrDeltaForPayment(
  pools: Record<OutcomeId, number>,
  b: number,
  outcome: OutcomeId,
  payment: number,
): { delta: number; avgPrice: number } | null {
  const maxDelta = Math.max(0.0001, payment * 5);
  const target = payment;
  let lo = 0;
  let hi = maxDelta;
  for (let iter = 0; iter < 60; iter += 1) {
    const mid = (lo + hi) / 2;
    const cost = lmsrPaymentForDelta(pools, b, outcome, mid);
    if (Math.abs(cost - target) < 1e-6) {
      lo = hi = mid;
      break;
    }
    if (cost > target) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  const delta = (lo + hi) / 2;
  const finalCost = lmsrPaymentForDelta(pools, b, outcome, delta);
  if (delta <= 0 || !Number.isFinite(finalCost)) return null;
  return { delta, avgPrice: finalCost / delta };
}

/**
 * Vypočíta výplatu za predaj delta shares.
 */
export function lmsrSellPayout(
  pools: Record<OutcomeId, number>,
  b: number,
  outcome: OutcomeId,
  delta: number,
): number {
  return -lmsrPaymentForDelta(pools, b, outcome, -delta);
}

/**
 * Vypočíta pravdepodobnosti pre dané pooly.
 */
export function calculateProbabilities(
  pools: { [key in OutcomeId]: number },
  b?: number,
): Record<OutcomeId, number> {
  const bVal = b ?? DEFAULT_B;
  return lmsrPricesFromPools(pools, bVal);
}

/**
 * Vytvorí nový snapshot histórie z aktuálneho stavu marketu.
 */
export function nextSnapshotFromMarket(market: Market): MarketSnapshot {
  const pools = market.outcomes.reduce((acc, outcome) => {
    acc[outcome.id] = outcome.pool;
    return acc;
  }, {} as Record<OutcomeId, number>);

  return {
    timestamp: Date.now(),
    probabilities: calculateProbabilities(pools, lmsrB(market)),
  };
}

/**
 * Vráti lokálny názov pre outcome ID.
 */
export function getOutcomeLabel(outcomeId: OutcomeId): string {
  return OUTCOME_LABELS[outcomeId];
}

/**
 * Sformátuje číslo ako menu EUR v slovenskom formáte.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Sformátuje číslo ako percentá.
 */
export function formatPercentage(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Konvertuje pravdepodobnosť na cenu s min. hodnotou 0.05.
 */
export function priceFromProbability(probability: number): number {
  const floor = 0.05;
  const clamped = Math.max(probability, floor);
  return Number(clamped.toFixed(4));
}

/**
 * Limituje stávku na max. 10% poolu alebo 10% likvidity.
 */
export function clampBetToLimits(amount: number, market: Market): number {
  const totalPools = market.outcomes.reduce((sum, o) => sum + o.pool, 0);
  const tenPercentOfPool = totalPools * 0.1;
  const softMax = Math.min(tenPercentOfPool, market.liquidity * 0.1);
  return Math.max(0, Math.min(amount, softMax));
}

/**
 * Sformátuje čas začiatku zápasu.
 */
export function formatKickoff(startTime: string): string {
  const date = new Date(startTime);
  return date.toLocaleString("sk-SK", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Vytvorí deterministický RNG (xorshift) pre seedovanie.
 */
export function makeRng(seed = 123456): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Vytvorí seedované zápasy s počiatočnými poolmi a history snapshotom.
 */
export function createInitialMarkets(now = new Date(), rng: () => number = Math.random): Market[] {
  const baseLiquidity = 3000;
  const fixtures = [
    {
      id: "match-1",
      sport: "Futbal",
      league: "UEFA Champions League",
      homeTeam: "Bratislava Titans",
      awayTeam: "Praha Royals",
      startOffsetHours: 4,
    },
    {
      id: "match-2",
      sport: "Hokej",
      league: "NHL Exhibition",
      homeTeam: "Toronto Blades",
      awayTeam: "New York Storm",
      startOffsetHours: 12,
    },
    {
      id: "match-3",
      sport: "Basketbal",
      league: "EuroLeague",
      homeTeam: "Berlin Rockets",
      awayTeam: "Madrid Comets",
      startOffsetHours: 28,
    },
  ];

  return fixtures.map((fixture, index) => {
    const stagger = baseLiquidity + index * 250;
    const nowMs = now.getTime();
    const startTime = new Date(
      nowMs + fixture.startOffsetHours * 60 * 60 * 1000,
    ).toISOString();

    const pools = {
      home: stagger * (0.38 + rng() * 0.1),
      draw: stagger * (0.32 + rng() * 0.1),
      away: stagger * (0.3 + rng() * 0.1),
    } as Record<OutcomeId, number>;

    const b = Math.max(300, stagger / 4);
    const historyEntry: MarketSnapshot = {
      timestamp: nowMs,
      probabilities: calculateProbabilities(pools, b),
    };

    return {
      id: fixture.id,
      sport: fixture.sport,
      league: fixture.league,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      startTime,
      liquidity: stagger,
      outcomes: OUTCOME_ORDER.map((id) => ({
        id,
        label: OUTCOME_LABELS[id],
        pool: pools[id],
      })),
      history: [historyEntry],
    } satisfies Market;
  });
}
