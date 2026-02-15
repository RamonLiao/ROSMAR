import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
  ) {}

  async createWorkspace(name: string, ownerAddress: string) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;

    const tx = this.txBuilder.buildCreateWorkspaceTx(name, globalConfigId);
    const result = await this.suiClient.executeTransaction(tx);

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

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { _count: { select: { members: true } } },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      owner_address: workspace.ownerAddress,
      member_count: workspace._count.members,
      created_at: workspace.createdAt,
    };
  }

  async addMember(
    workspaceId: string,
    memberAddress: string,
    roleLevel: number,
    permissions: number,
  ) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildAddMemberTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      memberAddress,
      roleLevel,
      permissions,
    );

    const result = await this.suiClient.executeTransaction(tx);

    const member = await this.prisma.workspaceMember.create({
      data: { workspaceId, address: memberAddress, roleLevel, permissions },
    });

    return { success: true, member, txDigest: result.digest };
  }

  async removeMember(workspaceId: string, memberAddress: string) {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildRemoveMemberTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      memberAddress,
    );

    const result = await this.suiClient.executeTransaction(tx);

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_address: { workspaceId, address: memberAddress },
      },
    });

    return { success: true, txDigest: result.digest };
  }
}
