import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';

@Processor('campaign-recurring')
@Injectable()
export class RecurringProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
  ) {
    super();
  }

  async process(job: Job<{ campaignId: string }>): Promise<void> {
    const { campaignId } = job.data;
    this.logger.log(`Processing recurring trigger for campaign ${campaignId}`);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.status !== 'active') {
      this.logger.log(`Campaign ${campaignId} is not active, skipping`);
      return;
    }

    if (!campaign.segmentId) {
      this.logger.warn(`Campaign ${campaignId} has no segment, skipping`);
      return;
    }

    const memberships = await this.prisma.segmentMembership.findMany({
      where: { segmentId: campaign.segmentId },
      select: { profileId: true },
    });

    const profileIds = memberships.map((m) => m.profileId);
    if (profileIds.length === 0) {
      this.logger.log(
        `Campaign ${campaignId} segment has no profiles, skipping`,
      );
      return;
    }

    this.logger.log(
      `Recurring trigger: starting workflow for campaign ${campaignId} with ${profileIds.length} profiles`,
    );

    await this.workflowEngine.startWorkflow(
      campaignId,
      campaign.workflowSteps as any[],
      profileIds,
    );
  }
}
