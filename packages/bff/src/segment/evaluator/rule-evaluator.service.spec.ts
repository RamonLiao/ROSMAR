import { Test, TestingModule } from '@nestjs/testing';
import {
  RuleEvaluatorService,
  SegmentRules,
} from './rule-evaluator.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RuleEvaluatorService', () => {
  let service: RuleEvaluatorService;
  let prisma: { profile: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      profile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEvaluatorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RuleEvaluatorService);
  });

  const WS = 'ws-1';

  const callAndGetWhere = async (rules: SegmentRules) => {
    prisma.profile.findMany.mockResolvedValue([{ id: 'p1' }]);
    const result = await service.evaluate(WS, rules);
    expect(result).toEqual(['p1']);
    return prisma.profile.findMany.mock.calls[0][0].where;
  };

  it('tags contains', async () => {
    const where = await callAndGetWhere({
      conditions: [{ field: 'tags', operator: 'contains', value: 'vip' }],
      logic: 'AND',
    });
    expect(where).toMatchObject({
      workspaceId: WS,
      isArchived: false,
      AND: [{ tags: { has: 'vip' } }],
    });
  });

  it('tier equals', async () => {
    const where = await callAndGetWhere({
      conditions: [{ field: 'tier', operator: 'equals', value: 2 }],
      logic: 'AND',
    });
    expect(where.AND).toEqual([{ tier: 2 }]);
  });

  it('tier gte', async () => {
    const where = await callAndGetWhere({
      conditions: [{ field: 'tier', operator: 'gte', value: 3 }],
      logic: 'AND',
    });
    expect(where.AND).toEqual([{ tier: { gte: 3 } }]);
  });

  it('engagement_score gte', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'engagement_score', operator: 'gte', value: 50 },
      ],
      logic: 'AND',
    });
    expect(where.AND).toEqual([{ engagementScore: { gte: 50 } }]);
  });

  it('created_after gte', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'created_after', operator: 'gte', value: '2024-01-01' },
      ],
      logic: 'AND',
    });
    expect(where.AND).toEqual([
      { createdAt: { gte: new Date('2024-01-01') } },
    ]);
  });

  it('wallet_chain equals', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'wallet_chain', operator: 'equals', value: 'sui' },
      ],
      logic: 'AND',
    });
    expect(where.AND).toEqual([
      { wallets: { some: { chain: 'sui' } } },
    ]);
  });

  it('OR logic', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'tier', operator: 'gte', value: 3 },
        { field: 'tags', operator: 'contains', value: 'whale' },
      ],
      logic: 'OR',
    });
    expect(where.OR).toEqual([
      { tier: { gte: 3 } },
      { tags: { has: 'whale' } },
    ]);
    expect(where.AND).toBeUndefined();
  });

  it('AND logic with multiple conditions', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'tier', operator: 'gte', value: 2 },
        { field: 'engagement_score', operator: 'gte', value: 50 },
      ],
      logic: 'AND',
    });
    expect(where.AND).toEqual([
      { tier: { gte: 2 } },
      { engagementScore: { gte: 50 } },
    ]);
    expect(where.OR).toBeUndefined();
  });

  it('throws on unsupported field', async () => {
    await expect(
      service.evaluate(WS, {
        conditions: [{ field: 'unknown', operator: 'equals', value: 1 }],
        logic: 'AND',
      }),
    ).rejects.toThrow('Unsupported rule field: "unknown"');
  });

  it('throws on unsupported operator', async () => {
    await expect(
      service.evaluate(WS, {
        conditions: [{ field: 'tags', operator: 'gte', value: 'x' }],
        logic: 'AND',
      }),
    ).rejects.toThrow('Unsupported operator "gte" for field "tags"');
  });

  it('returns empty array when no profiles match', async () => {
    prisma.profile.findMany.mockResolvedValue([]);
    const result = await service.evaluate(WS, {
      conditions: [{ field: 'tier', operator: 'equals', value: 99 }],
      logic: 'AND',
    });
    expect(result).toEqual([]);
  });
});
