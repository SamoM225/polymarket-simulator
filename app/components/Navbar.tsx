"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "../../lib/marketUtils";
import { AppSettings } from "../../lib/settingsStore";

interface NavbarProps {
  userId: string | null;
  balance: number;
  isAuthenticated: boolean;
  simulationStatus: "running" | "idle";
  onLoginClick: () => void;
  onLogout: () => void;
  onToggleSimulation: () => void;
  onAddBalance?: (amount: number) => void;
  settings?: AppSettings | null;
  onFeeChange?: (fee: { enabled?: boolean; rate?: number }) => void;
  onSimulationChange?: (simulation: Partial<AppSettings["simulation"]>) => void;
  onResetSettings?: () => void;
}

export function Navbar({
  userId,
  balance,
  isAuthenticated,
  simulationStatus,
  onLoginClick,
  onLogout,
  onToggleSimulation,
  onAddBalance,
  settings,
  onFeeChange,
  onSimulationChange,
  onResetSettings,
}: NavbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Zatvoriť dropdown pri kliknutí mimo
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="relative z-[200] border-b border-slate-200 bg-white/80 px-6 py-4 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-bold">
              Simulátor predikčného trhu
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {isAuthenticated && (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-[10px] font-bold text-white">
                {userId?.slice(0, 2).toUpperCase() ?? "?"}
              </div>
              <span className="text-xs font-medium text-slate-600">
                {userId?.slice(0, 8)}...
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 font-semibold text-white shadow-md">
            {formatCurrency(balance)}
          </div>
          {isAuthenticated && onAddBalance && (
            <button
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-amber-600 hover:to-orange-600"
              onClick={() => onAddBalance(100)}
            >
              + 100 €
            </button>
          )}
          {!isAuthenticated ? (
            <button
              className="rounded-full bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-slate-800 hover:to-slate-900"
              onClick={onLoginClick}
            >
              Prihlásiť sa
            </button>
          ) : (
            <button
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={onLogout}
            >
              Odhlásiť
            </button>
          )}
          <SimulationPill
            status={simulationStatus}
            onToggle={onToggleSimulation}
          />
          
          {/* Settings Dropdown */}
          {settings && onFeeChange && onSimulationChange && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  settingsOpen
                    ? "border-slate-400 bg-slate-100 text-slate-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Nastavenia
              </button>
              
              {settingsOpen && (
                  <SettingsDropdown
                    settings={settings}
                    onFeeChange={onFeeChange}
                    onSimulationChange={onSimulationChange}
                    onReset={onResetSettings}
                  />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SettingsDropdown({
  settings,
  onFeeChange,
  onSimulationChange,
  onReset,
}: {
  settings: AppSettings;
  onFeeChange: (fee: { enabled?: boolean; rate?: number }) => void;
  onSimulationChange: (simulation: Partial<AppSettings["simulation"]>) => void;
  onReset?: () => void;
}) {
  const feePercent = Math.round(settings.fee.rate * 100 * 10) / 10;

  return (
    <div className="absolute right-0 top-full mt-2 z-[100] w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      {/* Arrow */}
      <div className="absolute -top-2 right-4 h-4 w-4 rotate-45 border-l border-t border-slate-200 bg-white"></div>
      
      {/* Fee Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Transakčný poplatok</span>
          <button
            onClick={() => onFeeChange({ enabled: !settings.fee.enabled })}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              settings.fee.enabled ? "bg-slate-700" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                settings.fee.enabled ? "translate-x-4" : ""
              }`}
            />
          </button>
        </div>

        {settings.fee.enabled && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Výška fee</span>
              <span className="font-semibold text-slate-800">{feePercent}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={feePercent}
              onChange={(e) => onFeeChange({ rate: parseFloat(e.target.value) / 100 })}
              className="w-full h-1.5 rounded-full appearance-none bg-slate-200 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700"
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-slate-100"></div>

      {/* Event Simulation Settings */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Simulácia eventov</p>
        
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Interval</span>
            <span className="font-semibold text-slate-800">{settings.simulation.eventIntervalMs / 1000}s</span>
          </div>
          <input
            type="range"
            min="1000"
            max="10000"
            step="500"
            value={settings.simulation.eventIntervalMs}
            onChange={(e) => onSimulationChange({ eventIntervalMs: parseInt(e.target.value) })}
            className="w-full h-1.5 rounded-full appearance-none bg-slate-200 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Sila eventu</span>
            <span className="font-semibold text-slate-800">{settings.simulation.eventMinPercent}-{settings.simulation.eventMaxPercent}%</span>
          </div>
          <div className="flex gap-2">
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={settings.simulation.eventMinPercent}
              onChange={(e) => {
                const newMin = parseInt(e.target.value);
                // Nedovoľ min byť väčšie ako max
                if (newMin <= settings.simulation.eventMaxPercent) {
                  onSimulationChange({ eventMinPercent: newMin });
                }
              }}
              className="w-full h-1.5 rounded-full appearance-none bg-slate-200 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700"
            />
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={settings.simulation.eventMaxPercent}
              onChange={(e) => {
                const newMax = parseInt(e.target.value);
                // Nedovoľ max byť menšie ako min
                if (newMax >= settings.simulation.eventMinPercent) {
                  onSimulationChange({ eventMaxPercent: newMax });
                }
              }}
              className="w-full h-1.5 rounded-full appearance-none bg-slate-200 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Reset Button */}
      {onReset && (
        <>
          <div className="my-3 border-t border-slate-100"></div>
          <button
            onClick={onReset}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Obnoviť predvolené
          </button>
        </>
      )}
    </div>
  );
}

function SimulationPill({
  status,
  onToggle,
}: {
  status: "running" | "idle";
  onToggle: () => void;
}) {
  const isOn = status === "running";
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
        isOn
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {isOn ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
      ) : (
        <span className="h-2 w-2 rounded-full bg-slate-400" />
      )}
      {isOn ? "Simulácia beží" : "Simulácia"}
    </button>
  );
}
