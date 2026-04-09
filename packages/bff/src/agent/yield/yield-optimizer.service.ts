import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                        */
/* ------------------------------------------------------------------ */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PoolApy {
  protocol: string;
  poolName: string;
  tokenPair: string;
  apy: number; // percentage, e.g. 12.5
  tvl: number; // USD value
  riskLevel: RiskLevel;
}

export interface YieldSuggestion {
  protocol: string;
  poolName: string;
  suggestedAllocation: number; // percentage 0-100
  expectedApy: number;
  riskLevel: RiskLevel;
  rationale: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Risk classification helpers                                       */
/* ------------------------------------------------------------------ */

const STABLECOIN_TOKENS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'BUSD',
  'AUSD',
  'FUSD',
  'BUCK',
  'USDY',
]);

const MAJOR_TOKENS = new Set(['SUI', 'WETH', 'ETH', 'WBTC', 'BTC', 'SOL']);

function classifyRisk(tokenA: string, tokenB: string): RiskLevel {
  const a = tokenA.toUpperCase();
  const b = tokenB.toUpperCase();
  if (STABLECOIN_TOKENS.has(a) && STABLECOIN_TOKENS.has(b)) return 'low';
  if (
    (STABLECOIN_TOKENS.has(a) || MAJOR_TOKENS.has(a)) &&
    (STABLECOIN_TOKENS.has(b) || MAJOR_TOKENS.has(b))
  ) {
    return 'medium';
  }
  return 'high';
}

/* ------------------------------------------------------------------ */
/*  Mock data fallback                                                */
/* ------------------------------------------------------------------ */

const MOCK_POOLS: PoolApy[] = [
  {
    protocol: 'Cetus',
    poolName: 'USDC-USDT',
    tokenPair: 'USDC/USDT',
    apy: 4.2,
    tvl: 18_500_000,
    riskLevel: 'low',
  },
  {
    protocol: 'Cetus',
    poolName: 'SUI-USDC',
    tokenPair: 'SUI/USDC',
    apy: 12.8,
    tvl: 32_000_000,
    riskLevel: 'medium',
  },
  {
    protocol: 'Cetus',
    poolName: 'SUI-WETH',
    tokenPair: 'SUI/WETH',
    apy: 18.5,
    tvl: 8_200_000,
    riskLevel: 'medium',
  },
  {
    protocol: 'Cetus',
    poolName: 'SUI-CETUS',
    tokenPair: 'SUI/CETUS',
    apy: 35.2,
    tvl: 4_100_000,
    riskLevel: 'high',
  },
  {
    protocol: 'Cetus',
    poolName: 'CETUS-USDC',
    tokenPair: 'CETUS/USDC',
    apy: 22.1,
    tvl: 3_500_000,
    riskLevel: 'high',
  },
  {
    protocol: 'Aftermath',
    poolName: 'SUI-afSUI',
    tokenPair: 'SUI/afSUI',
    apy: 7.6,
    tvl: 45_000_000,
    riskLevel: 'low',
  },
  {
    protocol: 'Scallop',
    poolName: 'USDC Lending',
    tokenPair: 'USDC',
    apy: 5.1,
    tvl: 62_000_000,
    riskLevel: 'low',
  },
  {
    protocol: 'Scallop',
    poolName: 'SUI Lending',
    tokenPair: 'SUI',
    apy: 3.8,
    tvl: 28_000_000,
    riskLevel: 'medium',
  },
  {
    protocol: 'NAVI',
    poolName: 'USDT Supply',
    tokenPair: 'USDT',
    apy: 6.3,
    tvl: 41_000_000,
    riskLevel: 'low',
  },
  {
    protocol: 'NAVI',
    poolName: 'SUI Supply',
    tokenPair: 'SUI',
    apy: 4.5,
    tvl: 35_000_000,
    riskLevel: 'medium',
  },
];

