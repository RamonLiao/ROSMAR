import { useState, useCallback } from "react";

export interface GasStationSettings {
  enabled: boolean;
  thresholdSui: number;
  dailyLimit: number;
}

const STORAGE_KEY = "gas-station-settings";

const DEFAULT_SETTINGS: GasStationSettings = {
  enabled: false,
  thresholdSui: 0.1,
  dailyLimit: 100,
};

function loadSettings(): GasStationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function useGasSettings() {
  const [settings, setSettingsState] =
    useState<GasStationSettings>(loadSettings);

  const updateSettings = useCallback(
    (partial: Partial<GasStationSettings>) => {
      setSettingsState((prev) => {
        const updated = { ...prev, ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    setSettingsState(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, reset };
}
