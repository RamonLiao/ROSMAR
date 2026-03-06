// @ts-nocheck
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalrusClient } from './walrus.client';
import { Pool } from 'pg';

export interface StoreSecretDto {
  profileId: string;
  key: string;
  encryptedData: string; // base64-encoded encrypted blob
  sealPolicyId?: string; // Seal policy object ID for decryption
}

export interface UpdateSecretDto {
  encryptedData: string; // base64-encoded encrypted blob
  expectedVersion: number;
}

@Injectable()
export class VaultService {
  private pgPool: Pool;

  constructor(
    private readonly walrusClient: WalrusClient,
    private readonly configService: ConfigService,
  ) {
    this.pgPool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });
  }

  /**
   * Store encrypted blob to Walrus (BFF never sees plaintext)
   * Client must encrypt data before sending
   */
  async storeSecret(
    workspaceId: string,
    callerAddress: string,
    dto: StoreSecretDto,
  ): Promise<any> {
    await this.verifyAccess(workspaceId, callerAddress, dto.profileId);

    // Decode base64 → Buffer for Walrus upload
    const blobBuffer = Buffer.from(dto.encryptedData, 'base64');

    // Upload encrypted blob to Walrus
    const uploadResult = await this.walrusClient.uploadBlob(blobBuffer);

    // Store metadata in PostgreSQL (blob_id only, no plaintext)
    await this.pgPool.query(
      `INSERT INTO vault_secrets (
        workspace_id, profile_id, key, walrus_blob_id, seal_policy_id, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 1, now(), now())
      ON CONFLICT (workspace_id, profile_id, key)
      DO UPDATE SET walrus_blob_id = $4, seal_policy_id = $5, version = vault_secrets.version + 1, updated_at = now()`,
      [workspaceId, dto.profileId, dto.key, uploadResult.blobId, dto.sealPolicyId ?? null],
    );

    return {
      blobId: uploadResult.blobId,
      url: uploadResult.url,
    };
  }

  /**
   * Get encrypted blob URL from Walrus
   * Client must decrypt after download
   */
  async getSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
  ): Promise<any> {
    await this.verifyAccess(workspaceId, callerAddress, profileId);

    const result = await this.pgPool.query(
      `SELECT walrus_blob_id, seal_policy_id, version FROM vault_secrets
       WHERE workspace_id = $1 AND profile_id = $2 AND key = $3`,
      [workspaceId, profileId, key],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { walrus_blob_id, seal_policy_id, version } = result.rows[0];

    return {
      blobId: walrus_blob_id,
      downloadUrl: `${this.configService.get('WALRUS_AGGREGATOR_URL')}/v1/${walrus_blob_id}`,
      sealPolicyId: seal_policy_id,
      version,
    };
  }

  async listSecrets(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
  ): Promise<any> {
    await this.verifyAccess(workspaceId, callerAddress, profileId);

    const result = await this.pgPool.query(
      `SELECT key, walrus_blob_id, seal_policy_id, version, created_at, updated_at
       FROM vault_secrets
       WHERE workspace_id = $1 AND profile_id = $2
       ORDER BY created_at DESC`,
      [workspaceId, profileId],
    );

    return {
      secrets: result.rows.map((row) => ({
        key: row.key,
        blobId: row.walrus_blob_id,
        sealPolicyId: row.seal_policy_id,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
    await this.verifyAccess(workspaceId, callerAddress, profileId);

    // Decode base64 → Buffer and upload to Walrus
    const blobBuffer = Buffer.from(dto.encryptedData, 'base64');
    const uploadResult = await this.walrusClient.uploadBlob(blobBuffer);

    // Update metadata with optimistic locking
    const result = await this.pgPool.query(
      `UPDATE vault_secrets
       SET walrus_blob_id = $1, version = version + 1, updated_at = now()
       WHERE workspace_id = $2 AND profile_id = $3 AND key = $4 AND version = $5
       RETURNING version`,
      [uploadResult.blobId, workspaceId, profileId, key, dto.expectedVersion],
    );

    if (result.rows.length === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    return {
      blobId: uploadResult.blobId,
      url: uploadResult.url,
      version: result.rows[0].version,
    };
  }

  async deleteSecret(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    key: string,
    expectedVersion: number,
  ): Promise<any> {
    await this.verifyAccess(workspaceId, callerAddress, profileId);

    const result = await this.pgPool.query(
      `DELETE FROM vault_secrets
       WHERE workspace_id = $1 AND profile_id = $2 AND key = $3 AND version = $4
       RETURNING walrus_blob_id`,
      [workspaceId, profileId, key, expectedVersion],
    );

    if (result.rows.length === 0) {
      throw new Error('Version mismatch or secret not found');
    }

    return {
      success: true,
      deletedBlobId: result.rows[0].walrus_blob_id,
    };
  }

  private async verifyAccess(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
  ): Promise<void> {
    // TODO: Check if caller has MANAGE permission for this profile's vault
    // Query workspace membership and permissions
    const hasAccess = true; // Mock

    if (!hasAccess) {
      throw new UnauthorizedException('No access to this vault');
    }
  }
}
