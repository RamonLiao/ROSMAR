import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from './walrus.client';
import { SuiClientService } from '../blockchain/sui.client';

export interface StoreSecretDto {
  profileId: string;
  key: string;
  encryptedData: Buffer;
  sealPolicyId?: string;
  expiresAt?: Date;
  releaseAt?: Date;
}

export interface UpdateSecretDto {
  encryptedData: Buffer;
  expectedVersion: number;
}

@Injectable()
export class VaultService {
  // Policy rule constants (match Move contract)
  private readonly RULE_WORKSPACE_MEMBER = 0;
  private readonly RULE_SPECIFIC_ADDRESS = 1;
  private readonly RULE_ROLE_BASED = 2;

  constructor(
    private readonly walrusClient: WalrusClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
  ) {}

  async storeSecret(
    workspaceId: string,
    callerAddress: string,
    dto: StoreSecretDto,
  ): Promise<any> {
    await this.verifyPolicyAccess(workspaceId, callerAddress, null);

    const uploadResult = await this.walrusClient.uploadBlob(dto.encryptedData);

    const hasRelease = !!dto.releaseAt;

    const secret = await this.prisma.vaultSecret.upsert({
      where: {
        workspaceId_profileId_key: {
          workspaceId,
          profileId: dto.profileId,
          key: dto.key,
        },
      },
      update: {
        walrusBlobId: uploadResult.blobId,
        sealPolicyId: dto.sealPolicyId ?? null,
        expiresAt: dto.expiresAt ?? null,
        releaseAt: dto.releaseAt ?? null,
        isReleased: !hasRelease,
        version: { increment: 1 },
      },
      create: {
        workspaceId,
        profileId: dto.profileId,
        key: dto.key,
        walrusBlobId: uploadResult.blobId,
        sealPolicyId: dto.sealPolicyId ?? null,
        expiresAt: dto.expiresAt ?? null,
        releaseAt: dto.releaseAt ?? null,
        isReleased: !hasRelease,
      },
    });

    await this.logAccess(workspaceId, secret.id, callerAddress, 'create');

    return {
      blobId: uploadResult.blobId,
      url: uploadResult.url,
    };
  }

