"use client";

import { useMemo, useState, useEffect } from "react";

import {
  OUTCOME_LABELS,
  OUTCOME_ORDER,
  calculateProbabilities,
  lmsrB,
  formatCurrency,
  formatKickoff,
  formatPercentage,
  priceFromProbability,
} from "../../lib/marketUtils";
import { Market, OutcomeId } from "../../lib/types";
import { ProbabilityChart, ChartLegend } from "./ProbabilityChart";
import { OUTCOME_COLORS } from "./MarketList";
import { Spinner } from "./Spinner";

const QUICK_AMOUNTS = [10, 25, 50, 75];
const COOLDOWN_MS = 1000;

interface BettingPanelProps {
  market: Market | null;
  maxBet: number;
  isAuthenticated: boolean;
  isProcessing?: boolean;
  onPlaceBet: (marketId: string, outcomeId: OutcomeId, amount: number) => void;
  onLoginRequired: () => void;
}

export function BettingPanel({
  market,
  maxBet,
  isAuthenticated,
  isProcessing = false,
  onPlaceBet,
  onLoginRequired,
}: BettingPanelProps) {
  const [amount, setAmount] = useState(25);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeId>("home");
  const [chartMode, setChartMode] = useState<"probability" | "price">("probability");
  const [cooldown, setCooldown] = useState(false);

  const probabilities = useMemo(() => {
    if (!market) return null;
    const pools = market.outcomes.reduce((acc, o) => {
      acc[o.id] = o.pool;
      return acc;
    }, {} as Record<OutcomeId, number>);
    return calculateProbabilities(pools, lmsrB(market));
  }, [market]);

  const currentPrice =
    probabilities && selectedOutcome
      ? priceFromProbability(probabilities[selectedOutcome])
      : 0;

  const estimatedShares =
    currentPrice > 0 && amount > 0 ? amount / currentPrice : 0;

  const handlePlaceBet = () => {
    if (!market) return;
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }
    if (cooldown || isProcessing) return;
    
    onPlaceBet(market.id, selectedOutcome, Number(amount));
    
    // Start cooldown
    setCooldown(true);
    setTimeout(() => setCooldown(false), COOLDOWN_MS);
  };

  const isLocked = cooldown || isProcessing;

  if (!market) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-slate-500">
          <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p className="text-sm">Vyber si zápas v ľavom paneli</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Market Header */}
        <MarketHeader market={market} />

        {/* Chart Section */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-3">
          <ChartHeader chartMode={chartMode} onModeChange={setChartMode} />
          <ProbabilityChart history={market.history} mode={chartMode} />
          <ChartLegend probabilities={probabilities} />
        </div>

        {/* Betting Controls */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Stavkový panel
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">Max {formatCurrency(maxBet)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">Max 3 pozície</span>
            </div>
          </div>

          {/* Outcome Buttons */}
          <OutcomeSelector
            probabilities={probabilities}
            selectedOutcome={selectedOutcome}
            onSelect={setSelectedOutcome}
            disabled={isLocked}
          />

          {/* Amount Input and Bet Button */}
          <BetControls
            amount={amount}
            maxBet={maxBet}
            currentPrice={currentPrice}
            estimatedShares={estimatedShares}
            selectedOutcome={selectedOutcome}
            isAuthenticated={isAuthenticated}
            isLocked={isLocked}
            cooldown={cooldown}
            hasMarket={!!market}
            onAmountChange={setAmount}
            onPlaceBet={handlePlaceBet}
          />
        </div>
      </div>
    </section>
  );
}

