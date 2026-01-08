"use client";

import {
  OUTCOME_ORDER,
  OUTCOME_LABELS,
  calculateProbabilities,
  lmsrB,
  formatCurrency,
  formatKickoff,
  formatPercentage,
} from "../../lib/marketUtils";
import { Market, OutcomeId } from "../../lib/types";

// Farby pre jednotlivé výsledky
export const OUTCOME_COLORS = {
  home: {
    bg: "bg-blue-500",
    bgLight: "bg-blue-50",
    bgMedium: "bg-blue-100",
    text: "text-blue-600",
    textDark: "text-blue-700",
    border: "border-blue-200",
    ring: "ring-blue-500",
    gradient: "from-blue-500 to-blue-600",
  },
  draw: {
    bg: "bg-amber-500",
    bgLight: "bg-amber-50",
    bgMedium: "bg-amber-100",
    text: "text-amber-600",
    textDark: "text-amber-700",
    border: "border-amber-200",
    ring: "ring-amber-500",
    gradient: "from-amber-500 to-amber-600",
  },
  away: {
    bg: "bg-rose-500",
    bgLight: "bg-rose-50",
    bgMedium: "bg-rose-100",
    text: "text-rose-600",
    textDark: "text-rose-700",
    border: "border-rose-200",
    ring: "ring-rose-500",
    gradient: "from-rose-500 to-rose-600",
  },
} as const;

interface MarketListProps {
  markets: Market[];
  selectedMarketId: string | null;
  onSelectMarket: (marketId: string) => void;
}

export function MarketList({
  markets,
  selectedMarketId,
  onSelectMarket,
}: MarketListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Zápasy
        </h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          LIVE
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {markets.map((market) => (
          <MarketRow
            key={market.id}
            market={market}
            isSelected={market.id === selectedMarketId}
            onSelect={() => onSelectMarket(market.id)}
          />
        ))}
      </div>
    </section>
  );
}

function MarketRow({
  market,
  isSelected,
  onSelect,
}: {
  market: Market;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pools = market.outcomes.reduce((acc, o) => {
    acc[o.id] = o.pool;
    return acc;
  }, {} as Record<OutcomeId, number>);
  const probabilities = calculateProbabilities(pools, lmsrB(market));

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isSelected
          ? "border-slate-900 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={`text-xs uppercase tracking-wider ${
              isSelected ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {market.sport} • {market.league}
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {market.homeTeam} vs {market.awayTeam}
          </p>
          {market.startTime && (
            <p className={`mt-0.5 text-xs ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
              {formatKickoff(market.startTime)}
            </p>
          )}
        </div>
        <div className={`text-right text-xs ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
          <span className="font-medium">Likvidita</span>
          <div className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-800"}`}>
            {formatCurrency(market.liquidity)}
          </div>
        </div>
      </div>
      
      {/* Probability Pills */}
      <div className="mt-3 flex gap-2">
        {OUTCOME_ORDER.map((id) => {
          const colors = OUTCOME_COLORS[id];
          return (
            <div
              key={id}
              className={`flex-1 rounded-lg px-2 py-1.5 text-center ${
                isSelected 
                  ? "bg-white/10 backdrop-blur" 
                  : `${colors.bgLight} ${colors.border} border`
              }`}
            >
              <p className={`text-[10px] font-medium uppercase ${
                isSelected ? "text-slate-300" : colors.text
              }`}>
                {OUTCOME_LABELS[id]}
              </p>
              <p className={`text-sm font-bold ${
                isSelected ? "text-white" : colors.textDark
              }`}>
                {formatPercentage(probabilities[id])}
              </p>
            </div>
          );
        })}
      </div>
    </button>
  );
}