  async getSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
  ): Promise<any> {
    const secret = await this.prisma.vaultSecret.findUnique({
      where: {
        workspaceId_profileId_key: { workspaceId, profileId, key },
      },
    });

    if (!secret) return null;

    if (secret.releaseAt && !secret.isReleased) {
      throw new ForbiddenException(
        `Secret is time-locked until ${secret.releaseAt.toISOString()}`,
      );
    }

    await this.verifyPolicyAccess(
      workspaceId,
      callerAddress,
      secret.sealPolicyId,
    );
    await this.logAccess(workspaceId, secret.id, callerAddress, 'read');

    return {
      blobId: secret.walrusBlobId,
      downloadUrl: `${this.configService.get('WALRUS_AGGREGATOR_URL')}/v1/${secret.walrusBlobId}`,
      version: secret.version,
    };
  }

  async listSecrets(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
  ): Promise<any> {
    await this.verifyPolicyAccess(workspaceId, callerAddress, null);

    const secrets = await this.prisma.vaultSecret.findMany({
      where: { workspaceId, profileId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      secrets: secrets.map((s) => ({
        key: s.key,
        blobId: s.walrusBlobId,
        version: s.version,
        sealPolicyId: s.sealPolicyId,
        expiresAt: s.expiresAt,
        releaseAt: s.releaseAt,
        isReleased: s.isReleased,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  async updateSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
    dto: UpdateSecretDto,
  ): Promise<any> {
    const existing = await this.prisma.vaultSecret.findUnique({
      where: {
        workspaceId_profileId_key: { workspaceId, profileId, key },
      },
    });

    if (!existing) throw new Error('Secret not found');

    await this.verifyPolicyAccess(
      workspaceId,
      callerAddress,
      existing.sealPolicyId,
    );

    const uploadResult = await this.walrusClient.uploadBlob(dto.encryptedData);

    const updated = await this.prisma.vaultSecret.updateMany({
      where: {
        workspaceId,
        profileId,
        key,
        version: dto.expectedVersion,
      },
      data: {
        walrusBlobId: uploadResult.blobId,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    await this.logAccess(workspaceId, existing.id, callerAddress, 'update');

    return {
      blobId: uploadResult.blobId,
      url: uploadResult.url,
      version: dto.expectedVersion + 1,
    };
  }

  async deleteSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
    expectedVersion: number,
  ): Promise<any> {
    const existing = await this.prisma.vaultSecret.findUnique({
      where: {
        workspaceId_profileId_key: { workspaceId, profileId, key },
      },
    });

    if (!existing) throw new Error('Secret not found');

    await this.verifyPolicyAccess(
      workspaceId,
      callerAddress,
      existing.sealPolicyId,
    );

    const deleted = await this.prisma.vaultSecret.deleteMany({
      where: {
        workspaceId,
        profileId,
        key,
        version: expectedVersion,
      },
    });

    if (deleted.count === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    await this.logAccess(workspaceId, existing.id, callerAddress, 'delete');

    return {
      success: true,
      deletedBlobId: existing.walrusBlobId,
    };
  }

  async releaseSecret(
    workspaceId: string,
    profileId: string,
    key: string,
  ): Promise<void> {
    const secret = await this.prisma.vaultSecret.findUnique({
      where: { workspaceId_profileId_key: { workspaceId, profileId, key } },
    });
    if (!secret) throw new NotFoundException('Secret not found');

    await this.prisma.vaultSecret.update({
      where: { id: secret.id },
      data: { isReleased: true },
    });

    await this.logAccess(workspaceId, secret.id, 'system', 'RELEASE');
  }

  async getAccessLog(workspaceId: string, profileId: string, key: string) {
    const secret = await this.prisma.vaultSecret.findUnique({
      where: {
        workspaceId_profileId_key: { workspaceId, profileId, key },
      },
    });
    if (!secret) return { logs: [] };

    const logs = await this.prisma.vaultAccessLog.findMany({
      where: { workspaceId, secretId: secret.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { logs };
  }

  async verifyPolicyAccess(
    workspaceId: string,
    callerAddress: string,
    sealPolicyId: string | null,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_address: { workspaceId, address: callerAddress },
      },
    });

    if (!member || (member.permissions & 16) === 0) {
      throw new UnauthorizedException('No access to this vault');
    }

    // If no seal policy, workspace membership is sufficient
    if (!sealPolicyId) return;

    // Fetch policy object from chain
    const policyObj = await this.suiClient.getObject(sealPolicyId);
    const fields = (policyObj?.data?.content as any)?.fields;
    if (!fields) return; // Policy not found on-chain, fall back to membership check

    const ruleType = Number(fields.rule_type);

    if (ruleType === this.RULE_WORKSPACE_MEMBER) {
      return;
    }

    if (ruleType === this.RULE_SPECIFIC_ADDRESS) {
      const allowed: string[] = fields.allowed_addresses ?? [];
      if (!allowed.includes(callerAddress)) {
        throw new UnauthorizedException(
          'Your address is not in the allowed list for this vault item',
        );
      }
      return;
    }

    if (ruleType === this.RULE_ROLE_BASED) {
      const minLevel = Number(fields.min_role_level);
      if (member.roleLevel < minLevel) {
        throw new UnauthorizedException(
          `Requires role level ${minLevel}, you have ${member.roleLevel}`,
        );
      }
      return;
    }

    throw new UnauthorizedException('Unknown policy rule type');
  }

  private async logAccess(
    workspaceId: string,
    secretId: string,
    actor: string,
    action: string,
    metadata?: any,
  ) {
    await this.prisma.vaultAccessLog.create({
      data: { workspaceId, secretId, actor, action, metadata },
    });
  }
}
