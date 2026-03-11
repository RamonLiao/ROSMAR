import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  YieldOptimizerService,
  type PoolApy,
} from './yield-optimizer.service';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const mockPools: PoolApy[] = [
  { protocol: 'Cetus', poolName: 'USDC-USDT', tokenPair: 'USDC/USDT', apy: 4.2, tvl: 18_500_000, riskLevel: 'low' },
  { protocol: 'Cetus', poolName: 'SUI-USDC', tokenPair: 'SUI/USDC', apy: 12.8, tvl: 32_000_000, riskLevel: 'medium' },
  { protocol: 'Cetus', poolName: 'SUI-CETUS', tokenPair: 'SUI/CETUS', apy: 35.2, tvl: 4_100_000, riskLevel: 'high' },
  { protocol: 'Scallop', poolName: 'USDC Lending', tokenPair: 'USDC', apy: 5.1, tvl: 62_000_000, riskLevel: 'low' },
  { protocol: 'NAVI', poolName: 'USDT Supply', tokenPair: 'USDT', apy: 6.3, tvl: 41_000_000, riskLevel: 'low' },
  { protocol: 'NAVI', poolName: 'SUI Supply', tokenPair: 'SUI', apy: 4.5, tvl: 35_000_000, riskLevel: 'medium' },
];

let fetchCallCount = 0;

function setupFetchMock() {
  fetchCallCount = 0;
  global.fetch = jest.fn().mockImplementation(async () => {
    fetchCallCount++;
    // Simulate API failure → service falls back to mock data
    return { ok: false, status: 503 };
  }) as any;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('YieldOptimizerService', () => {
  let service: YieldOptimizerService;

  beforeEach(async () => {
    setupFetchMock();

    const module = await Test.createTestingModule({
      providers: [
        YieldOptimizerService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(YieldOptimizerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* ---------- getPoolApys ---------- */

  it('should return pool APY data (falls back to mock on API failure)', async () => {
    const pools = await service.getPoolApys();

    expect(Array.isArray(pools)).toBe(true);
    expect(pools.length).toBeGreaterThan(0);

    for (const pool of pools) {
      expect(pool).toEqual(
        expect.objectContaining({
          protocol: expect.any(String),
          poolName: expect.any(String),
          tokenPair: expect.any(String),
          apy: expect.any(Number),
          tvl: expect.any(Number),
          riskLevel: expect.stringMatching(/^(low|medium|high)$/),
        }),
      );
    }
  });

  /* ---------- caching ---------- */

  it('should cache results — second call does not re-fetch', async () => {
    await service.getPoolApys();
    await service.getPoolApys();

    expect(fetchCallCount).toBe(1);
  });

  /* ---------- suggestStrategy ---------- */

  it('should filter pools by low risk tolerance', async () => {
    const suggestions = await service.suggestStrategy(1000, 'low');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);

    for (const s of suggestions) {
      expect(s.riskLevel).toBe('low');
      expect(s.suggestedAllocation).toBeGreaterThan(0);
      expect(s.expectedApy).toBeGreaterThan(0);
      expect(s.rationale).toBeTruthy();
    }
  });

  it('should filter pools by medium risk tolerance (includes low + medium)', async () => {
    const suggestions = await service.suggestStrategy(5000, 'medium');

    for (const s of suggestions) {
      expect(['low', 'medium']).toContain(s.riskLevel);
    }
  });

  it('should include all risk levels for high tolerance', async () => {
    const suggestions = await service.suggestStrategy(10000, 'high');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    // High tolerance can include any risk level
    const riskLevels = new Set(suggestions.map((s) => s.riskLevel));
    expect(riskLevels.size).toBeGreaterThan(0);
  });

  it('should sort suggestions by APY descending', async () => {
    const suggestions = await service.suggestStrategy(10000, 'high');

    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].expectedApy).toBeGreaterThanOrEqual(
        suggestions[i].expectedApy,
      );
    }
  });

  /* ---------- getToolDefinitions ---------- */

  it('should return correct tool definitions', () => {
    const tools = service.getToolDefinitions();

    expect(tools).toHaveLength(2);

    const getApys = tools.find((t) => t.name === 'get_pool_apys');
    expect(getApys).toBeDefined();
    expect(getApys!.description).toBeTruthy();
    expect(getApys!.parameters).toEqual(
      expect.objectContaining({ type: 'object' }),
    );

    const suggest = tools.find((t) => t.name === 'suggest_strategy');
    expect(suggest).toBeDefined();
    expect(suggest!.description).toBeTruthy();
    expect((suggest!.parameters as any).properties).toEqual(
      expect.objectContaining({
        balance_sui: expect.objectContaining({ type: 'number' }),
        risk_tolerance: expect.objectContaining({ type: 'string' }),
      }),
    );
    expect((suggest!.parameters as any).required).toEqual(
      expect.arrayContaining(['balance_sui', 'risk_tolerance']),
    );
  });
});
