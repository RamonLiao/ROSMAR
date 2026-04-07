import { Test } from '@nestjs/testing';
import { LookalikeService } from './lookalike.service';
import {
  FeatureExtractionService,
  ProfileFeatureVector,
} from './feature-extraction.service';
import { InternalCandidateSource } from './sources/internal.source';
import { OnChainCandidateSource } from './sources/on-chain.source';
import {
  GraphBasedStrategy,
  jaccardSimilarity,
} from './strategies/graph-based.strategy';
import { cosineSimilarity } from './strategies/knn-cosine.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('Lookalike', () => {
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

  // ── Unit: jaccardSimilarity ─────────────────────────
  describe('jaccardSimilarity', () => {
    it('identical sets → 1.0', () => {
      const a = new Set(['x', 'y', 'z']);
      const b = new Set(['x', 'y', 'z']);
      expect(jaccardSimilarity(a, b)).toBeCloseTo(1.0);
    });

    it('disjoint sets → 0.0', () => {
      const a = new Set(['x', 'y']);
      const b = new Set(['a', 'b']);
      expect(jaccardSimilarity(a, b)).toBeCloseTo(0.0);
    });

    it('partial overlap → correct ratio', () => {
      const a = new Set(['x', 'y', 'z']);
      const b = new Set(['y', 'z', 'w']);
      // intersection = {y, z} = 2, union = {x, y, z, w} = 4
      expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5);
    });

    it('both empty → 0', () => {
      expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
    });

    it('one empty → 0', () => {
      expect(jaccardSimilarity(new Set(['a']), new Set())).toBeCloseTo(0.0);
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
          _count: {
            wallets: 5,
            deals: 10,
            workflowExecutions: 3,
            socialLinks: 2,
          },
        },
        {
          id: 'p2',
          engagementScore: 0,
          _count: {
            wallets: 0,
            deals: 0,
            workflowExecutions: 0,
            socialLinks: 0,
          },
        },
      ]);

      const result = await service.extractFeatures(['p1', 'p2']);
      expect(result).toHaveLength(2);

      const p1 = result.find((r) => r.profileId === 'p1')!;
      const p2 = result.find((r) => r.profileId === 'p2')!;

      expect(p1.vector).toHaveLength(6);
      for (let i = 0; i < 5; i++) {
        expect(p1.vector[i]).toBeCloseTo(1);
        expect(p2.vector[i]).toBeCloseTo(0);
      }
      expect(p1.vector[5]).toBe(0);
      expect(p2.vector[5]).toBe(0);
    });
  });

  // ── Unit: GraphBasedStrategy.findSimilarWithGraph ───
  describe('GraphBasedStrategy.findSimilarWithGraph', () => {
    let strategy: GraphBasedStrategy;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          GraphBasedStrategy,
          { provide: PrismaService, useValue: {} },
        ],
      }).compile();
      strategy = module.get(GraphBasedStrategy);
    });

    it('pure graph (alpha=0) → ranks by Jaccard only', () => {
      const seeds: ProfileFeatureVector[] = [
        { profileId: 's1', vector: [1, 0, 0] },
      ];
      const candidates: ProfileFeatureVector[] = [
        { profileId: 'c1', vector: [0, 1, 0] }, // bad cosine but good jaccard
        { profileId: 'c2', vector: [1, 0, 0] }, // good cosine but no jaccard
      ];
      const seedNeighbors = { s1: new Set(['tx:a', 'tx:b', 'tx:c']) };
      const candidateNeighbors = {
        c1: new Set(['tx:a', 'tx:b', 'tx:c']), // perfect jaccard overlap
        c2: new Set(['tx:x', 'tx:y']), // no overlap
      };

      const results = strategy.findSimilarWithGraph(
        seeds,
        candidates,
        seedNeighbors,
        candidateNeighbors,
        2,
        undefined,
        0,
      );

      expect(results[0].profileId).toBe('c1');
      expect(results[0].similarity).toBeCloseTo(1.0);
      expect(results[1].profileId).toBe('c2');
      expect(results[1].similarity).toBeCloseTo(0.0);
    });

    it('hybrid (alpha=0.5) → combines cosine and Jaccard', () => {
      const seeds: ProfileFeatureVector[] = [
        { profileId: 's1', vector: [1, 0] },
      ];
      const candidates: ProfileFeatureVector[] = [
        { profileId: 'c1', vector: [1, 0] }, // cosine=1
      ];
      const seedNeighbors = { s1: new Set(['tx:a', 'tx:b']) };
      const candidateNeighbors = {
        c1: new Set(['tx:a']), // jaccard = 1/2 = 0.5
      };

      const results = strategy.findSimilarWithGraph(
        seeds,
        candidates,
        seedNeighbors,
        candidateNeighbors,
        1,
        undefined,
        0.5,
      );

      // 0.5 * 1.0 (cosine) + 0.5 * 0.5 (jaccard) = 0.75
      expect(results[0].similarity).toBeCloseTo(0.75);
    });

    it('no graph data → falls back to pure cosine', () => {
      const seeds: ProfileFeatureVector[] = [
        { profileId: 's1', vector: [1, 0, 0] },
      ];
      const candidates: ProfileFeatureVector[] = [
        { profileId: 'c1', vector: [1, 0, 0] },
      ];

      const results = strategy.findSimilarWithGraph(
        seeds,
        candidates,
        { s1: new Set() },
        { c1: new Set() },
        1,
      );

      expect(results[0].similarity).toBeCloseTo(1.0);
    });

    it('minSimilarity filters low scores', () => {
      const seeds: ProfileFeatureVector[] = [
        { profileId: 's1', vector: [1, 0] },
      ];
      const candidates: ProfileFeatureVector[] = [
        { profileId: 'c1', vector: [1, 0] },
        { profileId: 'c2', vector: [0, 1] },
      ];

      const results = strategy.findSimilarWithGraph(
        seeds,
        candidates,
        {},
        {},
        10,
        0.5,
        1.0,
      );

      expect(results).toHaveLength(1);
      expect(results[0].profileId).toBe('c1');
    });
  });

  // ── Unit: InternalCandidateSource ──────────────────
  describe('InternalCandidateSource.getCandidates', () => {
    it('returns all workspace profiles excluding seed IDs', async () => {
      const prisma = {
        profile: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'p3' }, { id: 'p4' }, { id: 'p5' }]),
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

  // ── Unit: OnChainCandidateSource ───────────────────
  describe('OnChainCandidateSource.getCandidates', () => {
    it('discovers addresses from tx co-occurrence, excludes known profiles', async () => {
      const prisma = {
        profile: {
          findMany: jest.fn(),
        },
        profileWallet: {
          findMany: jest.fn(),
        },
        walletEvent: {
          findMany: jest.fn(),
        },
      };

      // Seed profiles
      prisma.profile.findMany
        .mockResolvedValueOnce([{ primaryAddress: '0xseed1' }]) // seed addresses
        .mockResolvedValueOnce([]); // no existing profiles for discovered

      prisma.profileWallet.findMany
        .mockResolvedValueOnce([]) // no extra seed wallets
        .mockResolvedValueOnce([]); // no existing wallets for discovered

      // Seed tx digests
      prisma.walletEvent.findMany
        .mockResolvedValueOnce([{ txDigest: 'tx-abc' }, { txDigest: 'tx-def' }]) // seed txs
        .mockResolvedValueOnce([
          { address: '0xdiscovered1' },
          { address: '0xdiscovered2' },
        ]); // co-occurrence

      const module = await Test.createTestingModule({
        providers: [
          OnChainCandidateSource,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      const source = module.get(OnChainCandidateSource);
      const result = await source.getCandidates('ws-1', ['seed-profile-1']);

      expect(result).toContain('discovered:0xdiscovered1');
      expect(result).toContain('discovered:0xdiscovered2');
      expect(result).toHaveLength(2);
    });

    it('returns empty when no seed addresses', async () => {
      const prisma = {
        profile: { findMany: jest.fn().mockResolvedValue([]) },
        profileWallet: { findMany: jest.fn().mockResolvedValue([]) },
        walletEvent: { findMany: jest.fn() },
      };

      const module = await Test.createTestingModule({
        providers: [
          OnChainCandidateSource,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      const source = module.get(OnChainCandidateSource);
      const result = await source.getCandidates('ws-1', []);

      expect(result).toEqual([]);
    });
  });

  // ── Integration: LookalikeService ──────────────────
  describe('LookalikeService.findLookalike', () => {
    let service: LookalikeService;
    let prisma: {
      segmentMembership: { findMany: jest.Mock };
      profile: { findMany: jest.Mock };
      profileWallet: { findMany: jest.Mock };
      walletEvent: { findMany: jest.Mock };
      lookalikeResult: { create: jest.Mock };
    };

    beforeEach(async () => {
      prisma = {
        segmentMembership: { findMany: jest.fn() },
        profile: { findMany: jest.fn() },
        profileWallet: { findMany: jest.fn() },
        walletEvent: { findMany: jest.fn() },
        lookalikeResult: { create: jest.fn() },
      };

      const module = await Test.createTestingModule({
        providers: [
          LookalikeService,
          FeatureExtractionService,
          InternalCandidateSource,
          OnChainCandidateSource,
          GraphBasedStrategy,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      service = module.get(LookalikeService);
    });

    function mockProfiles(
      profiles: Array<{
        id: string;
        score: number;
        wallets: number;
        deals: number;
        wf: number;
        social: number;
      }>,
    ) {
      prisma.profile.findMany.mockImplementation(({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        const notIn: string[] = where?.id?.notIn ?? [];

        const filtered = profiles
          .filter((p) => (ids.length === 0 ? true : ids.includes(p.id)))
          .filter((p) => !notIn.includes(p.id));

        return Promise.resolve(
          filtered.map((p) => ({
            id: p.id,
            primaryAddress: `0x${p.id}`,
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

    it('knn-cosine: top 2 → returns 2 most similar non-seed', async () => {
      const allProfiles = [
        { id: 'p1', score: 90, wallets: 4, deals: 8, wf: 3, social: 2 },
        { id: 'p2', score: 80, wallets: 3, deals: 7, wf: 2, social: 3 },
        { id: 'p3', score: 85, wallets: 4, deals: 7, wf: 3, social: 2 },
        { id: 'p4', score: 50, wallets: 2, deals: 3, wf: 1, social: 1 },
        { id: 'p5', score: 5, wallets: 0, deals: 0, wf: 0, social: 0 },
      ];

      prisma.segmentMembership.findMany.mockResolvedValue([
        { profileId: 'p1' },
        { profileId: 'p2' },
      ]);
      mockProfiles(allProfiles);
      prisma.lookalikeResult.create.mockResolvedValue({});

      const result = await service.findLookalike('ws-1', 'seg-1', { topK: 2 });

      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].profileId).toBe('p3');
      expect(result.profiles.map((p) => p.profileId)).not.toContain('p5');
      expect(result.algorithm).toBe('knn-cosine');
    });

    it('knn-cosine: minSimilarity filters out low scores', async () => {
      const allProfiles = [
        { id: 'p1', score: 90, wallets: 4, deals: 8, wf: 3, social: 2 },
        { id: 'p2', score: 85, wallets: 4, deals: 7, wf: 3, social: 2 },
        { id: 'p3', score: 5, wallets: 0, deals: 0, wf: 0, social: 0 },
      ];

      prisma.segmentMembership.findMany.mockResolvedValue([
        { profileId: 'p1' },
      ]);
      mockProfiles(allProfiles);
      prisma.lookalikeResult.create.mockResolvedValue({});

      const result = await service.findLookalike('ws-1', 'seg-1', {
        topK: 10,
        minSimilarity: 0.8,
      });

      for (const p of result.profiles) {
        expect(p.similarity).toBeGreaterThanOrEqual(0.8);
      }
      expect(result.profiles.map((p) => p.profileId)).not.toContain('p3');
    });

    it('graph-based: dispatches to GraphBasedStrategy', async () => {
      const allProfiles = [
        { id: 'p1', score: 90, wallets: 4, deals: 8, wf: 3, social: 2 },
        { id: 'p2', score: 50, wallets: 2, deals: 3, wf: 1, social: 1 },
      ];

      prisma.segmentMembership.findMany.mockResolvedValue([
        { profileId: 'p1' },
      ]);
      mockProfiles(allProfiles);
      prisma.profileWallet.findMany.mockResolvedValue([]);
      prisma.walletEvent.findMany.mockResolvedValue([]);
      prisma.lookalikeResult.create.mockResolvedValue({});

      const result = await service.findLookalike('ws-1', 'seg-1', {
        topK: 5,
        algorithm: 'graph-based',
      });

      expect(result.algorithm).toBe('graph-based');
      expect(result.profiles).toBeDefined();
    });

    it('returns candidateSource in result', async () => {
      prisma.segmentMembership.findMany.mockResolvedValue([
        { profileId: 'p1' },
      ]);
      prisma.profile.findMany.mockResolvedValue([
        {
          id: 'p1',
          primaryAddress: '0xp1',
          engagementScore: 50,
          _count: {
            wallets: 1,
            deals: 1,
            workflowExecutions: 0,
            socialLinks: 0,
          },
        },
      ]);
      prisma.profileWallet.findMany.mockResolvedValue([]);
      prisma.walletEvent.findMany.mockResolvedValue([]);
      prisma.lookalikeResult.create.mockResolvedValue({});

      const result = await service.findLookalike('ws-1', 'seg-1', {
        topK: 5,
        candidateSource: 'on-chain-discovery',
      });

      expect(result.candidateSource).toBe('on-chain-discovery');
    });
  });
});
