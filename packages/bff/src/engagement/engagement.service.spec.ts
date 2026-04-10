import { Test } from '@nestjs/testing';
import { EngagementService } from './engagement.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WEIGHTS } from './engagement.constants';

describe('EngagementService', () => {
  let service: EngagementService;
  let prisma: {
    $queryRaw: jest.Mock;
    profile: { update: jest.Mock };
    engagementSnapshot: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      profile: { update: jest.fn() },
      engagementSnapshot: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EngagementService);
  });

  it('should return 0 for profile with no events', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        hold_days: 0,
        tx_count: 0n,
        tx_value: 0,
        vote_count: 0n,
        nft_count: 0n,
      },
    ]);

    const result = await service.calculateScore('profile-1', DEFAULT_WEIGHTS);
    expect(result.score).toBe(0);
  });

  it('should return 100 for maxed-out profile', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        hold_days: 400,
        tx_count: 200n,
        tx_value: 600000,
        vote_count: 100n,
        nft_count: 100n,
      },
    ]);

    const result = await service.calculateScore('profile-1', DEFAULT_WEIGHTS);
    expect(result.score).toBe(100);
  });

  it('should compute partial score correctly', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        hold_days: 182, // ~50% of 365
        tx_count: 50n, // 50% of 100
        tx_value: 250000, // 50% of 500k
        vote_count: 25n, // 50% of 50
        nft_count: 25n, // 50% of 50
      },
    ]);

    const result = await service.calculateScore('profile-1', DEFAULT_WEIGHTS);
    // ~50% across all factors = 50
    expect(result.score).toBeGreaterThanOrEqual(49);
    expect(result.score).toBeLessThanOrEqual(51);
  });
});
