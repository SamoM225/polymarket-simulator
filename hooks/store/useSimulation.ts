"use client";

import { useEffect, useRef } from "react";
import { clampBetToLimits, OUTCOME_ORDER } from "../../lib/marketUtils";
import { Market, SimulationState, OutcomeId } from "../../lib/types";
import { AppSettings, loadSettings } from "../../lib/settingsStore";
import { SIMULATION } from "../../lib/config";
import { MarketAction, pickRandom } from "./types";

/** Typy eventov pre vizualizáciu */
const EVENT_TYPES = ["⚽ GÓL!", "🟨 ŽLTÁ KARTA", "🟥 ČERVENÁ KARTA", "⚠️ PENALTA", "🔄 STRIEDANIE", "💥 ŠANCA!"];

/** Štýly simulovaných hráčov */
type PlayerStyle = "aggressive" | "conservative" | "momentum" | "contrarian";

interface SimPlayer {
  id: string;
  style: PlayerStyle;
  riskTolerance: number;
}

/** Vytvor hráčov z reálnych Supabase ID */
const PLAYER_STYLES: { style: PlayerStyle; riskTolerance: number }[] = [
  { style: "aggressive", riskTolerance: 0.9 },
  { style: "conservative", riskTolerance: 0.3 },
  { style: "momentum", riskTolerance: 0.6 },
  { style: "contrarian", riskTolerance: 0.7 },
];

const SIM_PLAYERS: SimPlayer[] = SIMULATION.botUserIds.map((id, index) => ({
  id,
  style: PLAYER_STYLES[index % PLAYER_STYLES.length].style,
  riskTolerance: PLAYER_STYLES[index % PLAYER_STYLES.length].riskTolerance,
}));

/** Stav simulovaných pozícií hráčov */
interface SimPosition {
  playerId: string;
  marketId: string;
  outcomeId: OutcomeId;
  shares: number;
  avgPrice: number;
}

/**
 * Hook pre automatickú simuláciu stávok.
 * Realistická simulácia s viacerými hráčmi, nákupmi aj predajmi.
 */
export function useSimulation(
  simulation: SimulationState, 
  markets: Market[], 
  dispatch: (action: MarketAction) => void,
  onEventOccurred?: (eventType: string, marketId: string, outcomeId: string) => void
) {
  const { status, controllerId, intervalMs } = simulation;
  const lastEventTimeRef = useRef<number>(0);
  const simPositionsRef = useRef<SimPosition[]>([]);
  const tickCountRef = useRef<number>(0);
  const trendRef = useRef<Record<string, { outcome: OutcomeId; strength: number }>>({});

  useEffect(() => {
    if (status !== "running" || markets.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      const settings = loadSettings();
      const now = Date.now();
      const timeSinceLastEvent = now - lastEventTimeRef.current;
      const isEventTime = timeSinceLastEvent >= settings.simulation.eventIntervalMs;
      
      tickCountRef.current++;

      const market = pickRandom(markets);
      if (!market) return;

      // Vyber náhodného hráča
      const player = pickRandom(SIM_PLAYERS);
      if (!player) return;

      // Skontroluj či hráč má pozíciu na tomto trhu
      const playerPosition = simPositionsRef.current.find(
        p => p.playerId === player.id && p.marketId === market.id
      );

      // Rozhodnutie: kúpiť, predať alebo nič
      const action = decideAction(player, playerPosition, market, isEventTime, trendRef.current[market.id]);

      if (action.type === "none") return;

      if (action.type === "buy") {
        const outcomeId = action.outcomeId!;
        let amount: number;

        if (isEventTime) {
          // Veľký event - jedna strana nakúpi, druhá predá = výrazný spike
          const maxBet = clampBetToLimits(999999, market);
          const minPercent = settings.simulation.eventMinPercent / 100;
          const maxPercent = settings.simulation.eventMaxPercent / 100;
          const eventPercent = minPercent + Math.random() * (maxPercent - minPercent);
          amount = Math.round(maxBet * eventPercent * player.riskTolerance);
          
          lastEventTimeRef.current = now;
          
          // Nastav trend
          trendRef.current[market.id] = { outcome: outcomeId, strength: 0.8 + Math.random() * 0.2 };

          if (onEventOccurred) {
            const eventType = pickRandom(EVENT_TYPES) || "⚡ EVENT";
            onEventOccurred(eventType, market.id, outcomeId);
          }

          // Opačná strana predáva (panický predaj)
          const oppositeOutcome = getOppositeOutcome(outcomeId);
          const panicSellAmount = Math.round(amount * 0.6);
          
          setTimeout(() => {
            dispatch({
              type: "simulation_tick",
              marketId: market.id,
              outcomeId: oppositeOutcome,
              amount: panicSellAmount,
              isEvent: false,
              isSell: true,
            });
          }, 100);

          // Kaskáda nákupov na víťaznú stranu
          setTimeout(() => {
            const followPlayer = pickRandom(SIM_PLAYERS.filter(p => p.style === "momentum"));
            if (followPlayer) {
              const followAmount = Math.round(amount * 0.4 * followPlayer.riskTolerance);
              dispatch({
                type: "simulation_tick",
                marketId: market.id,
                outcomeId,
                amount: followAmount,
                isEvent: false,
              });
            }
          }, 200);

          // Ďalší panický predaj opačnej strany
          setTimeout(() => {
            dispatch({
              type: "simulation_tick",
              marketId: market.id,
              outcomeId: oppositeOutcome,
              amount: Math.round(panicSellAmount * 0.5),
              isEvent: false,
              isSell: true,
            });
          }, 300);

          setTimeout(() => {
            const followPlayer2 = pickRandom(SIM_PLAYERS);
            if (followPlayer2) {
              const followAmount = Math.round(amount * 0.2 * followPlayer2.riskTolerance);
              dispatch({
                type: "simulation_tick",
                marketId: market.id,
                outcomeId,
                amount: followAmount,
                isEvent: false,
              });
            }
          }, 400);
        } else {
          // Normálny tick
          const baseAmount = settings.simulation.normalMinAmount + 
            Math.random() * (settings.simulation.normalMaxAmount - settings.simulation.normalMinAmount);
          amount = Math.round(baseAmount * player.riskTolerance);
        }

        // Ulož pozíciu hráča
        updateSimPosition(simPositionsRef.current, player.id, market.id, outcomeId, amount);

        dispatch({
          type: "simulation_tick",
          marketId: market.id,
          outcomeId,
          amount,
          isEvent: isEventTime,
        });

      } else if (action.type === "sell") {
        // Skutočný predaj - vyberanie likvidity z trhu
        const settings = loadSettings();
        const baseAmount = settings.simulation.normalMinAmount + 
          Math.random() * (settings.simulation.normalMaxAmount - settings.simulation.normalMinAmount);
        const sellAmount = Math.round(baseAmount * player.riskTolerance * 1.5);
        
        // Vyber outcome na predaj
        const outcomeToSell = playerPosition ? playerPosition.outcomeId : pickRandom(OUTCOME_ORDER)!;
        
        // Ak má pozíciu, zmenši ju
        if (playerPosition) {
          playerPosition.shares *= 0.6;
          if (playerPosition.shares < 1) {
            simPositionsRef.current = simPositionsRef.current.filter(p => p !== playerPosition);
          }
        }

        // Oslabi trend ak existuje
        if (trendRef.current[market.id]) {
          trendRef.current[market.id].strength *= 0.7;
        }

        dispatch({
          type: "simulation_tick",
          marketId: market.id,
          outcomeId: outcomeToSell,
          amount: sellAmount,
          isEvent: false,
          isSell: true,
        });
      }

      // Periodicky vyčisti staré trendy
      if (tickCountRef.current % 20 === 0) {
        Object.keys(trendRef.current).forEach(key => {
          trendRef.current[key].strength *= 0.9;
          if (trendRef.current[key].strength < 0.1) {
            delete trendRef.current[key];
          }
        });
      }

    }, intervalMs);

    return () => clearInterval(interval);
  }, [status, controllerId, intervalMs, markets, dispatch, onEventOccurred]);
}

