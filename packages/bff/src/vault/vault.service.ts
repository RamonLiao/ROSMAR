import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from './walrus.client';

export interface StoreSecretInput {
  profileId: string;
  key: string;
  encryptedData: string;
  vaultType: 'note' | 'file';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface UpdateSecretInput {
  encryptedData: string;
  expectedVersion: number;
}

@Injectable()
export class VaultService {
  constructor(
    private readonly walrusClient: WalrusClient,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async storeSecret(
    workspaceId: string,
    callerAddress: string,
    dto: StoreSecretInput,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const uploadResult = await this.walrusClient.uploadBlob(
      Buffer.from(dto.encryptedData, 'base64'),
    );

    await this.prisma.vaultSecret.upsert({
      where: {
        workspaceId_profileId_key: {
          workspaceId,
          profileId: dto.profileId,
          key: dto.key,
        },
      },
      create: {
        workspaceId,
        profileId: dto.profileId,
        key: dto.key,
        walrusBlobId: uploadResult.blobId,
        vaultType: dto.vaultType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        version: 1,
      },
      update: {
        walrusBlobId: uploadResult.blobId,
        vaultType: dto.vaultType,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        version: { increment: 1 },
      },
    });

    return { blobId: uploadResult.blobId, url: uploadResult.url };
  }

  async getSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const secret = await this.prisma.vaultSecret.findUnique({
      where: {
        workspaceId_profileId_key: { workspaceId, profileId, key },
      },
    });

    if (!secret) return null;

    const aggregatorUrl = this.configService.get(
      'WALRUS_AGGREGATOR_URL',
      'https://aggregator.walrus-testnet.walrus.space',
    );

    return {
      blobId: secret.walrusBlobId,
      downloadUrl: `${aggregatorUrl}/v1/${secret.walrusBlobId}`,
      version: secret.version,
      vaultType: secret.vaultType,
      fileName: secret.fileName,
      mimeType: secret.mimeType,
      fileSize: secret.fileSize,
    };
  }

  async listSecrets(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const secrets = await this.prisma.vaultSecret.findMany({
      where: { workspaceId, profileId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      secrets: secrets.map((s) => ({
        key: s.key,
        blobId: s.walrusBlobId,
        version: s.version,
        vaultType: s.vaultType,
        fileName: s.fileName,
        mimeType: s.mimeType,
        fileSize: s.fileSize,
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
    dto: UpdateSecretInput,
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const uploadResult = await this.walrusClient.uploadBlob(
      Buffer.from(dto.encryptedData, 'base64'),
    );

    const updated = await this.prisma.vaultSecret.updateMany({
      where: { workspaceId, profileId, key, version: dto.expectedVersion },
      data: {
        walrusBlobId: uploadResult.blobId,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new Error('Version mismatch or secret not found');
    }

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
  ) {
    await this.verifyAccess(workspaceId, callerAddress);

    const deleted = await this.prisma.vaultSecret.deleteMany({
      where: { workspaceId, profileId, key, version: expectedVersion },
    });

    if (deleted.count === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    return { success: true };
  }

  private async verifyAccess(
    workspaceId: string,
    callerAddress: string,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_address: { workspaceId, address: callerAddress } },
    });

    if (!member || (member.permissions & 16) === 0) {
      throw new UnauthorizedException('No access to this vault');
    }
  }
}
