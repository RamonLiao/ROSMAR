import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutoTagService } from '../auto-tag/auto-tag.service';
import { EngagementService } from '../engagement/engagement.service';

@Injectable()
export class ScoreRecalcJob {
  private readonly logger = new Logger(ScoreRecalcJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoTagService: AutoTagService,
    private readonly engagementService: EngagementService,
  ) {}

  async recalculateScores() {
    this.logger.log('Running score recalculation + auto-tag job...');

    const profiles = await this.prisma.profile.findMany({
      where: { isArchived: false },
      select: { id: true, tags: true, workspaceId: true },
    });

    for (const profile of profiles) {
      try {
        // Auto-tag
        const autoTags = await this.autoTagService.computeAutoTags(profile.id);
        const merged = this.autoTagService.mergeTags(profile.tags, autoTags);

        await this.prisma.profile.update({
          where: { id: profile.id },
          data: { tags: merged },
        });

        // Engagement score
        const score = await this.engagementService.recalculateAndPersist(
          profile.id,
          profile.workspaceId,
        );
        this.logger.debug(`Profile ${profile.id} score: ${score}`);
      } catch (err) {
        this.logger.error(`Recalc failed for ${profile.id}`, err);
      }
    }

    this.logger.log(`Recalculated ${profiles.length} profiles`);
  }
}
