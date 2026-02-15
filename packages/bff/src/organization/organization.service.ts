import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';

export interface CreateOrganizationDto {
  name: string;
  domain?: string;
  tags?: string[];
}

export interface UpdateOrganizationDto {
  name?: string;
  domain?: string;
  tags?: string[];
  expectedVersion: number;
}

@Injectable()
export class OrganizationService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {
    // TODO: Load actual proto service
    this.grpcClient = {
      getOrganization: () => Promise.resolve({}),
      listOrganizations: () => Promise.resolve({}),
    };
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateOrganizationDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    // Build Sui transaction
    const tx = this.txBuilder.buildCreateOrganizationTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dto.name,
      dto.domain || null,
      dto.tags || [],
    );

    const result = await this.suiClient.executeTransaction(tx);

    const orgCreatedEvent = result.events?.find(
      (e: any) => e.type.includes('::organization::OrganizationCreated'),
    );

    const organizationId = (orgCreatedEvent?.parsedJson as any)?.organization_id || randomUUID();

    // Write to PostgreSQL
    await this.prisma.organization.create({
      data: {
        id: organizationId,
        workspaceId,
        name: dto.name,
        domain: dto.domain,
        tags: dto.tags || [],
        version: 1,
      },
    });

    return {
      organizationId,
      txDigest: result.digest,
    };
  }

  async getOrganization(organizationId: string): Promise<any> {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { _count: { select: { profiles: true } } },
    });
  }

  async listOrganizations(
    workspaceId: string,
    limit: number,
    offset: number,
  ): Promise<any> {
    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where: { workspaceId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { profiles: true } } },
      }),
      this.prisma.organization.count({ where: { workspaceId } }),
    ]);

    return { organizations, total };
  }

  async update(
    workspaceId: string,
    callerAddress: string,
    organizationId: string,
    dto: UpdateOrganizationDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildUpdateOrganizationTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      organizationId,
      dto.name,
      dto.domain,
      dto.tags,
      dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Update PostgreSQL
    await this.prisma.organization.update({
      where: {
        id: organizationId,
        version: dto.expectedVersion,
      },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        version: {
          increment: 1,
        },
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  async linkProfile(
    workspaceId: string,
    callerAddress: string,
    organizationId: string,
    profileId: string,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildLinkProfileToOrgTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      organizationId,
      profileId,
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Write to profile_organizations junction table
    await this.prisma.profileOrganization.create({
      data: {
        profileId,
        organizationId,
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }
}
