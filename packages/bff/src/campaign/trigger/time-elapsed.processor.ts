import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';

interface TimeElapsedConfig {
  field: string;
  operator: string; // 'gt' | 'lt'
  value: string; // e.g. '30m', '2h', '7d'
}

@Processor('time-elapsed-trigger')
export class TimeElapsedProcessor extends WorkerHost {
  private readonly logger = new Logger(TimeElapsedProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Checking time-elapsed triggers...');

    const triggers = await this.prisma.campaignTrigger.findMany({
      where: { triggerType: 'time_elapsed', isEnabled: true },
      include: { campaign: true },
    });

    for (const trigger of triggers) {
      if (trigger.campaign.status !== 'active') continue;

      const config = trigger.triggerConfig as unknown as TimeElapsedConfig;
      const durationMs = TimeElapsedProcessor.parseDuration(config.value);
      if (durationMs <= 0) {
        this.logger.warn(`Invalid duration "${config.value}" for trigger ${trigger.id}`);
        continue;
      }

      const cutoff = new Date(Date.now() - durationMs);

      // operator 'gt' means "more than X time has passed" → field value < cutoff
      const dateOp = config.operator === 'gt' ? 'lt' : 'gt';

      const profiles = await this.prisma.profile.findMany({
        where: {
          segmentMemberships: {
            some: { segmentId: trigger.campaign.segmentId },
          },
          [config.field]: { [dateOp]: cutoff },
          NOT: {
            workflowExecutions: {
              some: { campaignId: trigger.campaignId },
            },
          },
        },
        select: { id: true },
        take: 100,
      });

      if (profiles.length > 0) {
        this.logger.log(
          `Trigger ${trigger.id}: ${profiles.length} profiles matched, starting workflow`,
        );
        await this.workflowEngine.startWorkflow(
          trigger.campaignId,
          trigger.campaign.workflowSteps as any[],
          profiles.map((p) => p.id),
        );
      }
    }
  }

  /**
   * Parse a human-friendly duration string into milliseconds.
   * Supports: 30m, 2h, 7d
   */
  static parseDuration(value: string): number {
    const match = value.match(/^(\d+)(m|h|d)$/);
    if (!match) return 0;
    const [, num, unit] = match;
    const multipliers: Record<string, number> = {
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return parseInt(num, 10) * (multipliers[unit] ?? 0);
  }
}
