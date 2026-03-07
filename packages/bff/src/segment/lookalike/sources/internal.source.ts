import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class InternalCandidateSource {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all profile IDs in the workspace, excluding seed IDs.
   */
  async getCandidates(
    workspaceId: string,
    excludeIds: string[],
  ): Promise<string[]> {
    const profiles = await this.prisma.profile.findMany({
      where: {
        workspaceId,
        id: { notIn: excludeIds },
        isArchived: false,
      },
      select: { id: true },
    });
    return profiles.map((p) => p.id);
  }
}
