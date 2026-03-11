import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('campaign-scheduler')
export class CampaignSchedulerJob extends WorkerHost {
  private readonly logger = new Logger(CampaignSchedulerJob.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.checkScheduledCampaigns();
  }

  private async checkScheduledCampaigns(): Promise<void> {
    this.logger.log('Checking for scheduled campaigns...');

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        startedAt: null,
        createdAt: { lte: new Date() },
      },
      select: { id: true, workflowSteps: true, segmentId: true },
      take: 10,
    });

    for (const campaign of campaigns) {
      await this.startCampaign(campaign.id, campaign.workflowSteps, campaign.segmentId);
    }
  }

  private async startCampaign(
    campaignId: string,
    workflowSteps: unknown,
    segmentId: string | null,
  ): Promise<void> {
    this.logger.log(`Starting campaign ${campaignId}`);

    let profileCount = 0;
    if (segmentId) {
      profileCount = await this.prisma.segmentMembership.count({
        where: { segmentId },
      });
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'active', startedAt: new Date() },
    });

    // TODO: Trigger workflow engine for each profile
    this.logger.log(`Campaign ${campaignId} started with ${profileCount} profiles`);
  }
}
