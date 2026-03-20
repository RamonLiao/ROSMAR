import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WEIGHTS, EngagementWeights } from '../engagement/engagement.constants';
import type { CollectionEntryDto } from './dto/collection-watchlist.dto';

export interface WhaleThreshold {
  token: string;
  amount: number;
}

@Injectable()
export class WorkspaceService {
  private readonly isDryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
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

  async createWorkspace(name: string, ownerAddress: string) {
    const result = await this.execChainTx(() => {
      const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      return this.txBuilder.buildCreateWorkspaceTx(name, globalConfigId);
    });

    const wsEvent = result.events?.find(
      (e: any) => e.type.includes('::workspace::WorkspaceCreated'),
    );
    const suiObjectId = (wsEvent?.parsedJson as any)?.workspace_id ?? null;

    const workspace = await this.prisma.workspace.create({
      data: { suiObjectId, name, ownerAddress },
    });

    // Auto-add owner as admin member (roleLevel=3, permissions=31 = all)
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        address: ownerAddress,
        roleLevel: 3,
        permissions: 31,
      },
    });

    return { success: true, workspace };
  }

  async listUserWorkspaces(address: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { address },
      include: { workspace: true },
    });

    return {
      workspaces: members.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        suiObjectId: m.workspace.suiObjectId,
        role_level: m.roleLevel,
        permissions: m.permissions,
      })),
    };
  }

  async updateWorkspace(
    workspaceId: string,
    data: { name?: string; description?: string },
  ) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
    };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { _count: { select: { members: true } } },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      owner_address: workspace.ownerAddress,
      member_count: workspace._count.members,
      created_at: workspace.createdAt,
      discordGuildId: workspace.discordGuildId,
    };
  }

  async listMembers(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      members: members.map((m) => ({
        address: m.address,
        role_level: m.roleLevel,
        permissions: m.permissions,
        joined_at: m.joinedAt,
      })),
    };
  }

  async addMember(
    workspaceId: string,
    memberAddress: string,
    roleLevel: number,
    permissions: number,
  ) {
    const result = await this.execChainTx(() => {
      const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;
      return this.txBuilder.buildAddMemberTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        memberAddress,
        roleLevel,
        permissions,
      );
    });

    const member = await this.prisma.workspaceMember.create({
      data: { workspaceId, address: memberAddress, roleLevel, permissions },
    });

    return { success: true, member, txDigest: result.digest };
  }

  async removeMember(workspaceId: string, memberAddress: string) {
    const result = await this.execChainTx(() => {
      const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
      const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;
      return this.txBuilder.buildRemoveMemberTx(
        globalConfigId,
        workspaceId,
        adminCapId,
        memberAddress,
      );
    });

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_address: { workspaceId, address: memberAddress },
      },
    });

    return { success: true, txDigest: result.digest };
  }

  async getEngagementWeights(workspaceId: string): Promise<EngagementWeights> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { engagementWeights: true },
    });
    return (ws.engagementWeights as EngagementWeights | null) ?? { ...DEFAULT_WEIGHTS };
  }

  async setEngagementWeights(
    workspaceId: string,
    weights: EngagementWeights,
  ): Promise<EngagementWeights> {
    const sum =
      weights.holdTime +
      weights.txCount +
      weights.txValue +
      weights.voteCount +
      weights.nftCount;

    if (Math.abs(sum - 1.0) > 0.05) {
      throw new BadRequestException(
        `Weights must sum to ~1.0 (got ${sum.toFixed(4)})`,
      );
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { engagementWeights: weights as any },
    });

    return weights;
  }

  async getCollectionWatchlist(workspaceId: string): Promise<CollectionEntryDto[]> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { collectionWatchlist: true },
    });
    return (ws.collectionWatchlist as CollectionEntryDto[] | null) ?? [];
  }

  async setCollectionWatchlist(
    workspaceId: string,
    list: CollectionEntryDto[],
  ): Promise<CollectionEntryDto[]> {
    // Validate no duplicate contract addresses
    const seen = new Set<string>();
    for (const entry of list) {
      const key = `${entry.chain}:${entry.contractAddress}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate collection: ${entry.contractAddress} on ${entry.chain}`,
        );
      }
      seen.add(key);
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { collectionWatchlist: list as any },
    });

    return list;
  }

  async getWhaleThresholds(workspaceId: string): Promise<WhaleThreshold[]> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { whaleThresholds: true },
    });
    return (ws.whaleThresholds as WhaleThreshold[] | null) ?? [];
  }

  async setWhaleThresholds(
    workspaceId: string,
    thresholds: WhaleThreshold[],
  ): Promise<WhaleThreshold[]> {
    // Deduplicate by token (last wins)
    const map = new Map<string, WhaleThreshold>();
    for (const t of thresholds) {
      map.set(t.token.toUpperCase(), { token: t.token.toUpperCase(), amount: t.amount });
    }
    const deduped = Array.from(map.values());

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { whaleThresholds: deduped as any },
    });

    return deduped;
  }

  async getTopWhales(workspaceId: string, limit = 20) {
    const rows = await this.prisma.walletBalance.groupBy({
      by: ['profileId'],
      where: { workspaceId, assetType: 'token' },
      _sum: { rawBalance: true },
      orderBy: { _sum: { rawBalance: 'desc' } },
      take: limit,
    });

    if (rows.length === 0) return [];

    const profileIds = rows.map((r) => r.profileId);
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, primaryAddress: true, suinsName: true, tags: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return rows.map((r) => {
      const profile = profileMap.get(r.profileId);
      return {
        profileId: r.profileId,
        primaryAddress: profile?.primaryAddress ?? '',
        suinsName: profile?.suinsName ?? null,
        tags: profile?.tags ?? [],
        totalRawBalance: r._sum.rawBalance?.toString() ?? '0',
      };
    });
  }
}
