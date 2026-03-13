import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import {
  RuleEvaluatorService,
  SegmentRules,
} from './rule-evaluator.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RuleEvaluatorService', () => {
  let service: RuleEvaluatorService;
  let prisma: {
    profile: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      profile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
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

  // ─── nft_collection ────────────────────────────────

  it('nft_collection holds', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'nft_collection', operator: 'holds', value: 'CryptoPunks' },
      ],
      logic: 'AND',
    });
    expect(where.AND).toEqual([
      {
        walletBalances: {
          some: {
            assetType: 'nft',
            rawBalance: { gt: new Prisma.Decimal(0) },
            OR: [
              {
                collectionName: {
                  contains: 'CryptoPunks',
                  mode: 'insensitive',
                },
              },
              { contractAddress: 'CryptoPunks' },
            ],
          },
        },
      },
    ]);
  });

  it('nft_collection not_holds', async () => {
    const where = await callAndGetWhere({
      conditions: [
        { field: 'nft_collection', operator: 'not_holds', value: 'Azuki' },
      ],
      logic: 'AND',
    });
    expect(where.AND).toEqual([
      {
        walletBalances: {
          none: {
            assetType: 'nft',
            rawBalance: { gt: new Prisma.Decimal(0) },
            OR: [
              {
                collectionName: {
                  contains: 'Azuki',
                  mode: 'insensitive',
                },
              },
              { contractAddress: 'Azuki' },
            ],
          },
        },
      },
    ]);
  });

  // ─── token_balance ─────────────────────────────────

  it('token_balance gte via raw SQL', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const result = await service.evaluate(WS, {
      conditions: [
        {
          field: 'token_balance',
          operator: 'gte',
          value: '{"token":"SUI","amount":"100"}',
        },
      ],
      logic: 'AND',
    });
    expect(result).toEqual(['p1', 'p2']);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('token_balance throws on invalid format', async () => {
    await expect(
      service.evaluate(WS, {
        conditions: [
          { field: 'token_balance', operator: 'gte', value: 'invalid' },
        ],
        logic: 'AND',
      }),
    ).rejects.toThrow(
      'token_balance value must be JSON: {"token":"SUI","amount":"100"}',
    );
  });

  // ─── discord_role ──────────────────────────────────

  it('discord_role has_role returns profile IDs via raw query', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const result = await service.evaluate(WS, {
      conditions: [
        { field: 'discord_role', operator: 'has_role', value: '123456' },
      ],
      logic: 'AND',
    });
    expect(result).toEqual(['p1', 'p2']);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('discord_role not_has_role', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'p3' }]);
    const result = await service.evaluate(WS, {
      conditions: [
        { field: 'discord_role', operator: 'not_has_role', value: '999' },
      ],
      logic: 'AND',
    });
    expect(result).toEqual(['p3']);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  // ─── Mixed conditions (Prisma + raw SQL) ───────────

  it('AND: prisma + discord_role intersects results', async () => {
    prisma.profile.findMany.mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
      { id: 'p3' },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ id: 'p2' }, { id: 'p3' }]);
    const result = await service.evaluate(WS, {
      conditions: [
        { field: 'tier', operator: 'gte', value: 2 },
        { field: 'discord_role', operator: 'has_role', value: '123' },
      ],
      logic: 'AND',
    });
    expect(result).toEqual(['p2', 'p3']);
  });

  it('OR: prisma + discord_role unions results', async () => {
    prisma.profile.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.$queryRaw.mockResolvedValue([{ id: 'p2' }]);
    const result = await service.evaluate(WS, {
      conditions: [
        { field: 'tier', operator: 'gte', value: 5 },
        { field: 'discord_role', operator: 'has_role', value: '123' },
      ],
      logic: 'OR',
    });
    expect(result.sort()).toEqual(['p1', 'p2']);
  });
});
