import { useState, useCallback } from "react";

export interface EngagementWeights {
  holdTime: number;
  txCount: number;
  txValue: number;
  voteCount: number;
  nftCount: number;
}

const STORAGE_KEY = "engagement-weights";

const DEFAULT_WEIGHTS: EngagementWeights = {
  holdTime: 0.3,
  txCount: 0.2,
  txValue: 0.2,
  voteCount: 0.2,
  nftCount: 0.1,
};

function loadWeights(): EngagementWeights {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return DEFAULT_WEIGHTS;
}

export function useEngagementSettings() {
  const [weights, setWeightsState] = useState<EngagementWeights>(loadWeights);

  const setWeight = useCallback(
    (key: keyof EngagementWeights, value: number) => {
      setWeightsState((prev) => {
        const updated = { ...prev, [key]: value };
        // Normalize so sum = 1.0
        const sum = Object.values(updated).reduce((a, b) => a + b, 0);
        if (sum > 0) {
          const normalized = Object.fromEntries(
            Object.entries(updated).map(([k, v]) => [
              k,
              Math.round((v / sum) * 100) / 100,
            ]),
          ) as EngagementWeights;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }
        return updated;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WEIGHTS));
    setWeightsState(DEFAULT_WEIGHTS);
  }, []);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return { weights, setWeight, reset, total: Math.round(total * 10) / 10 };
}