function decideAction(
  player: SimPlayer,
  position: SimPosition | undefined,
  market: Market,
  isEvent: boolean,
  trend?: { outcome: OutcomeId; strength: number }
): { type: "buy" | "sell" | "none"; outcomeId?: OutcomeId } {
  
  // Pri evente vždy kúp
  if (isEvent) {
    const outcomeId = pickRandom(OUTCOME_ORDER)!;
    return { type: "buy", outcomeId };
  }

  // Náhodný predaj - častejšie pre vyrovnanú simuláciu
  const baseSellChance = player.style === "conservative" ? 0.35 : 0.25;
  const sellChance = position && position.shares > 3 ? baseSellChance + 0.15 : baseSellChance;
  if (Math.random() < sellChance) {
    return { type: "sell" };
  }

  // Rozhodnutie o kúpe podľa štýlu
  switch (player.style) {
    case "aggressive":
      // Agresívny hráč kupuje často
      if (Math.random() < 0.7) {
        return { type: "buy", outcomeId: pickRandom(OUTCOME_ORDER)! };
      }
      break;
      
    case "conservative":
      // Konzervatívny kupuje menej často
      if (Math.random() < 0.3) {
        return { type: "buy", outcomeId: pickRandom(OUTCOME_ORDER)! };
      }
      break;
      
    case "momentum":
      // Momentum hráč sleduje trend
      if (trend && trend.strength > 0.3 && Math.random() < 0.6) {
        return { type: "buy", outcomeId: trend.outcome };
      } else if (Math.random() < 0.4) {
        return { type: "buy", outcomeId: pickRandom(OUTCOME_ORDER)! };
      }
      break;
      
    case "contrarian":
      // Contrarian ide proti trendu
      if (trend && trend.strength > 0.5 && Math.random() < 0.5) {
        return { type: "buy", outcomeId: getOppositeOutcome(trend.outcome) };
      } else if (Math.random() < 0.35) {
        return { type: "buy", outcomeId: pickRandom(OUTCOME_ORDER)! };
      }
      break;
  }

  return { type: "none" };
}

function updateSimPosition(
  positions: SimPosition[],
  playerId: string,
  marketId: string,
  outcomeId: OutcomeId,
  amount: number
) {
  const existing = positions.find(
    p => p.playerId === playerId && p.marketId === marketId && p.outcomeId === outcomeId
  );
  
  if (existing) {
    existing.shares += amount / 10; // Aproximácia shares
  } else {
    positions.push({
      playerId,
      marketId,
      outcomeId,
      shares: amount / 10,
      avgPrice: 0.5,
    });
  }
}

function getOppositeOutcome(outcome: OutcomeId): OutcomeId {
  if (outcome === "home") return "away";
  if (outcome === "away") return "home";
  return Math.random() > 0.5 ? "home" : "away";
}
