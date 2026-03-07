import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureExtractionService } from './feature-extraction.service';
import { KnnCosineStrategy, ScoredProfile } from './strategies/knn-cosine.strategy';
import { InternalCandidateSource } from './sources/internal.source';

export interface LookalikeOptions {
  topK: number;
  minSimilarity?: number;
  algorithm?: string;
}

export interface LookalikeResultDto {
  id: string;
  seedSegmentId: string;
  profiles: ScoredProfile[];
  centroid: number[];
  algorithm: string;
}

@Injectable()
export class LookalikeService {
  private readonly knnStrategy = new KnnCosineStrategy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureExtraction: FeatureExtractionService,
    private readonly candidateSource: InternalCandidateSource,
  ) {}

  async findLookalike(
    workspaceId: string,
    segmentId: string,
    opts: LookalikeOptions,
  ): Promise<LookalikeResultDto> {
    // 1. Get seed profile IDs from segment
    const memberships = await this.prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { profileId: true },
    });
    const seedIds = memberships.map((m) => m.profileId);

    // 2. Extract features for seeds
    const seedVectors = await this.featureExtraction.extractFeatures(seedIds);

    // 3. Get candidate profiles (all workspace minus seeds)
    const candidateIds = await this.candidateSource.getCandidates(
      workspaceId,
      seedIds,
    );

    // 4. Extract features for candidates
    const candidateVectors =
      await this.featureExtraction.extractFeatures(candidateIds);

    // 5. Run strategy
    const centroid = this.knnStrategy.computeCentroid(seedVectors);
    const results = this.knnStrategy.findSimilar(
      seedVectors,
      candidateVectors,
      opts.topK,
      opts.minSimilarity,
    );

    // 6. Save LookalikeResult to DB
    const resultId = randomUUID();
    await this.prisma.lookalikeResult.create({
      data: {
        id: resultId,
        workspaceId,
        seedSegmentId: segmentId,
        topK: opts.topK,
        algorithm: opts.algorithm ?? 'knn-cosine',
        centroid: centroid as any,
        results: results as any,
      },
    });

    // 7. Return results
    return {
      id: resultId,
      seedSegmentId: segmentId,
      profiles: results,
      centroid,
      algorithm: opts.algorithm ?? 'knn-cosine',
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
