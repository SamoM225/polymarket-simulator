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
  onAddBalance?: (amount: number) => void;
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
