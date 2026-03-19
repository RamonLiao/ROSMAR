import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from '../vault/walrus.client';
import { VaultPolicyService } from '../vault/vault-policy.service';

export interface CustomPolicyConfig {
  ruleType: 0 | 1 | 2;
  allowedAddresses?: string[];
  minRoleLevel?: number;
}

export interface UploadDocumentDto {
  dealId: string;
  name: string;
  encryptedData: string; // base64-encoded
  sealPolicyId?: string; // if caller already has one
  customPolicy?: CustomPolicyConfig; // per-document policy override
  mimeType?: string;
  fileSize?: number;
}

@Injectable()
export class DealDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walrusClient: WalrusClient,
    private readonly policyService: VaultPolicyService,
  ) {}

  async uploadDocument(
    workspaceId: string,
    callerAddress: string,
    dto: UploadDocumentDto,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      include: {
        profile: { include: { wallets: true } },
        escrows: true,
      },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Deal not in your workspace');
    }

    // Determine Seal policy: explicit > custom per-doc > auto shared
    let sealPolicyId = dto.sealPolicyId;
    if (!sealPolicyId && dto.customPolicy) {
      // Create document-specific policy
      const result = await this.policyService.createPolicy(workspaceId, {
        name: `Doc: ${dto.name}`,
        ruleType: dto.customPolicy.ruleType,
        allowedAddresses: dto.customPolicy.allowedAddresses,
        minRoleLevel: dto.customPolicy.minRoleLevel,
      });
      sealPolicyId = result.policyId;
    } else if (!sealPolicyId) {
      // Fallback: shared deal policy (all participants)
      const addresses = new Set<string>();
      addresses.add(callerAddress);
      deal.profile?.wallets?.forEach((w: { address: string }) =>
        addresses.add(w.address),
      );
      deal.escrows?.forEach((e: { payer: string; payee: string }) => {
        addresses.add(e.payer);
        addresses.add(e.payee);
      });

      const result = await this.policyService.createPolicy(workspaceId, {
        name: `deal-doc-${dto.name}`,
        ruleType: 1, // address-list
        allowedAddresses: Array.from(addresses),
      });
      sealPolicyId = result.policyId;
    }

    const uploadResult = await this.walrusClient.uploadBlob(
      Buffer.from(dto.encryptedData, 'base64'),
    );

    return this.prisma.dealDocument.create({
      data: {
        dealId: dto.dealId,
        workspaceId,
        name: dto.name,
        walrusBlobId: uploadResult.blobId,
        sealPolicyId,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedBy: callerAddress,
      },
    });
  }

  async listDocuments(
    workspaceId: string,
    callerAddress: string,
    dealId: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal || deal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Deal not accessible');
    }

    return this.prisma.dealDocument.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocument(workspaceId: string, documentId: string) {
    const doc = await this.prisma.dealDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.workspaceId !== workspaceId) {
      throw new ForbiddenException('Document not accessible');
    }

    return doc;
  }

  async updateDocumentPolicy(
    workspaceId: string,
    callerAddress: string,
    documentId: string,
    policyConfig: CustomPolicyConfig,
  ): Promise<{ policyId: string }> {
    const doc = await this.prisma.dealDocument.findUnique({
      where: { id: documentId },
      include: { deal: true },
    });

    if (!doc || doc.workspaceId !== workspaceId) {
      throw new NotFoundException('Document not found');
    }

    // Only uploader or workspace admin can change policy
    if (doc.uploadedBy !== callerAddress) {
      throw new ForbiddenException(
        'Only the document uploader can change its policy',
      );
    }

    const result = await this.policyService.createPolicy(workspaceId, {
      name: `Doc: ${doc.name}`,
      ruleType: policyConfig.ruleType,
      allowedAddresses: policyConfig.allowedAddresses,
      minRoleLevel: policyConfig.minRoleLevel,
    });

    await this.prisma.dealDocument.update({
      where: { id: documentId },
      data: { sealPolicyId: result.policyId },
    });

    return { policyId: result.policyId };
  }

  async deleteDocument(
    workspaceId: string,
    documentId: string,
    expectedVersion: number,
  ) {
    const deleted = await this.prisma.dealDocument.deleteMany({
      where: { id: documentId, workspaceId, version: expectedVersion },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Document not found or version mismatch');
    }

    return { success: true };
  }
}
