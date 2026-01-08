"use client";

import { useMemo, useState, useEffect } from "react";

import {
  OUTCOME_LABELS,
  calculateProbabilities,
  lmsrB,
  formatCurrency,
  priceFromProbability,
  lmsrSellPayout,
} from "../../lib/marketUtils";
import { loadSettings, FeeSettings } from "../../lib/settingsStore";
import { Market, Position, OutcomeId } from "../../lib/types";
import { OUTCOME_COLORS } from "./MarketList";
import { Spinner } from "./Spinner";

interface PortfolioProps {
  markets: Market[];
  positions: Position[];
  simulationStatus: "running" | "idle";
  simulationIntervalMs: number;
  onClosePosition: (positionId: string) => void;
  onToggleSimulation: () => void;
}

export function Portfolio({
  markets,
  positions,
  simulationStatus,
  simulationIntervalMs,
  onClosePosition,
  onToggleSimulation,
}: PortfolioProps) {
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [feeSettings, setFeeSettings] = useState<FeeSettings>({ enabled: true, rate: 0.02 });

  // Načítaj fee nastavenia a sleduj zmeny
  useEffect(() => {
    const updateFeeSettings = () => {
      setFeeSettings(loadSettings().fee);
    };
    
    updateFeeSettings();
    
    // Sleduj zmeny v localStorage
    const handleStorage = () => updateFeeSettings();
    window.addEventListener("storage", handleStorage);
    
    // Polling pre zmeny v tom istom okne (localStorage event sa nespustí)
    const pollInterval = setInterval(updateFeeSettings, 500);
    
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(pollInterval);
    };
  }, []);

  const handleClosePosition = (positionId: string) => {
    setClosingPositionId(positionId);
    onClosePosition(positionId);
    // Reset after a delay
    setTimeout(() => setClosingPositionId(null), 2000);
  };

  const positionsView = useMemo(() => {
    return positions
      .map((pos) => {
        const market = markets.find((m) => m.id === pos.marketId);
        if (!market) return null;
        const pools = market.outcomes.reduce((acc, o) => {
          acc[o.id] = o.pool;
          return acc;
        }, {} as Record<OutcomeId, number>);
        const b = lmsrB(market);
        const probs = calculateProbabilities(pools, b);
        const price = priceFromProbability(probs[pos.outcomeId]);
        const value = pos.shares * price;
        
        // Výpočet payout pri predaji
        const rawPayout = lmsrSellPayout(pools, b, pos.outcomeId, pos.shares);
        const feeRate = feeSettings.rate;
        const feeEnabled = feeSettings.enabled;
        const feeAmount = feeEnabled ? rawPayout * feeRate : 0;
        const netPayout = rawPayout - feeAmount;
        
        // PnL zahŕňa fee - človek je automaticky v mínuse o fee
        const pnl = netPayout - pos.amountSpent;
        
        return { pos, market, price, value, pnl, rawPayout, feeAmount, netPayout, feeRate, feeEnabled };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [markets, positions, feeSettings]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Tvoje pozície
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {positions.length}/3
        </span>
      </div>
      
      <div className="flex flex-col gap-3">
        {positionsView.length ? (
          positionsView.map((item) => (
            <PositionRow
              key={item.pos.id}
              data={item}
              isClosing={closingPositionId === item.pos.id}
              onClose={() => handleClosePosition(item.pos.id)}
            />
          ))
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">Zatiaľ žiadne pozície</p>
            <p className="mt-1 text-xs text-slate-500">Spusti simuláciu alebo si vsaď!</p>
          </div>
        )}
      </div>

      <SimulationControl
        status={simulationStatus}
        intervalMs={simulationIntervalMs}
        onToggle={onToggleSimulation}
      />
    </section>
  );
}

function PositionRow({
  data,
  isClosing,
  onClose,
}: {
  data: {
    pos: Position;
    market: Market;
    price: number;
    value: number;
    pnl: number;
    rawPayout: number;
    feeAmount: number;
    netPayout: number;
    feeRate: number;
    feeEnabled: boolean;
  };
  isClosing: boolean;
  onClose: () => void;
}) {
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const { pos, market, price, value, pnl, rawPayout, feeAmount, netPayout, feeRate, feeEnabled } = data;
  const isUp = pnl >= 0;
  const colors = OUTCOME_COLORS[pos.outcomeId];
  
  return (
    <div className={`flex flex-col gap-2 rounded-xl border-2 ${colors.border} bg-white px-4 py-3 shadow-sm transition-all ${isClosing ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {market.sport} • {market.league}
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {market.homeTeam} vs {market.awayTeam}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full ${colors.bgMedium} ${colors.text} px-2 py-0.5 text-xs font-semibold`}>
              {OUTCOME_LABELS[pos.outcomeId]}
            </span>
            <span className="text-xs text-slate-500">
              nakúpené za {formatCurrency(pos.amountSpent)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Akt. cena</p>
          <p className="text-sm font-bold text-slate-900">
            {price.toFixed(3)} €
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {pos.shares.toFixed(2)} shares
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            Hodnota {formatCurrency(value)}
          </span>
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              isUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {isUp ? "+" : ""}{formatCurrency(pnl)}
          </span>
        </div>
        
        {/* Payout info s tooltipom */}
        <div className="flex items-center gap-2">
          <div 
            className="relative"
            onMouseEnter={() => setShowFeeTooltip(true)}
            onMouseLeave={() => setShowFeeTooltip(false)}
          >
            <div className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-3 py-1.5 cursor-help">
              <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold text-emerald-700">
                {formatCurrency(netPayout)}
              </span>
              {feeEnabled && (
                <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            
            {/* Fee Tooltip */}
            {showFeeTooltip && (
              <div className="absolute bottom-full right-0 mb-2 z-40 w-56 rounded-xl bg-slate-900 p-3 shadow-xl">
                <div className="absolute bottom-0 right-4 -mb-1.5 h-3 w-3 rotate-45 bg-slate-900"></div>
                <p className="text-xs font-semibold text-white mb-2">Detaily výplaty</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hrubá výplata:</span>
                    <span className="text-white font-medium">{formatCurrency(rawPayout)}</span>
                  </div>
                  {feeEnabled ? (
                    <>
                      <div className="flex justify-between text-amber-400">
                        <span>Fee ({(feeRate * 100).toFixed(1)}%):</span>
                        <span className="font-medium">-{formatCurrency(feeAmount)}</span>
                      </div>
                      <div className="border-t border-slate-700 pt-1.5 flex justify-between">
                        <span className="text-emerald-400 font-semibold">Dostaneš:</span>
                        <span className="text-emerald-400 font-bold">{formatCurrency(netPayout)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-emerald-400">
                      <span className="font-semibold">Dostaneš:</span>
                      <span className="font-bold">{formatCurrency(netPayout)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            disabled={isClosing || !pos.synced}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isClosing ? (
              <>
                <Spinner size="xs" />
                Zatvárám...
              </>
            ) : !pos.synced ? (
              <>
                <Spinner size="xs" />
                Čakám...
              </>
            ) : (
              "Ukončiť pozíciu"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SimulationControl({
  status,
  intervalMs,
  onToggle,
}: {
  status: "running" | "idle";
  intervalMs: number;
  onToggle: () => void;
}) {
  const isRunning = status === "running";
  
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">Simulácia trhu</p>
          <p className="text-xs text-slate-500">
            Automatické generovanie stávok na testovanie
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md transition ${
            isRunning
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
              : "bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-slate-800 hover:to-slate-900"
          }`}
        >
          {isRunning ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
              </span>
              Zastaviť
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Spustiť
            </>
          )}
        </button>
      </div>
    </div>
  );
}
