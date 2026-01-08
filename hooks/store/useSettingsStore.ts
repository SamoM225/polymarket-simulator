"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AppSettings,
  FeeSettings,
  SimulationSettings,
  loadSettings,
  updateFeeSettings,
  updateSimulationSettings,
  resetSettings,
} from "../../lib/settingsStore";

/**
 * Hook pre správu nastavení aplikácie.
 * Poskytuje reaktívny prístup k nastaveniam fee a simulácie.
 */
export function useSettingsStore() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Načítaj nastavenia pri mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setIsLoaded(true);
  }, []);

  const setFee = useCallback((fee: Partial<FeeSettings>) => {
    const updated = updateFeeSettings(fee);
    setSettings(updated);
  }, []);

  const setSimulation = useCallback((simulation: Partial<SimulationSettings>) => {
    const updated = updateSimulationSettings(simulation);
    setSettings(updated);
  }, []);

  const reset = useCallback(() => {
    const defaultSettings = resetSettings();
    setSettings(defaultSettings);
  }, []);

  return {
    settings,
    isLoaded,
    setFee,
    setSimulation,
    reset,
  };
}
