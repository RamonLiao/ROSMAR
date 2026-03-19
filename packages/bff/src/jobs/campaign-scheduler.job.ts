import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine } from '../campaign/workflow/workflow.engine';

@Processor('campaign-scheduler')
export class CampaignSchedulerJob extends WorkerHost {
  private readonly logger = new Logger(CampaignSchedulerJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.checkScheduledCampaigns();
  }

  private async checkScheduledCampaigns(): Promise<void> {
    this.logger.log('Checking for scheduled campaigns...');

    const now = new Date();

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      select: { id: true, workflowSteps: true, segmentId: true },
      take: 10,
    });

    if (campaigns.length === 0) return;

    this.logger.log(`Found ${campaigns.length} campaigns ready to activate`);

    for (const campaign of campaigns) {
      await this.startCampaign(campaign.id, campaign.workflowSteps, campaign.segmentId);
    }
  }

  private async startCampaign(
    campaignId: string,
    workflowSteps: unknown,
    segmentId: string | null,
  ): Promise<void> {
    this.logger.log(`Starting scheduled campaign ${campaignId}`);

    try {
      // Update status to active
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'active', startedAt: new Date() },
      });

      // Load segment profile IDs and start workflow
      if (segmentId) {
        const memberships = await this.prisma.segmentMembership.findMany({
          where: { segmentId },
          select: { profileId: true },
        });

        const profileIds = memberships.map((m) => m.profileId);

        if (profileIds.length > 0) {
          await this.workflowEngine.startWorkflow(
            campaignId,
            workflowSteps as any[],
            profileIds,
          );

          this.logger.log(
            `Campaign ${campaignId} started with ${profileIds.length} profiles`,
          );
        } else {
          this.logger.log(`Campaign ${campaignId} started with 0 profiles (empty segment)`);
        }
      } else {
        this.logger.log(`Campaign ${campaignId} activated (no segment)`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to start campaign ${campaignId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
