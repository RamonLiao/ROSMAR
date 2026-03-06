import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
}

export interface UpdateCampaignDto {
  name?: string;
  description?: string;
  status?: string;
  workflowSteps?: any[];
  expectedVersion: number;
}

@Injectable()
export class CampaignService {
  private isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
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

    await this.prisma.campaign.create({
      data: {
        id: campaignId,
        workspaceId,
        name: dto.name,
        description: dto.description,
        segmentId: dto.segmentId,
        workflowSteps: dto.workflowSteps,
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

  async getCampaignStats(campaignId: string): Promise<any> {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: {
        segment: {
          include: { _count: { select: { memberships: true } } },
        },
      },
    });

    return {
      campaignId,
      status: campaign.status,
      segmentSize: campaign.segment._count.memberships,
    };
  }
}