/* ------------------------------------------------------------------ */
/*  Service                                                           */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class YieldOptimizerService {
  private readonly logger = new Logger(YieldOptimizerService.name);

  private cetusCache: { data: PoolApy[]; fetchedAt: number } | null = null;
  private aftermathCache: { data: PoolApy[]; fetchedAt: number } | null = null;
  private scallopCache: { data: PoolApy[]; fetchedAt: number } | null = null;
  private naviCache: { data: PoolApy[]; fetchedAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  /* ---------- Public API ---------- */

  async getPoolApys(): Promise<PoolApy[]> {
    const [cetus, aftermath, scallop, navi] = await Promise.all([
      this.getCachedOrFetch('Cetus'),
      this.getCachedOrFetch('Aftermath'),
      this.getCachedOrFetch('Scallop'),
      this.getCachedOrFetch('NAVI'),
    ]);
    return [...cetus, ...aftermath, ...scallop, ...navi];
  }

  private async getCachedOrFetch(protocol: string): Promise<PoolApy[]> {
    const cacheMap: Record<string, 'cetusCache' | 'aftermathCache' | 'scallopCache' | 'naviCache'> = {
      Cetus: 'cetusCache',
      Aftermath: 'aftermathCache',
      Scallop: 'scallopCache',
      NAVI: 'naviCache',
    };
    const key = cacheMap[protocol];
    const cached = this[key];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    const fetcherMap: Record<string, () => Promise<PoolApy[]>> = {
      Cetus: () => this.fetchCetusPools(),
      Aftermath: () => this.fetchAftermathPools(),
      Scallop: () => this.fetchScallopPools(),
      NAVI: () => this.fetchNaviPools(),
    };
    const pools = await fetcherMap[protocol]();
    this[key] = { data: pools, fetchedAt: Date.now() };
    return pools;
  }

  async suggestStrategy(
    balanceSui: number,
    riskTolerance: RiskLevel,
  ): Promise<YieldSuggestion[]> {
    const pools = await this.getPoolApys();

    const riskFilter: Record<RiskLevel, RiskLevel[]> = {
      low: ['low'],
      medium: ['low', 'medium'],
      high: ['low', 'medium', 'high'],
    };

    const eligible = pools
      .filter((p) => riskFilter[riskTolerance].includes(p.riskLevel))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 5);

    if (eligible.length === 0) return [];

    // Simple allocation: weight by APY proportionally
    const totalApy = eligible.reduce((s, p) => s + p.apy, 0);

    return eligible.map((pool) => {
      const allocation = Math.round((pool.apy / totalApy) * 100);
      return {
        protocol: pool.protocol,
        poolName: pool.poolName,
        suggestedAllocation: allocation,
        expectedApy: pool.apy,
        riskLevel: pool.riskLevel,
        rationale: this.buildRationale(pool, allocation, balanceSui),
      };
    });
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'get_pool_apys',
        description:
          'Fetch current DeFi pool APY data from SUI ecosystem protocols (Cetus, Aftermath, Scallop, NAVI). Returns pool name, token pair, APY percentage, TVL in USD, and risk level.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'suggest_strategy',
        description:
          "Suggest yield farming strategies based on the user's SUI balance and risk tolerance. Returns top 5 pool suggestions with allocation percentages. Does NOT auto-execute — user must manually sign any DeFi transaction.",
        parameters: {
          type: 'object',
          properties: {
            balance_sui: {
              type: 'number',
              description: 'Available SUI balance to allocate',
            },
            risk_tolerance: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description:
                'Risk tolerance: low = stablecoin/LST pools only, medium = includes major pairs, high = all pools',
            },
          },
          required: ['balance_sui', 'risk_tolerance'],
        },
      },
    ];
  }

  /* ---------- Private ---------- */

  private async fetchCetusPools(): Promise<PoolApy[]> {
    try {
      const res = await fetch('https://api.cetus.zone/v2/sui/pools_info', {
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Cetus API responded ${res.status}`);
      }

      const json = await res.json();
      const rawPools: any[] = json?.data?.lp_list ?? json?.data ?? [];

      if (!Array.isArray(rawPools) || rawPools.length === 0) {
        throw new Error('Empty or unexpected Cetus response shape');
      }

      const pools: PoolApy[] = rawPools
        .filter((p: any) => p.apr != null || p.apy != null)
        .slice(0, 30) // top 30 to keep response size manageable
        .map((p: any) => {
          const symbolA = p.coin_a?.symbol ?? p.token_a_symbol ?? 'UNKNOWN';
          const symbolB = p.coin_b?.symbol ?? p.token_b_symbol ?? 'UNKNOWN';
          const apy = Number(p.apy ?? p.apr ?? 0) * 100; // API returns decimal
          const tvl = Number(p.tvl_in_usd ?? p.tvl ?? 0);

          return {
            protocol: 'Cetus' as const,
            poolName: `${symbolA}-${symbolB}`,
            tokenPair: `${symbolA}/${symbolB}`,
            apy: Math.round(apy * 100) / 100,
            tvl: Math.round(tvl),
            riskLevel: classifyRisk(symbolA, symbolB),
          };
        })
        .filter((p) => p.apy > 0);

      if (pools.length === 0) {
        throw new Error('No pools with valid APY after parsing');
      }

      this.logger.log(`Fetched ${pools.length} Cetus pools`);
      return pools;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Cetus pools, using mock data: ${(err as Error).message}`,
      );
      return MOCK_POOLS.filter((p) => p.protocol === 'Cetus');
    }
  }

  private async fetchAftermathPools(): Promise<PoolApy[]> {
    try {
      const res = await fetch('https://aftermath.finance/api/pools', {
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Aftermath API responded ${res.status}`);
      }

      const json = await res.json();
      const rawPools: any[] = Array.isArray(json) ? json : json?.data ?? [];

      if (!Array.isArray(rawPools) || rawPools.length === 0) {
        throw new Error('Empty or unexpected Aftermath response shape');
      }

      const pools: PoolApy[] = rawPools
        .filter((p: any) => p.apy != null && Number(p.apy) > 0)
        .slice(0, 20)
        .map((p: any) => {
          const name: string = p.name ?? p.poolName ?? 'UNKNOWN';
          const tokens = name.split(/[-\/]/);
          const tokenA = tokens[0]?.trim() ?? 'UNKNOWN';
          const tokenB = tokens[1]?.trim() ?? tokenA;
          const apy = Number(p.apy ?? 0) * 100;
          const tvl = Number(p.tvl ?? 0);

          return {
            protocol: 'Aftermath' as const,
            poolName: name,
            tokenPair: `${tokenA}/${tokenB}`,
            apy: Math.round(apy * 100) / 100,
            tvl: Math.round(tvl),
            riskLevel: classifyRisk(tokenA, tokenB),
          };
        });

      if (pools.length === 0) {
        throw new Error('No Aftermath pools with valid APY after parsing');
      }

      this.logger.log(`Fetched ${pools.length} Aftermath pools`);
      return pools;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Aftermath pools, using mock data: ${(err as Error).message}`,
      );
      return MOCK_POOLS.filter((p) => p.protocol === 'Aftermath');
    }
  }

  private async fetchScallopPools(): Promise<PoolApy[]> {
    try {
      const res = await fetch('https://sdk.scallop.io/api/market', {
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Scallop API responded ${res.status}`);
      }

      const json = await res.json();
      const rawPools: any[] = Array.isArray(json) ? json : json?.data ?? [];

      if (!Array.isArray(rawPools) || rawPools.length === 0) {
        throw new Error('Empty or unexpected Scallop response shape');
      }

      const pools: PoolApy[] = rawPools
        .filter((p: any) => p.supplyApy != null && Number(p.supplyApy) > 0)
        .slice(0, 20)
        .map((p: any) => {
          const symbol: string = p.symbol ?? p.coin ?? 'UNKNOWN';
          const apy = Number(p.supplyApy ?? 0) * 100;
          const tvl = Number(p.tvl ?? 0);

          return {
            protocol: 'Scallop' as const,
            poolName: `${symbol} Lending`,
            tokenPair: symbol,
            apy: Math.round(apy * 100) / 100,
            tvl: Math.round(tvl),
            riskLevel: classifyRisk(symbol, symbol),
          };
        });

      if (pools.length === 0) {
        throw new Error('No Scallop pools with valid APY after parsing');
      }

      this.logger.log(`Fetched ${pools.length} Scallop pools`);
      return pools;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Scallop pools, using mock data: ${(err as Error).message}`,
      );
      return MOCK_POOLS.filter((p) => p.protocol === 'Scallop');
    }
  }

  private async fetchNaviPools(): Promise<PoolApy[]> {
    try {
      const res = await fetch('https://api.naviprotocol.io/api/v1/market', {
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`NAVI API responded ${res.status}`);
      }

      const json = await res.json();
      const rawPools: any[] = Array.isArray(json) ? json : json?.data ?? [];

      if (!Array.isArray(rawPools) || rawPools.length === 0) {
        throw new Error('Empty or unexpected NAVI response shape');
      }

      const pools: PoolApy[] = rawPools
        .filter((p: any) => p.supplyApy != null && Number(p.supplyApy) > 0)
        .slice(0, 20)
        .map((p: any) => {
          const symbol: string = p.symbol ?? p.coin ?? 'UNKNOWN';
          const apy = Number(p.supplyApy ?? 0) * 100;
          const tvl = Number(p.tvl ?? 0);

          return {
            protocol: 'NAVI' as const,
            poolName: `${symbol} Supply`,
            tokenPair: symbol,
            apy: Math.round(apy * 100) / 100,
            tvl: Math.round(tvl),
            riskLevel: classifyRisk(symbol, symbol),
          };
        });

      if (pools.length === 0) {
        throw new Error('No NAVI pools with valid APY after parsing');
      }

      this.logger.log(`Fetched ${pools.length} NAVI pools`);
      return pools;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch NAVI pools, using mock data: ${(err as Error).message}`,
      );
      return MOCK_POOLS.filter((p) => p.protocol === 'NAVI');
    }
  }

  private buildRationale(
    pool: PoolApy,
    allocationPct: number,
    balanceSui: number,
  ): string {
    const suiAmount =
      Math.round(balanceSui * (allocationPct / 100) * 100) / 100;
    const parts: string[] = [];

    parts.push(
      `Allocate ~${allocationPct}% (~${suiAmount} SUI) to ${pool.protocol} ${pool.poolName}.`,
    );
    parts.push(`Current APY: ${pool.apy}%.`);
    parts.push(`TVL: $${pool.tvl.toLocaleString('en-US')}.`);

    if (pool.riskLevel === 'low') {
      parts.push(
        'Low risk — stablecoin or liquid-staking pair with minimal impermanent loss.',
      );
    } else if (pool.riskLevel === 'medium') {
      parts.push(
        'Medium risk — involves major tokens; moderate impermanent loss possible.',
      );
    } else {
      parts.push(
        'High risk — volatile pair with significant impermanent loss potential. Higher reward to compensate.',
      );
    }

    return parts.join(' ');
  }
}
