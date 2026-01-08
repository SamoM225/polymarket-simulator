"use client";

import { useState } from "react";
import { AppSettings } from "../../lib/settingsStore";

interface SettingsPanelProps {
  settings: AppSettings;
  onFeeChange: (fee: { enabled?: boolean; rate?: number }) => void;
  onSimulationChange: (simulation: Partial<AppSettings["simulation"]>) => void;
  onReset: () => void;
}

/**
 * Panel pre nastavenia fee a simulácie.
 * Umožňuje používateľovi meniť poplatky a parametre simulácie.
 */
export function SettingsPanel({
  settings,
  onFeeChange,
  onSimulationChange,
  onReset,
}: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const feePercent = Math.round(settings.fee.rate * 100 * 10) / 10;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Nastavenia</h3>
            <p className="text-xs text-slate-500">
              Fee: {settings.fee.enabled ? `${feePercent}%` : "vypnuté"} • Eventi každých {settings.simulation.eventIntervalMs / 1000}s
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {/* Fee Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Transakčný poplatok</label>
              <button
                onClick={() => onFeeChange({ enabled: !settings.fee.enabled })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  settings.fee.enabled ? "bg-violet-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                    settings.fee.enabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {settings.fee.enabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Výška fee</span>
                  <span className="font-semibold text-violet-600">{feePercent}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={feePercent}
                  onChange={(e) => onFeeChange({ rate: parseFloat(e.target.value) / 100 })}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0.1%</span>
                  <span>10%</span>
                </div>
              </div>
            )}
          </div>

          {/* Event Simulation Settings */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-sm font-medium text-slate-700">Simulácia eventov (góly, fauly...)</h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Interval eventov</span>
                <span className="font-semibold text-amber-600">{settings.simulation.eventIntervalMs / 1000}s</span>
              </div>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={settings.simulation.eventIntervalMs}
                onChange={(e) => onSimulationChange({ eventIntervalMs: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>1s</span>
                <span>10s</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Sila eventu</span>
                <span className="font-semibold text-amber-600">{settings.simulation.eventMinPercent}% - {settings.simulation.eventMaxPercent}%</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="5"
                  value={settings.simulation.eventMinPercent}
                  onChange={(e) => onSimulationChange({ eventMinPercent: parseInt(e.target.value) })}
                  className="w-full accent-amber-500"
                />
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={settings.simulation.eventMaxPercent}
                  onChange={(e) => onSimulationChange({ eventMaxPercent: parseInt(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="border-t border-slate-100 pt-4">
            <button
              onClick={onReset}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Obnoviť predvolené nastavenia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
