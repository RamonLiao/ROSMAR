import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AutoTagService } from '../auto-tag/auto-tag.service';
import { EngagementService } from '../engagement/engagement.service';

@Processor('score-recalc')
export class ScoreRecalcJob extends WorkerHost {
  private readonly logger = new Logger(ScoreRecalcJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoTagService: AutoTagService,
    private readonly engagementService: EngagementService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.recalculateScores();
  }

  private async recalculateScores(): Promise<void> {
    this.logger.log('Running score recalculation + auto-tag job...');

    const profiles = await this.prisma.profile.findMany({
      where: { isArchived: false },
      select: { id: true, tags: true, workspaceId: true },
    });

    for (const profile of profiles) {
      try {
        const autoTags = await this.autoTagService.computeAutoTags(profile.id);
        const merged = this.autoTagService.mergeTags(profile.tags, autoTags);

        await this.prisma.profile.update({
          where: { id: profile.id },
          data: { tags: merged },
        });

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
