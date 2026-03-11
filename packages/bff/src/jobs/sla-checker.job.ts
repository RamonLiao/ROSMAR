import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('sla-checker')
export class SlaCheckerJob extends WorkerHost {
  private readonly logger = new Logger(SlaCheckerJob.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.checkSlaViolations();
  }

  private async checkSlaViolations(): Promise<void> {
    this.logger.log('Checking for SLA violations...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const staleDeals = await this.prisma.deal.findMany({
      where: {
        isArchived: false,
        updatedAt: { lt: sevenDaysAgo },
      },
      select: { id: true, workspaceId: true, profileId: true, stage: true },
      take: 50,
    });

    for (const deal of staleDeals) {
      this.logger.log(
        `SLA Alert: Deal ${deal.id} stuck in ${deal.stage} for > 7 days`,
      );
    }

    this.logger.log(`Processed ${staleDeals.length} stale deals`);
  }
}
