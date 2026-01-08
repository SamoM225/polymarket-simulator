"use client";

import { formatCurrency } from "../../lib/marketUtils";

interface NavbarProps {
  userId: string | null;
  balance: number;
  isAuthenticated: boolean;
  simulationStatus: "running" | "idle";
  onLoginClick: () => void;
  onLogout: () => void;
  onToggleSimulation: () => void;
}

export function Navbar({
  userId,
  balance,
  isAuthenticated,
  simulationStatus,
  onLoginClick,
  onLogout,
  onToggleSimulation,
}: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white/80 px-6 py-4 shadow-sm backdrop-blur-md">
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
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
            </svg>
            {formatCurrency(balance)}
          </div>
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
        </div>
      </div>
    </header>
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
