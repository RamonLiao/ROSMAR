import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

export interface CreateSegmentDto {
  name: string;
  description?: string;
  rules: any;
}

export interface UpdateSegmentDto {
  name?: string;
  description?: string;
  rules?: any;
  expectedVersion: number;
}

@Injectable()
export class SegmentService {
  private grpcClient: any;
  private isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.isDryRun =
      this.configService.get<string>('SUI_DRY_RUN', 'false') === 'true';
    this.grpcClient = {
      getSegment: () => Promise.resolve({}),
      listSegments: () => Promise.resolve({}),
      evaluateSegment: () => Promise.resolve({}),
    };
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
    dto: CreateSegmentDto,
  ): Promise<any> {
    const result = await this.execChainTx(() => {
      const globalConfigId =
        this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;
      return this.txBuilder.buildCreateSegmentTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        dto.name,
        dto.description || '',
        JSON.stringify(dto.rules),
      );
    });

    const segmentCreatedEvent = result.events?.find((e: any) =>
      e.type.includes('::segment::SegmentCreated'),
    );

    const segmentId =
      segmentCreatedEvent?.parsedJson?.segment_id || randomUUID();

    await this.prisma.segment.create({
      data: {
        id: segmentId,
        workspaceId,
        name: dto.name,
        description: dto.description,
        rules: dto.rules,
      },
    });

    return {
      segmentId,
      txDigest: result.digest,
    };
  }

  async getSegment(segmentId: string): Promise<any> {
    return this.prisma.segment.findUniqueOrThrow({
      where: { id: segmentId },
      include: { _count: { select: { memberships: true } } },
    });
  }

  async listSegments(
    workspaceId: string,
    limit: number,
    offset: number,
    search?: string,
  ): Promise<any> {
    const where: any = { workspaceId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [segments, total] = await Promise.all([
      this.prisma.segment.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { memberships: true } } },
      }),
      this.prisma.segment.count({ where }),
    ]);

    return { segments, total };
  }

  async update(
    workspaceId: string,
    callerAddress: string,
    segmentId: string,
    dto: UpdateSegmentDto,
  ): Promise<any> {
    const result = await this.execChainTx(() => {
      const globalConfigId =
        this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;
      return this.txBuilder.buildUpdateSegmentTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        segmentId,
        dto.name,
        dto.description,
        dto.rules ? JSON.stringify(dto.rules) : undefined,
        dto.expectedVersion,
      );
    });

    const updateData: any = {
      version: { increment: 1 },
    };

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.rules !== undefined) {
      updateData.rules = dto.rules;
    }

    await this.prisma.segment.update({
      where: {
        id: segmentId,
        version: dto.expectedVersion,
      },
      data: updateData,
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  async delete(segmentId: string): Promise<any> {
    // Delete memberships first (FK constraint), then the segment
    await this.prisma.$transaction([
      this.prisma.segmentMembership.deleteMany({ where: { segmentId } }),
      this.prisma.segment.delete({ where: { id: segmentId } }),
    ]);
    return { success: true };
  }

  async evaluateSegment(
    segmentId: string,
    limit: number,
    offset: number,
  ): Promise<any> {
    // Proxy to Rust Core segment engine for evaluation
    return this.grpcClient.evaluateSegment({
      segment_id: segmentId,
      limit,
      offset,
    });
  }

  async refreshSegment(
    workspaceId: string,
    callerAddress: string,
    segmentId: string,
  ): Promise<any> {
    // Trigger segment membership recalculation
    const profiles = await this.grpcClient.evaluateSegment({
      segment_id: segmentId,
      limit: 10000,
      offset: 0,
    });

    const profileIds = profiles.profile_ids || [];

    const operations: any[] = [
      this.prisma.segmentMembership.deleteMany({
        where: { segmentId },
      }),
    ];

    if (profileIds.length > 0) {
      operations.push(
        this.prisma.segmentMembership.createMany({
          data: profileIds.map((pid: string) => ({
            segmentId,
            profileId: pid,
          })),
          skipDuplicates: true,
        }),
      );
    }

    operations.push(
      this.prisma.segment.update({
        where: { id: segmentId },
        data: { lastRefreshedAt: new Date() },
      }),
    );

    await this.prisma.$transaction(operations);

    return {
      success: true,
      profileCount: profileIds.length,
    };
  }
}
