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

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.grpcClient = {
      getSegment: () => Promise.resolve({}),
      listSegments: () => Promise.resolve({}),
      evaluateSegment: () => Promise.resolve({}),
    };
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateSegmentDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildCreateSegmentTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dto.name,
      dto.description || '',
      JSON.stringify(dto.rules),
    );

    const result = await this.suiClient.executeTransaction(tx);

    const segmentCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::segment::SegmentCreated'),
    );

    const segmentId = (segmentCreatedEvent?.parsedJson as any)?.segment_id || randomUUID();

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
  ): Promise<any> {
    const [segments, total] = await Promise.all([
      this.prisma.segment.findMany({
        where: { workspaceId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { memberships: true } } },
      }),
      this.prisma.segment.count({ where: { workspaceId } }),
    ]);

    return { segments, total };
  }

  async update(
    workspaceId: string,
    callerAddress: string,
    segmentId: string,
    dto: UpdateSegmentDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildUpdateSegmentTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      segmentId,
      dto.name,
      dto.description,
      dto.rules ? JSON.stringify(dto.rules) : undefined,
      dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

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
