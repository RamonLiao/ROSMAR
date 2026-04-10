import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

export interface SegmentDiffJobData {
  segmentId?: string;
}

@Processor('segment-diff')
export class SegmentDiffJob extends WorkerHost {
  private readonly logger = new Logger(SegmentDiffJob.name);
  private previousMemberships = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(_job: Job<SegmentDiffJobData>): Promise<void> {
    await this.checkSegmentDiffs();
  }

  private async checkSegmentDiffs(): Promise<void> {
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: {
        triggerType: { in: ['segment_entered', 'segment_exited'] },
        isEnabled: true,
      },
      include: { campaign: true },
    });

    const segmentIds = new Set<string>();
    for (const trigger of triggers) {
      const config = trigger.triggerConfig as Record<string, unknown>;
      const segmentId =
        (config.segmentId as string) || trigger.campaign.segmentId;
      if (segmentId) segmentIds.add(segmentId);
    }

    for (const segmentId of segmentIds) {
      await this.diffSegment(segmentId, triggers);
    }
  }

  private async diffSegment(
    segmentId: string,
    triggers: Array<{
      triggerType: string;
      triggerConfig: unknown;
      campaign: { segmentId: string };
    }>,
  ): Promise<void> {
    const memberships = await this.prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { profileId: true },
    });

    const currentSet = new Set(memberships.map((m) => m.profileId));
    const previousSet = this.previousMemberships.get(segmentId);

    if (!previousSet) {
      this.previousMemberships.set(segmentId, currentSet);
      this.logger.log(
        `Baseline established for segment ${segmentId}: ${currentSet.size} members`,
      );
      return;
    }

    const hasEnteredTrigger = triggers.some(
      (t) => t.triggerType === 'segment_entered',
    );
    if (hasEnteredTrigger) {
      for (const profileId of currentSet) {
        if (!previousSet.has(profileId)) {
          this.logger.log(`Profile ${profileId} entered segment ${segmentId}`);
          this.eventEmitter.emit('segment.entered', {
            event_type: 'segment_entered',
            segmentId,
            profileId,
          });
        }
      }
    }

    const hasExitedTrigger = triggers.some(
      (t) => t.triggerType === 'segment_exited',
    );
    if (hasExitedTrigger) {
      for (const profileId of previousSet) {
        if (!currentSet.has(profileId)) {
          this.logger.log(`Profile ${profileId} exited segment ${segmentId}`);
          this.eventEmitter.emit('segment.exited', {
            event_type: 'segment_exited',
            segmentId,
            profileId,
          });
        }
      }
    }

    this.previousMemberships.set(segmentId, currentSet);
  }
}
