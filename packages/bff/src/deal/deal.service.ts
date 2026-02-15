import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

export interface CreateDealDto {
  profileId: string;
  title: string;
  amountUsd: number;
  stage: string;
}

export interface UpdateDealDto {
  title?: string;
  amountUsd?: number;
  stage?: string;
  expectedVersion: number;
}

@Injectable()
export class DealService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.grpcClient = {
      getDeal: () => Promise.resolve({}),
      listDeals: () => Promise.resolve({}),
    };
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateDealDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildCreateDealTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dto.profileId,
      dto.title,
      dto.amountUsd,
      dto.stage,
    );

    const result = await this.suiClient.executeTransaction(tx);

    const dealCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::deal::DealCreated'),
    );

    const dealId = (dealCreatedEvent?.parsedJson as any)?.deal_id || randomUUID();

    await this.prisma.deal.create({
      data: {
        id: dealId,
        workspaceId,
        profileId: dto.profileId,
        title: dto.title,
        amountUsd: dto.amountUsd,
        stage: dto.stage,
      },
    });

    return {
      dealId,
      txDigest: result.digest,
    };
  }

  async getDeal(dealId: string): Promise<any> {
    return this.prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
    });
  }

  async listDeals(
    workspaceId: string,
    profileId?: string,
    stage?: string,
    limit?: number,
    offset?: number,
  ): Promise<any> {
    const where: any = { workspaceId };
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
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildUpdateDealTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dealId,
      dto.title,
      dto.amountUsd,
      dto.stage,
      dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    const updateData: any = {
      version: { increment: 1 },
    };

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }
    if (dto.amountUsd !== undefined) {
      updateData.amountUsd = dto.amountUsd;
    }
    if (dto.stage !== undefined) {
      updateData.stage = dto.stage;
    }

    await this.prisma.deal.update({
      where: {
        id: dealId,
        version: dto.expectedVersion,
      },
      data: updateData,
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  async updateStage(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
    stage: string,
    expectedVersion: number,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildUpdateDealStageTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dealId,
      stage,
      expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.deal.update({
      where: {
        id: dealId,
        version: expectedVersion,
      },
      data: {
        stage,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }
}
