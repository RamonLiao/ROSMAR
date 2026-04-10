import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureExtractionService } from './feature-extraction.service';
import {
  KnnCosineStrategy,
  ScoredProfile,
} from './strategies/knn-cosine.strategy';
import { GraphBasedStrategy } from './strategies/graph-based.strategy';
import { InternalCandidateSource } from './sources/internal.source';
import { OnChainCandidateSource } from './sources/on-chain.source';

export type Algorithm = 'knn-cosine' | 'graph-based';
export type CandidateMode = 'internal' | 'on-chain-discovery';

export interface LookalikeOptions {
  topK: number;
  minSimilarity?: number;
  algorithm?: Algorithm;
  candidateSource?: CandidateMode;
  /** Hybrid weight: 0 = pure graph, 1 = pure cosine. Default 0.5 */
  alpha?: number;
}

export interface LookalikeResultDto {
  id: string;
  seedSegmentId: string;
  profiles: ScoredProfile[];
  centroid: number[];
  algorithm: string;
  candidateSource: string;
}

@Injectable()
export class LookalikeService {
  private readonly knnStrategy = new KnnCosineStrategy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureExtraction: FeatureExtractionService,
    private readonly internalSource: InternalCandidateSource,
    private readonly onChainSource: OnChainCandidateSource,
    private readonly graphStrategy: GraphBasedStrategy,
  ) {}

  async findLookalike(
    workspaceId: string,
    segmentId: string,
    opts: LookalikeOptions,
  ): Promise<LookalikeResultDto> {
    const algorithm = opts.algorithm ?? 'knn-cosine';
    const candidateMode = opts.candidateSource ?? 'internal';

    // 1. Get seed profile IDs from segment
    const memberships = await this.prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { profileId: true },
    });
    const seedIds = memberships.map((m) => m.profileId);

    // 2. Extract features for seeds
    const seedVectors = await this.featureExtraction.extractFeatures(seedIds);

    // 3. Get candidate profiles
    const source =
      candidateMode === 'on-chain-discovery'
        ? this.onChainSource
        : this.internalSource;
    const candidateIds = await source.getCandidates(workspaceId, seedIds);

    // 4. Extract features for candidates
    // For discovered wallets (on-chain), create zero vectors as placeholders
    const realProfileIds = candidateIds.filter(
      (id) => !id.startsWith('discovered:'),
    );
    const discoveredAddrs = candidateIds.filter((id) =>
      id.startsWith('discovered:'),
    );

    const candidateVectors =
      await this.featureExtraction.extractFeatures(realProfileIds);

    // Add zero-vector placeholders for discovered addresses
    const dims = seedVectors[0]?.vector.length ?? 6;
    for (const addr of discoveredAddrs) {
      candidateVectors.push({
        profileId: addr,
        vector: new Array(dims).fill(0),
      });
    }

    // 5. Run strategy
    let results: ScoredProfile[];
    let centroid: number[];

    if (algorithm === 'graph-based') {
      // Build neighbor maps for graph-based scoring
      const allProfileIds = [...seedIds, ...realProfileIds];
      const neighborMap =
        await this.graphStrategy.buildNeighborMap(allProfileIds);

      // Split into seed and candidate neighbor maps
      const seedNeighbors: Record<string, Set<string>> = {};
      const candidateNeighbors: Record<string, Set<string>> = {};
      for (const id of seedIds)
        seedNeighbors[id] = neighborMap[id] ?? new Set();
      for (const id of realProfileIds)
        candidateNeighbors[id] = neighborMap[id] ?? new Set();
      // Discovered addresses have no neighbor data yet
      for (const addr of discoveredAddrs) candidateNeighbors[addr] = new Set();

      centroid = this.knnStrategy.computeCentroid(seedVectors);
      results = this.graphStrategy.findSimilarWithGraph(
        seedVectors,
        candidateVectors,
        seedNeighbors,
        candidateNeighbors,
        opts.topK,
        opts.minSimilarity,
        opts.alpha ?? 0.5,
      );
    } else {
      centroid = this.knnStrategy.computeCentroid(seedVectors);
      results = this.knnStrategy.findSimilar(
        seedVectors,
        candidateVectors,
        opts.topK,
        opts.minSimilarity,
      );
    }

    // 6. Save LookalikeResult to DB
    const resultId = randomUUID();
    await this.prisma.lookalikeResult.create({
      data: {
        id: resultId,
        workspaceId,
        seedSegmentId: segmentId,
        topK: opts.topK,
        algorithm,
        centroid: centroid as any,
        results: results as any,
      },
    });

    return {
      id: resultId,
      seedSegmentId: segmentId,
      profiles: results,
      centroid,
      algorithm,
      candidateSource: candidateMode,
    };
  }

  async createSegmentFromResults(
    workspaceId: string,
    seedSegmentId: string,
    resultProfileIds: string[],
  ): Promise<{ segmentId: string }> {
    const seedSegment = await this.prisma.segment.findUniqueOrThrow({
      where: { id: seedSegmentId },
    });

    const segmentId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.segment.create({
        data: {
          id: segmentId,
          workspaceId,
          name: `${seedSegment.name} — Lookalike`,
          description: `Lookalike audience derived from "${seedSegment.name}"`,
          rules: { type: 'lookalike', seedSegmentId },
        },
      }),
      this.prisma.segmentMembership.createMany({
        data: resultProfileIds.map((profileId) => ({
          segmentId,
          profileId,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Link result to segment
    await this.prisma.lookalikeResult.updateMany({
      where: { seedSegmentId, workspaceId, resultSegmentId: null },
      data: { resultSegmentId: segmentId },
    });

    return { segmentId };
  }
}
