/**
 * Modul pre správu nastavení uložených v JSON súbore.
 * Poskytuje funkcie pre čítanie a zápis nastavení fee a simulácie.
 */

export interface FeeSettings {
  enabled: boolean;
  rate: number;
}

export interface SimulationSettings {
  normalIntervalMs: number;
  eventIntervalMs: number;
  normalMinAmount: number;
  normalMaxAmount: number;
  eventMinPercent: number;
  eventMaxPercent: number;
}

export interface AppSettings {
  fee: FeeSettings;
  simulation: SimulationSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  fee: {
    enabled: true,
    rate: 0.02,
  },
  simulation: {
    normalIntervalMs: 900,
    eventIntervalMs: 3000,
    normalMinAmount: 5,
    normalMaxAmount: 45,
    eventMinPercent: 50,
    eventMaxPercent: 100,
  },
};

// Kľúč pre localStorage
const SETTINGS_KEY = "polymarket_settings";

/**
 * Načíta nastavenia z localStorage (client-side).
 */
export function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AppSettings;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error("Chyba pri načítaní nastavení:", e);
  }
  
  return DEFAULT_SETTINGS;
}

/**
 * Uloží nastavenia do localStorage.
 */
export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Chyba pri ukladaní nastavení:", e);
  }
}

/**
 * Aktualizuje fee nastavenia.
 */
export function updateFeeSettings(fee: Partial<FeeSettings>): AppSettings {
  const current = loadSettings();
  const updated = {
    ...current,
    fee: { ...current.fee, ...fee },
  };
  saveSettings(updated);
  return updated;
}

/**
 * Aktualizuje simulation nastavenia.
 */
export function updateSimulationSettings(simulation: Partial<SimulationSettings>): AppSettings {
  const current = loadSettings();
  const updated = {
    ...current,
    simulation: { ...current.simulation, ...simulation },
  };
  saveSettings(updated);
  return updated;
}

/**
 * Resetuje nastavenia na predvolené hodnoty.
 */
export function resetSettings(): AppSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
