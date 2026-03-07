import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProfileDto {
  primaryAddress: string;
  suinsName?: string;
  tags?: string[];
}

export interface UpdateProfileDto {
  suinsName?: string;
  tags?: string[];
  expectedVersion: number;
}

@Injectable()
export class ProfileService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    // gRPC client for reads (to Rust Core)
    const coreGrpcUrl = this.configService.get<string>(
      'CORE_GRPC_URL',
      'localhost:50051',
    );

    // TODO: Load actual proto service definition
    this.grpcClient = {
      getProfile: () => Promise.resolve({}),
      listProfiles: () => Promise.resolve({}),
    };
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateProfileDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    // Build and execute Sui transaction
    const tx = this.txBuilder.buildCreateProfileTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dto.primaryAddress,
      dto.suinsName || null,
      dto.tags || [],
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Parse profile_id from events
    const profileCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::profile::ProfileCreated'),
    );

    const profileId = (profileCreatedEvent?.parsedJson as any)?.profile_id ?? randomUUID();

    // Write to Prisma for indexing
    await this.prisma.profile.create({
      data: {
        id: profileId,
        workspaceId,
        primaryAddress: dto.primaryAddress,
        suinsName: dto.suinsName || null,
        tags: dto.tags || [],
        tier: 0,
        engagementScore: 0,
        version: 1,
      },
    });

    return {
      profileId,
      txDigest: result.digest,
    };
  }

  async getProfile(profileId: string): Promise<any> {
    return this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
    });
  }

  async listProfiles(
    workspaceId: string,
    limit: number,
    offset: number,
  ): Promise<any> {
    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        where: { workspaceId, isArchived: false },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.profile.count({
        where: { workspaceId, isArchived: false },
      }),
    ]);

    return { profiles, total };
  }

  async updateTags(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    // Build Sui transaction
    const tx = this.txBuilder.buildUpdateProfileTagsTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      profileId,
      dto.tags || [],
      dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Update Prisma
    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        tags: dto.tags,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  async getAssets(profileId: string) {
    const rows = await this.prisma.$queryRaw<
      { collection: string | null; event_type: string; cnt: bigint; total_amount: number | null }[]
    >`
      SELECT
        collection,
        event_type,
        COUNT(*) AS cnt,
        SUM(amount)::float AS total_amount
      FROM wallet_events
      WHERE profile_id = ${profileId}
      GROUP BY collection, event_type
      ORDER BY cnt DESC
    `;

    const nftTypes = ['MintNFTEvent', 'TransferObject'];
    const defiTypes = ['SwapEvent', 'AddLiquidityEvent', 'StakeEvent', 'UnstakeEvent'];

    return {
      nfts: rows
        .filter((r) => nftTypes.includes(r.event_type))
        .map((r) => ({
          collection: r.collection ?? 'Unknown',
          count: Number(r.cnt),
          eventType: r.event_type,
        })),
      defi: rows
        .filter((r) => defiTypes.includes(r.event_type))
        .map((r) => ({
          type: r.event_type,
          count: Number(r.cnt),
          totalAmount: r.total_amount ?? 0,
        })),
      governance: rows
        .filter((r) => ['VoteEvent', 'DelegateEvent'].includes(r.event_type))
        .map((r) => ({
          type: r.event_type,
          count: Number(r.cnt),
        })),
    };
  }

  async getTimeline(profileId: string, limit = 20, offset = 0) {
    const [events, total] = await Promise.all([
      this.prisma.walletEvent.findMany({
        where: { profileId },
        orderBy: { time: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.walletEvent.count({ where: { profileId } }),
    ]);

    return { events, total };
  }

  async archive(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    expectedVersion: number,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildArchiveProfileTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      profileId,
      expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Mark as archived in Prisma
    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        isArchived: true,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }
}