function MarketHeader({ market }: { market: Market }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {market.sport} • {market.league}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            <span className="text-blue-600">{market.homeTeam}</span>
            <span className="mx-2 text-slate-400">vs</span>
            <span className="text-rose-600">{market.awayTeam}</span>
          </h2>
          <p className="text-sm text-slate-600">
            ⏱ {formatKickoff(market.startTime)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-2 text-right">
          <p className="text-xs font-medium text-slate-500">Likvidita</p>
          <p className="text-lg font-bold text-slate-900">
            {formatCurrency(market.liquidity)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChartHeader({
  chartMode,
  onModeChange,
}: {
  chartMode: "probability" | "price";
  onModeChange: (mode: "probability" | "price") => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-800">
        Live krivky: {chartMode === "probability" ? "pravdepodobnosti" : "ceny"}
      </span>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => onModeChange("probability")}
          className={`rounded-full border px-3 py-1 font-semibold ${
            chartMode === "probability"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Pravdepodobnost
        </button>
        <button
          onClick={() => onModeChange("price")}
          className={`rounded-full border px-3 py-1 font-semibold ${
            chartMode === "price"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Cena
        </button>
      </div>
    </div>
  );
}

function OutcomeSelector({
  probabilities,
  selectedOutcome,
  onSelect,
  disabled,
}: {
  probabilities: Record<OutcomeId, number> | null;
  selectedOutcome: OutcomeId;
  onSelect: (id: OutcomeId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {OUTCOME_ORDER.map((id) => {
        const price =
          probabilities && probabilities[id]
            ? priceFromProbability(probabilities[id])
            : 0;
        const isActive = selectedOutcome === id;
        const colors = OUTCOME_COLORS[id];
        
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            disabled={disabled}
            className={`rounded-xl border-2 px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 ${
              isActive
                ? `border-transparent bg-gradient-to-br ${colors.gradient} text-white shadow-lg`
                : `${colors.border} ${colors.bgLight} text-slate-800 hover:border-slate-300`
            }`}
          >
            <p className={`text-xs font-semibold uppercase ${
              isActive ? "text-white/80" : colors.text
            }`}>
              {OUTCOME_LABELS[id]}
            </p>
            <p className="text-2xl font-bold">
              {probabilities
                ? formatPercentage(probabilities[id])
                : "--"}
            </p>
            <p className={`text-xs ${isActive ? "text-white/70" : "text-slate-500"}`}>
              {price ? `${price.toFixed(3)} €/share` : "--"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function BetControls({
  amount,
  maxBet,
  currentPrice,
  estimatedShares,
  selectedOutcome,
  isAuthenticated,
  isLocked,
  cooldown,
  hasMarket,
  onAmountChange,
  onPlaceBet,
}: {
  amount: number;
  maxBet: number;
  currentPrice: number;
  estimatedShares: number;
  selectedOutcome: OutcomeId;
  isAuthenticated: boolean;
  isLocked: boolean;
  cooldown: boolean;
  hasMarket: boolean;
  onAmountChange: (amount: number) => void;
  onPlaceBet: () => void;
}) {
  const colors = OUTCOME_COLORS[selectedOutcome];
  
  return (
    <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
      <div>
        <label className="text-xs font-medium text-slate-600">Suma (EUR)</label>
        <input
          type="number"
          min={0}
          max={maxBet}
          value={amount}
          onChange={(e) => onAmountChange(Number(e.target.value) || 0)}
          disabled={isLocked}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-lg font-semibold text-slate-900 shadow-inner transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 disabled:bg-slate-100 disabled:opacity-60"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((val) => (
            <button
              key={val}
              onClick={() => onAmountChange(val)}
              disabled={isLocked}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
            >
              {val} €
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <span className="text-xs">Cena:</span>{" "}
          <span className="font-semibold">{currentPrice ? `${currentPrice.toFixed(3)} €` : "--"}</span>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <span className="text-xs">Shares:</span>{" "}
          <span className="font-semibold">~{estimatedShares.toFixed(2)}</span>
        </div>
        <button
          onClick={onPlaceBet}
          className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${colors.gradient} px-5 py-3 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-60 disabled:hover:shadow-lg`}
          disabled={!hasMarket || !isAuthenticated || isLocked}
        >
          {isLocked ? (
            <>
              <Spinner size="sm" />
              {cooldown ? "Počkaj..." : "Spracovávam..."}
            </>
          ) : isAuthenticated ? (
            "Otvoriť pozíciu"
          ) : (
            "Prihlás sa"
          )}
        </button>
      </div>
    </div>
  );
}
