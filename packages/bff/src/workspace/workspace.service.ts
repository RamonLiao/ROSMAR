import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WEIGHTS, EngagementWeights } from '../engagement/engagement.constants';

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
}
