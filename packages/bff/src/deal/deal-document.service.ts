import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from '../vault/walrus.client';

export interface UploadDocumentDto {
  dealId: string;
  name: string;
  encryptedData: string; // base64-encoded
  sealPolicyId?: string;
  mimeType?: string;
  fileSize?: number;
}

@Injectable()
export class DealDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walrusClient: WalrusClient,
  ) {}

  async uploadDocument(
    workspaceId: string,
    callerAddress: string,
    dto: UploadDocumentDto,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.workspaceId !== workspaceId) {
      throw new ForbiddenException('Deal not in your workspace');
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
        sealPolicyId: dto.sealPolicyId,
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
