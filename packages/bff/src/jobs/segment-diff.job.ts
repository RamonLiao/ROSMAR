import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SegmentDiffJob {
  private readonly logger = new Logger(SegmentDiffJob.name);
  /** segmentId -> Set of profileIds from previous check */
  private previousMemberships = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Runs on cron schedule (every 5 minutes).
   * Called by the job scheduler (BullMQ or manual interval).
   */
  async checkSegmentDiffs(): Promise<void> {
    // Find all segments that have active triggers of type segment_entered or segment_exited
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: {
        triggerType: { in: ['segment_entered', 'segment_exited'] },
        isEnabled: true,
      },
      include: { campaign: true },
    });

    // Collect unique segment IDs from trigger configs
    const segmentIds = new Set<string>();
    for (const trigger of triggers) {
      const config = trigger.triggerConfig as Record<string, unknown>;
      const segmentId = (config.segmentId as string) || trigger.campaign.segmentId;
      if (segmentId) segmentIds.add(segmentId);
    }

    for (const segmentId of segmentIds) {
      await this.diffSegment(segmentId, triggers);
    }
  }

  private async diffSegment(
    segmentId: string,
    triggers: Array<{ triggerType: string; triggerConfig: unknown; campaign: { segmentId: string } }>,
  ): Promise<void> {
    const memberships = await this.prisma.segmentMembership.findMany({
      where: { segmentId },
      select: { profileId: true },
    });

    const currentSet = new Set(memberships.map((m) => m.profileId));
    const previousSet = this.previousMemberships.get(segmentId);

    if (!previousSet) {
      // First run -- establish baseline, don't emit events
      this.previousMemberships.set(segmentId, currentSet);
      this.logger.log(`Baseline established for segment ${segmentId}: ${currentSet.size} members`);
      return;
    }

    // Detect entries: in current but not in previous
    const hasEnteredTrigger = triggers.some((t) => t.triggerType === 'segment_entered');
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

    // Detect exits: in previous but not in current
    const hasExitedTrigger = triggers.some((t) => t.triggerType === 'segment_exited');
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

    // Update snapshot
    this.previousMemberships.set(segmentId, currentSet);
  }
}
