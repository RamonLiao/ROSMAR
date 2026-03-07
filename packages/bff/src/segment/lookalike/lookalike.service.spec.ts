import { Test } from '@nestjs/testing';
import { LookalikeService } from './lookalike.service';
import { FeatureExtractionService, ProfileFeatureVector } from './feature-extraction.service';
import { InternalCandidateSource } from './sources/internal.source';
import { KnnCosineStrategy, cosineSimilarity } from './strategies/knn-cosine.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('Lookalike — T19', () => {
  // ── Unit: cosineSimilarity ──────────────────────────
  describe('cosineSimilarity', () => {
    it('identical vectors → 1.0', () => {
      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    });

    it('orthogonal vectors → 0.0', () => {
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    });

    it('zero vector → 0', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });
  });

  // ── Unit: FeatureExtractionService ──────────────────
  describe('FeatureExtractionService.extractFeatures', () => {
    let service: FeatureExtractionService;
    let prisma: { profile: { findMany: jest.Mock } };

    beforeEach(async () => {
      prisma = {
        profile: {
          findMany: jest.fn(),
        },
      };

      const module = await Test.createTestingModule({
        providers: [
          FeatureExtractionService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      service = module.get(FeatureExtractionService);
    });

    it('returns 6-dim vector, normalized [0,1]', async () => {
      prisma.profile.findMany.mockResolvedValue([
        {
          id: 'p1',
          engagementScore: 100,
          _count: { wallets: 5, deals: 10, workflowExecutions: 3, socialLinks: 2 },
        },
        {
          id: 'p2',
          engagementScore: 0,
          _count: { wallets: 0, deals: 0, workflowExecutions: 0, socialLinks: 0 },
        },
      ]);

      const result = await service.extractFeatures(['p1', 'p2']);
      expect(result).toHaveLength(2);

      // p1 should be all 1s (max in each dimension), p2 all 0s (min)
      const p1 = result.find((r) => r.profileId === 'p1')!;
      const p2 = result.find((r) => r.profileId === 'p2')!;

      expect(p1.vector).toHaveLength(6);
      // First 5 dims: p1 is max → 1, p2 is min → 0
      for (let i = 0; i < 5; i++) {
        expect(p1.vector[i]).toBeCloseTo(1);
        expect(p2.vector[i]).toBeCloseTo(0);
      }
      // Dim 6 (totalBalance) is 0 for both → range 0 → normalized to 0
      expect(p1.vector[5]).toBe(0);
      expect(p2.vector[5]).toBe(0);
    });
  });

  // ── Integration: LookalikeService.findSimilar ──────
  describe('LookalikeService.findLookalike', () => {
    let service: LookalikeService;
    let prisma: {
      segmentMembership: { findMany: jest.Mock };
      profile: { findMany: jest.Mock };
      lookalikeResult: { create: jest.Mock };
    };

    beforeEach(async () => {
      prisma = {
        segmentMembership: { findMany: jest.fn() },
        profile: { findMany: jest.fn() },
        lookalikeResult: { create: jest.fn() },
      };

      const module = await Test.createTestingModule({
        providers: [
          LookalikeService,
          FeatureExtractionService,
          InternalCandidateSource,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      service = module.get(LookalikeService);
    });

    // Helper: mock profiles with known feature vectors
    function mockProfiles(profiles: Array<{ id: string; score: number; wallets: number; deals: number; wf: number; social: number }>) {
      prisma.profile.findMany.mockImplementation(({ where }: any) => {
        const ids: string[] = where.id?.in ?? [];
        return Promise.resolve(
          profiles
            .filter((p) => ids.length === 0 || ids.includes(p.id))
            .map((p) => ({
              id: p.id,
              engagementScore: p.score,
              _count: {
                wallets: p.wallets,
                deals: p.deals,
                workflowExecutions: p.wf,
                socialLinks: p.social,
              },
            })),
        );
      });
    }

    it('5 profiles, seed of 2, top 2 → returns 2 most similar non-seed', async () => {
      // Seeds: p1, p2 (high engagement)
      // Candidates: p3 (similar), p4 (medium), p5 (very different)
      const allProfiles = [
        { id: 'p1', score: 90, wallets: 4, deals: 8, wf: 3, social: 2 },
        { id: 'p2', score: 80, wallets: 3, deals: 7, wf: 2, social: 3 },
        { id: 'p3', score: 85, wallets: 4, deals: 7, wf: 3, social: 2 },
        { id: 'p4', score: 50, wallets: 2, deals: 3, wf: 1, social: 1 },
        { id: 'p5', score: 5,  wallets: 0, deals: 0, wf: 0, social: 0 },
      ];

      prisma.segmentMembership.findMany.mockResolvedValue([
        { profileId: 'p1' },
        { profileId: 'p2' },
      ]);

      mockProfiles(allProfiles);

      // Internal source: return candidates excluding seeds
      prisma.profile.findMany.mockImplementation(({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        const notIn: string[] = where?.id?.notIn ?? [];

        const filtered = allProfiles
          .filter((p) => (ids.length === 0 ? true : ids.includes(p.id)))
          .filter((p) => !notIn.includes(p.id));

        return Promise.resolve(
          filtered.map((p) => ({
            id: p.id,
            engagementScore: p.score,
            _count: {
              wallets: p.wallets,
              deals: p.deals,
              workflowExecutions: p.wf,
              socialLinks: p.social,
            },
          })),
        );
      });

      prisma.lookalikeResult.create.mockResolvedValue({});

      const result = await service.findLookalike('ws-1', 'seg-1', { topK: 2 });

      expect(result.profiles).toHaveLength(2);
      // p3 should be most similar to seeds
      expect(result.profiles[0].profileId).toBe('p3');
      // p5 should not be in top 2
      expect(result.profiles.map((p) => p.profileId)).not.toContain('p5');
    });

    it('findSimilar with minSimilarity filters out low-similarity profiles', async () => {
      const allProfiles = [
        { id: 'p1', score: 90, wallets: 4, deals: 8, wf: 3, social: 2 },
        { id: 'p2', score: 85, wallets: 4, deals: 7, wf: 3, social: 2 },
        { id: 'p3', score: 5,  wallets: 0, deals: 0, wf: 0, social: 0 },
      ];

      prisma.segmentMembership.findMany.mockResolvedValue([
        { profileId: 'p1' },
      ]);

      prisma.profile.findMany.mockImplementation(({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        const notIn: string[] = where?.id?.notIn ?? [];

        const filtered = allProfiles
          .filter((p) => (ids.length === 0 ? true : ids.includes(p.id)))
          .filter((p) => !notIn.includes(p.id));

        return Promise.resolve(
          filtered.map((p) => ({
            id: p.id,
            engagementScore: p.score,
            _count: {
              wallets: p.wallets,
              deals: p.deals,
              workflowExecutions: p.wf,
              socialLinks: p.social,
            },
          })),
        );
      });

      prisma.lookalikeResult.create.mockResolvedValue({});

      const result = await service.findLookalike('ws-1', 'seg-1', {
        topK: 10,
        minSimilarity: 0.8,
      });

      // p3 with all zeros should be filtered out (similarity near 0)
      for (const p of result.profiles) {
        expect(p.similarity).toBeGreaterThanOrEqual(0.8);
      }
      expect(result.profiles.map((p) => p.profileId)).not.toContain('p3');
    });
  });

  // ── Unit: InternalCandidateSource ──────────────────
  describe('InternalCandidateSource.getCandidates', () => {
    it('returns all workspace profiles excluding seed IDs', async () => {
      const prisma = {
        profile: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'p3' },
            { id: 'p4' },
            { id: 'p5' },
          ]),
        },
      };

      const module = await Test.createTestingModule({
        providers: [
          InternalCandidateSource,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      const source = module.get(InternalCandidateSource);
      const result = await source.getCandidates('ws-1', ['p1', 'p2']);

      expect(result).toEqual(['p3', 'p4', 'p5']);
      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          id: { notIn: ['p1', 'p2'] },
          isArchived: false,
        },
        select: { id: true },
      });
    });
  });
});
