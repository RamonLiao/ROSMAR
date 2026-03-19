import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';

export interface IndexerEventPayload {
  event_id: string;
  event_type: string;
  profile_id?: string;
  address: string;
  data: Record<string, unknown>;
  tx_digest: string;
  timestamp: number;
}

export interface SegmentEventPayload {
  event_type: 'segment_entered' | 'segment_exited';
  segmentId: string;
  profileId: string;
}

@Injectable()
export class TriggerMatcherService {
  private readonly logger = new Logger(TriggerMatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
  ) {}

  @OnEvent('indexer.event')
  async handleIndexerEvent(event: IndexerEventPayload): Promise<void> {
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: { triggerType: event.event_type, isEnabled: true },
      include: { campaign: true },
    });

    for (const trigger of triggers) {
      if (trigger.campaign.status !== 'active') continue;
      if (!this.matchesConfig(trigger.triggerConfig as Record<string, unknown>, event.data)) continue;

      const profileIds = event.profile_id ? [event.profile_id] : [];
      if (profileIds.length === 0) continue;

      this.logger.log(
        `Trigger matched: ${trigger.id} -> campaign ${trigger.campaignId}`,
      );

      await this.workflowEngine.startWorkflow(
        trigger.campaignId,
        trigger.campaign.workflowSteps as any[],
        profileIds,
      );
    }
  }

  @OnEvent('segment.entered')
  async handleSegmentEntered(event: SegmentEventPayload): Promise<void> {
    await this.handleSegmentEvent(event, 'segment_entered');
  }

  @OnEvent('segment.exited')
  async handleSegmentExited(event: SegmentEventPayload): Promise<void> {
    await this.handleSegmentEvent(event, 'segment_exited');
  }

  private async handleSegmentEvent(
    event: SegmentEventPayload,
    triggerType: string,
  ): Promise<void> {
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: { triggerType, isEnabled: true },
      include: { campaign: true },
    });

    for (const trigger of triggers) {
      if (trigger.campaign.status !== 'active') continue;

      const config = trigger.triggerConfig as Record<string, unknown>;
      if (config.segmentId && config.segmentId !== event.segmentId) continue;

      this.logger.log(
        `Segment trigger matched: ${trigger.id} -> campaign ${trigger.campaignId}`,
      );

      await this.workflowEngine.startWorkflow(
        trigger.campaignId,
        trigger.campaign.workflowSteps as any[],
        [event.profileId],
      );
    }
  }

  @OnEvent('quest.completed')
  async handleQuestCompleted(event: { questId: string; profileId: string }): Promise<void> {
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: { triggerType: 'quest_completed', isEnabled: true },
      include: { campaign: true },
    });

    for (const trigger of triggers) {
      if (trigger.campaign.status !== 'active') continue;

      const config = trigger.triggerConfig as Record<string, unknown>;
      if (config.questId && config.questId !== event.questId) continue;

      this.logger.log(
        `Quest trigger matched: ${trigger.id} -> campaign ${trigger.campaignId}`,
      );

      await this.workflowEngine.startWorkflow(
        trigger.campaignId,
        trigger.campaign.workflowSteps as any[],
        [event.profileId],
      );
    }
  }

  @OnEvent('whale_alert')
  async handleWhaleAlert(event: {
    event_type: string;
    address: string;
    profile_id?: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    const triggers = await this.prisma.campaignTrigger.findMany({
      where: {
        triggerType: 'whale_alert',
        isEnabled: true,
        campaign: { status: 'active' },
      },
      include: { campaign: true },
    });

    for (const trigger of triggers) {
      const config = trigger.triggerConfig as Record<string, unknown>;

      // Match config filters (token, minAmount)
      if (
        config.token &&
        (config.token as string).toUpperCase() !==
          (event.data.token as string)?.toUpperCase()
      ) {
        continue;
      }
      if (
        config.minAmount &&
        (event.data.amount as number) < (config.minAmount as number)
      ) {
        continue;
      }

      // Resolve profile
      let profileIds: string[] = [];
      if (event.profile_id) {
        profileIds = [event.profile_id];
      } else if (event.address) {
        const profile = await this.prisma.profile.findFirst({
          where: { primaryAddress: event.address },
          select: { id: true },
        });
        if (profile) profileIds = [profile.id];
      }

      if (profileIds.length === 0) continue;

      this.logger.log(
        `Whale trigger matched: ${trigger.id} -> campaign ${trigger.campaignId}`,
      );

      await this.workflowEngine.startWorkflow(
        trigger.campaignId,
        trigger.campaign.workflowSteps as any[],
        profileIds,
      );
    }
  }

  private matchesConfig(
    config: Record<string, unknown>,
    eventData: Record<string, unknown>,
  ): boolean {
    for (const [key, value] of Object.entries(config)) {
      if (eventData?.[key] !== value) return false;
    }
    return true;
  }
}
