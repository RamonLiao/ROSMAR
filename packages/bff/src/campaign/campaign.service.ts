import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { WorkflowEngine } from './workflow/workflow.engine';
import { NotificationService } from '../notification/notification.service';

export interface CreateCampaignDto {
  name: string;
  description?: string;
  segmentId: string;
  workflowSteps: any[];
  scheduledAt?: string;
}

export interface UpdateCampaignDto {
  name?: string;
  description?: string;
  status?: string;
  workflowSteps?: any[];
  scheduledAt?: string;
  expectedVersion: number;
}

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);
  private isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    @InjectQueue('campaign-recurring') private readonly recurringQueue: Queue,
  ) {
    this.isDryRun = this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
  }

  private async execChainTx(buildTx: () => any): Promise<any> {
    if (this.isDryRun) {
      return { digest: 'dry-run', events: [] };
    }
    const tx = buildTx();
    return this.suiClient.executeTransaction(tx);
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateCampaignDto,
  ): Promise<any> {
    const result = await this.execChainTx(() => {
      const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;
      return this.txBuilder.buildCreateCampaignTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        dto.name,
        dto.description || '',
        dto.segmentId,
      );
    });

    const campaignCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::campaign::CampaignCreated'),
    );

    const campaignId = (campaignCreatedEvent?.parsedJson as any)?.campaign_id || randomUUID();

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const status = scheduledAt && scheduledAt > new Date() ? 'scheduled' : 'draft';

    await this.prisma.campaign.create({
      data: {
        id: campaignId,
        workspaceId,
        name: dto.name,
        description: dto.description,
        segmentId: dto.segmentId,
        workflowSteps: dto.workflowSteps,
        status,
        scheduledAt,
      },
    });

    return {
      campaignId,
      txDigest: result.digest,
    };
  }

  async getCampaign(campaignId: string): Promise<any> {
    return this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { segment: { select: { name: true } } },
    });
  }

  async listCampaigns(
    workspaceId: string,
    status?: string,
    limit?: number,
    offset?: number,
  ): Promise<any> {
    const where: any = { workspaceId };
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { segment: { select: { name: true } } },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { campaigns, total };
  }

  async update(
    workspaceId: string,
    callerAddress: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ): Promise<any> {
    const result = await this.execChainTx(() => {
      const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;
      return this.txBuilder.buildUpdateCampaignTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        campaignId,
        dto.name,
        dto.description,
        dto.status,
        dto.expectedVersion,
      );
    });

    const updateData: any = { version: { increment: 1 } };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.workflowSteps !== undefined) updateData.workflowSteps = dto.workflowSteps;
    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      updateData.scheduledAt = scheduledAt;
      if (scheduledAt > new Date()) {
        updateData.status = 'scheduled';
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId, version: dto.expectedVersion },
      data: updateData,
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  async startCampaign(
    workspaceId: string,
    callerAddress: string,
    campaignId: string,
  ): Promise<any> {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });

    const memberships = await this.prisma.segmentMembership.findMany({
      where: { segmentId: campaign.segmentId },
      select: { profileId: true },
    });

    const profileIds = memberships.map((m) => m.profileId);

    await this.workflowEngine.startWorkflow(
      campaignId,
      campaign.workflowSteps as any[],
      profileIds,
    );

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'active', startedAt: new Date() },
    });

    this.notificationService.create({
      workspaceId,
      userId: callerAddress,
      type: 'campaign_started',
      title: `Campaign "${campaign.name}" started`,
      body: `Targeting ${profileIds.length} profiles`,
      metadata: { campaignId },
    }).catch(() => {});

    return {
      success: true,
      profileCount: profileIds.length,
    };
  }

  async pauseCampaign(
    workspaceId: string,
    callerAddress: string,
    campaignId: string,
  ): Promise<any> {
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'paused' },
    });

    return { success: true };
  }

  // --- Scheduling ---

  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<any> {
    if (scheduledAt <= new Date()) {
      throw new Error('scheduledAt must be in the future');
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        scheduledAt,
        status: 'scheduled',
      },
    });
  }

  async createRecurringTrigger(
    campaignId: string,
    cron: string,
    timezone?: string,
  ): Promise<any> {
    const trigger = await this.createTrigger(campaignId, {
      triggerType: 'recurring',
      triggerConfig: { cron, timezone: timezone ?? 'UTC' },
    });

    // Add BullMQ repeatable job
    await this.recurringQueue.add(
      `recurring-${campaignId}`,
      { campaignId },
      { repeat: { pattern: cron, tz: timezone ?? 'UTC' } },
    );

    this.logger.log(
      `Created recurring trigger for campaign ${campaignId}: ${cron} (${timezone ?? 'UTC'})`,
    );

    return trigger;
  }

  async removeRecurringTrigger(campaignId: string, triggerId: string): Promise<any> {
    const trigger = await this.deleteTrigger(campaignId, triggerId);

    // Remove BullMQ repeatable job
    const repeatableJobs = await this.recurringQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === `recurring-${campaignId}`) {
        await this.recurringQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed recurring job for campaign ${campaignId}`);
      }
    }

    return trigger;
  }

  // --- Trigger CRUD ---

  async createTrigger(
    campaignId: string,
    dto: { triggerType: string; triggerConfig: Record<string, unknown>; isEnabled?: boolean },
  ): Promise<any> {
    // Verify campaign exists
    await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });

    return this.prisma.campaignTrigger.create({
      data: {
        campaignId,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig as any,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async listTriggers(campaignId: string): Promise<any[]> {
    return this.prisma.campaignTrigger.findMany({
      where: { campaignId },
      orderBy: { triggerType: 'asc' },
    });
  }

  async updateTrigger(
    campaignId: string,
    triggerId: string,
    dto: { triggerConfig?: Record<string, unknown>; isEnabled?: boolean },
  ): Promise<any> {
    const data: any = {};
    if (dto.triggerConfig !== undefined) data.triggerConfig = dto.triggerConfig;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;

    return this.prisma.campaignTrigger.update({
      where: { id: triggerId, campaignId },
      data,
    });
  }

  async deleteTrigger(campaignId: string, triggerId: string): Promise<any> {
    return this.prisma.campaignTrigger.delete({
      where: { id: triggerId, campaignId },
    });
  }

  async getCampaignStats(campaignId: string): Promise<any> {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        segment: {
          include: { _count: { select: { memberships: true } } },
        },
      },
    });

    // Count workflow executions by status
    const [totalEntries, completedCount, failedCount] = await Promise.all([
      this.prisma.workflowExecution.count({ where: { campaignId } }),
      this.prisma.workflowExecution.count({
        where: { campaignId, status: 'completed' },
      }),
      this.prisma.workflowExecution.count({
        where: { campaignId, status: 'failed' },
      }),
    ]);

    // Per-step metrics from action logs
    const actionLogs = await this.prisma.workflowActionLog.findMany({
      where: { campaignId },
      select: { stepIndex: true, actionType: true, status: true },
    });

    const stepMap = new Map<
      number,
      { actionType: string; successCount: number; failCount: number }
    >();

    for (const log of actionLogs) {
      let entry = stepMap.get(log.stepIndex);
      if (!entry) {
        entry = { actionType: log.actionType, successCount: 0, failCount: 0 };
        stepMap.set(log.stepIndex, entry);
      }
      if (log.status === 'success') entry.successCount++;
      else if (log.status === 'failed') entry.failCount++;
    }

    const perStep = Array.from(stepMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stepIndex, data]) => ({ stepIndex, ...data }));

    const conversionRate =
      totalEntries > 0
        ? Math.round((completedCount / totalEntries) * 10000) / 100
        : 0;

    return {
      campaignId,
      status: campaign.status,
      segmentSize: campaign.segment._count.memberships,
      totalEntries,
      completedCount,
      failedCount,
      perStep,
      conversionRate,
    };
  }
}
