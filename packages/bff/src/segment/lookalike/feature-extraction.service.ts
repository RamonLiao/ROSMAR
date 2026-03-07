import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProfileFeatureVector {
  profileId: string;
  vector: number[];
}

@Injectable()
export class FeatureExtractionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract a 6-dimension feature vector per profile:
   * [engagementScore, walletCount, dealCount, campaignParticipation, socialLinkCount, totalBalance]
   * Normalized to [0,1] using min-max across the batch.
   */
  async extractFeatures(profileIds: string[]): Promise<ProfileFeatureVector[]> {
    if (profileIds.length === 0) return [];

    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        engagementScore: true,
        _count: {
          select: {
            wallets: true,
            deals: true,
            workflowExecutions: true,
            socialLinks: true,
          },
        },
      },
    });

    // Build raw vectors
    const rawVectors = profiles.map((p) => ({
      profileId: p.id,
      raw: [
        p.engagementScore,
        p._count.wallets,
        p._count.deals,
        p._count.workflowExecutions, // proxy for campaign participation
        p._count.socialLinks,
        0, // totalBalance placeholder (would need aggregation from wallet balances)
      ],
    }));

    // Min-max normalize each dimension
    const dims = rawVectors[0]?.raw.length ?? 0;
    const mins = new Array(dims).fill(Infinity);
    const maxs = new Array(dims).fill(-Infinity);

    for (const v of rawVectors) {
      for (let i = 0; i < dims; i++) {
        if (v.raw[i] < mins[i]) mins[i] = v.raw[i];
        if (v.raw[i] > maxs[i]) maxs[i] = v.raw[i];
      }
    }

    return rawVectors.map((v) => ({
      profileId: v.profileId,
      vector: v.raw.map((val, i) => {
        const range = maxs[i] - mins[i];
        return range === 0 ? 0 : (val - mins[i]) / range;
      }),
    }));
  }
}
