export type OutcomeId = "home" | "draw" | "away";

export interface Pools {
  home: number;
  draw: number;
  away: number;
}

type Q = [number, number, number];

function toQ(pools: Pools): Q {
  return [pools.home, pools.draw, pools.away];
}

/**
 * Vypočíta LMSR parameter b z celkového poolu.
 * Parameter b riadi slippage - vyšší b = menší slippage pri veľkých stávkach.
 * 
 * @param totalPool - Suma všetkých outcome poolov (home + draw + away)
 */
export function lmsrB(totalPool: number): number {
  // Minimum b = 300 pre stabilitu, inak totalPool / 4
  return Math.max(300, (totalPool || 0) / 4 || 800);
}

/**
 * Vypočíta LMSR cost funkciu pre aktuálny stav poolov.
 * Používa log-sum-exp trik pre numerickú stabilitu.
 *
 * @param q - Vektor poolov [home, draw, away]
 * @param b - Parameter likvidity
 * @returns Cost hodnota pre aktuálny stav
 */
export function lmsrCost(q: Q, b: number): number {
  const a = q.map((x) => x / b);
  const m = Math.max(...a);
  const sum = a.map((v) => Math.exp(v - m)).reduce((s, v) => s + v, 0);
  return b * (m + Math.log(sum));
}

/**
 * Vypočíta spot ceny (pravdepodobnosti) pre každý outcome.
 *
 * @param pools - Aktuálne hodnoty poolov
 * @param b - Parameter likvidity
 * @returns Pravdepodobnosti pre home, draw, away (súčet = 1)
 */
export function lmsrPrices(pools: Pools, b: number): Pools {
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
 * Vypočíta cenu za nákup daného množstva shares.
 *
 * @param pools - Aktuálne hodnoty poolov
 * @param b - Parameter likvidity
 * @param outcome - ID outcome (home/draw/away)
 * @param delta - Počet shares na nákup
 * @returns Cena v mene za delta shares
 */
export function lmsrPaymentForDelta(pools: Pools, b: number, outcome: OutcomeId, delta: number): number {
  const q = toQ(pools);
  const before = lmsrCost(q, b);
  const nextQ: Q = [...q] as Q;
  const idx = outcome === "home" ? 0 : outcome === "draw" ? 1 : 2;
  nextQ[idx] += delta;
  const after = lmsrCost(nextQ, b);
  return after - before;
}

/**
 * Nájde počet shares (delta), ktorý môžeš kúpiť za daný payment.
 * Používa binárne vyhľadávanie pre inverziu cost funkcie.
 *
 * @param pools - Aktuálne hodnoty poolov
 * @param b - Parameter likvidity
 * @param outcome - ID outcome (home/draw/away)
 * @param payment - Suma na investovanie
 * @returns Objekt s delta a priemernou cenou, alebo null pri chybe
 */
export function lmsrDeltaForPayment(
  pools: Pools,
  b: number,
  outcome: OutcomeId,
  payment: number,
): { delta: number; avgPrice: number } | null {
  if (payment <= 0) return null;
  let lo = 0;
  let hi = Math.max(0.0001, payment * 5);
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const cost = lmsrPaymentForDelta(pools, b, outcome, mid);
    if (Math.abs(cost - payment) < 1e-6) {
      lo = hi = mid;
      break;
    }
    if (cost > payment) {
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
 * Vypočíta výplatu za predaj daného množstva shares.
 *
 * @param pools - Aktuálne hodnoty poolov
 * @param b - Parameter likvidity
 * @param outcome - ID outcome (home/draw/away)
 * @param delta - Počet shares na predaj
 * @returns Suma výplaty
 */
export function lmsrSellPayout(pools: Pools, b: number, outcome: OutcomeId, delta: number): number {
  return -lmsrPaymentForDelta(pools, b, outcome, -delta);
}
