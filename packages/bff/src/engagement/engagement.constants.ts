export const DEFAULT_WEIGHTS = {
  holdTime: 0.3,
  txCount: 0.2,
  txValue: 0.2,
  voteCount: 0.2,
  nftCount: 0.1,
} as const;

export interface EngagementWeights {
  holdTime: number;
  txCount: number;
  txValue: number;
  voteCount: number;
  nftCount: number;
}

// Max raw values for normalization (tunable per workspace)
export const DEFAULT_CAPS = {
  holdTimeDays: 365,
  txCount: 100,
  txValueUsd: 500_000,
  voteCount: 50,
  nftCount: 50,
} as const;
