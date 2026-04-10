import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { NotificationService } from '../notification/notification.service';
import { VALID_TRANSITIONS } from './deal.constants';

export interface CreateDealDto {
  profileId: string;
  title: string;
  amountUsd: number;
  stage: string;
  notes?: string;
}

export interface UpdateDealDto {
  title?: string;
  amountUsd?: number;
  stage?: string;
  notes?: string;
  expectedVersion: number;
}

@Injectable()
export class DealService {
  private isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
  }

  /** Skip TX build entirely in dry-run mode (per lessons.md) */
  private async execChainTx(buildTx: () => any): Promise<any> {
    if (this.isDryRun) {
      return { digest: 'dry-run', events: [] };
    }
    const tx = buildTx();
    return this.suiClient.executeTransaction(tx);
  }

  /** Parse AuditEventV1 from chain result and write to audit_logs */
  private async indexAuditEvent(result: any, txDigest: string): Promise<void> {
    if (this.isDryRun) return;

    const auditEvent = result.events?.find((e: any) =>
      e.type.includes('::deal::AuditEventV1'),
    );
    if (!auditEvent?.parsedJson) return;

    const ev = auditEvent.parsedJson;
    await this.prisma.auditLog.create({
      data: {
        workspaceId: ev.workspace_id,
        actor: ev.actor,
        action: Number(ev.action),
        objectType: Number(ev.object_type),
        objectId: ev.object_id,
        txDigest,
        timestamp: new Date(Number(ev.timestamp)),
      },
    });
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateDealDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildCreateDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        dto.profileId,
        dto.title,
        dto.amountUsd,
        dto.stage,
      ),
    );

    // Parse object_id from AuditEventV1 (more reliable than DealCreated)
    const auditEvent = result.events?.find((e: any) =>
      e.type.includes('::deal::AuditEventV1'),
    );
    const suiObjectId = auditEvent?.parsedJson?.object_id ?? null;
    const dealId = suiObjectId || randomUUID();

    await this.prisma.deal.create({
      data: {
        id: dealId,
        workspaceId,
        profileId: dto.profileId,
        suiObjectId,
        title: dto.title,
        amountUsd: dto.amountUsd,
        stage: dto.stage,
        notes: dto.notes ?? null,
      },
    });

    await this.indexAuditEvent(result, result.digest);

    return { dealId, suiObjectId, txDigest: result.digest };
  }

  async getDeal(workspaceId: string, dealId: string): Promise<any> {
    return this.prisma.deal.findFirstOrThrow({
      where: { id: dealId, workspaceId },
    });
  }

  async listDeals(
    workspaceId: string,
    profileId?: string,
    stage?: string,
    limit?: number,
    offset?: number,
  ): Promise<any> {
    const where: any = { workspaceId, isArchived: false };
    if (profileId) where.profileId = profileId;
    if (stage) where.stage = stage;

    const [deals, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return { deals, total };
  }

  async update(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    dto: UpdateDealDto,
  ): Promise<any> {
    // Read current deal to fill unchanged fields (contract requires all)
    const deal = await this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });

    if (!deal.suiObjectId && !this.isDryRun) {
      throw new NotFoundException('Deal has no on-chain object ID');
    }

    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const title = dto.title ?? deal.title;
    const amountUsd = dto.amountUsd ?? Number(deal.amountUsd);
    const stage = dto.stage ?? deal.stage;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildUpdateDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        deal.suiObjectId!,
        dto.expectedVersion,
        title,
        amountUsd,
        stage,
      ),
    );

    const updateData: any = {
      version: { increment: 1 },
      title,
      amountUsd,
      stage,
    };
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    await this.prisma.deal.update({
      where: { id: dealId, version: dto.expectedVersion },
      data: updateData,
    });

    await this.indexAuditEvent(result, result.digest);

    return { success: true, txDigest: result.digest };
  }

  async updateStage(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    stage: string,
    expectedVersion: number,
  ): Promise<any> {
    // Convenience: read deal, call update_deal with full fields
    const deal = await this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });

    // State machine guard (T11)
    const allowed = VALID_TRANSITIONS[deal.stage];
    if (!allowed || !allowed.includes(stage)) {
      throw new BadRequestException(
        `Invalid transition: ${deal.stage} → ${stage}`,
      );
    }

    if (!deal.suiObjectId && !this.isDryRun) {
      throw new NotFoundException('Deal has no on-chain object ID');
    }

    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildUpdateDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        deal.suiObjectId!,
        expectedVersion,
        deal.title,
        Number(deal.amountUsd),
        stage,
      ),
    );

    await this.prisma.deal.update({
      where: { id: dealId, version: expectedVersion },
      data: { stage, version: { increment: 1 } },
    });

    await this.indexAuditEvent(result, result.digest);

    this.notificationService
      .create({
        workspaceId,
        userId: callerAddress,
        type: 'deal_stage_changed',
        title: `Deal stage changed to "${stage}"`,
        metadata: { dealId, stage },
      })
      .catch(() => {});

    this.eventEmitter.emit('deal.stage_changed', {
      dealId,
      stage,
      workspaceId,
    });

    return { success: true, txDigest: result.digest };
  }

  async archive(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    expectedVersion: number,
  ): Promise<any> {
    const deal = await this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });

    if (!deal.suiObjectId && !this.isDryRun) {
      throw new NotFoundException('Deal has no on-chain object ID');
    }

    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const result = await this.execChainTx(() =>
      this.txBuilder.buildArchiveDealTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        deal.suiObjectId!,
        expectedVersion,
      ),
    );

    await this.prisma.deal.update({
      where: { id: dealId, version: expectedVersion },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.indexAuditEvent(result, result.digest);

    return { success: true, txDigest: result.digest };
  }

  async getAuditLogs(workspaceId: string, objectId: string): Promise<any> {
    return this.prisma.auditLog.findMany({
      where: { objectId, workspaceId },
      orderBy: { timestamp: 'desc' },
    });
  }
}
