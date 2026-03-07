import { Test } from '@nestjs/testing';
import { DealDocumentService } from './deal-document.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from '../vault/walrus.client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('DealDocumentService', () => {
  let service: DealDocumentService;
  let prisma: any;
  let walrusClient: any;

  beforeEach(async () => {
    prisma = {
      deal: { findUnique: jest.fn() },
      dealDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ permissions: 31 }),
      },
    };
    walrusClient = {
      uploadBlob: jest
        .fn()
        .mockResolvedValue({ blobId: 'blob-1', url: 'https://...' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DealDocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalrusClient, useValue: walrusClient },
      ],
    }).compile();

    service = module.get(DealDocumentService);
  });

  it('should upload and create document', async () => {
    prisma.deal.findUnique.mockResolvedValue({ id: 'd1', workspaceId: 'ws1' });
    prisma.dealDocument.create.mockResolvedValue({ id: 'doc1' });

    const result = await service.uploadDocument('ws1', '0xcaller', {
      dealId: 'd1',
      name: 'contract.pdf',
      encryptedData: Buffer.from('test').toString('base64'),
      sealPolicyId: '0xpolicy',
      mimeType: 'application/pdf',
      fileSize: 1024,
    });

    expect(result.id).toBe('doc1');
    expect(walrusClient.uploadBlob).toHaveBeenCalled();
  });

  it('should list documents for deal', async () => {
    prisma.deal.findUnique.mockResolvedValue({ id: 'd1', workspaceId: 'ws1' });
    prisma.dealDocument.findMany.mockResolvedValue([
      { id: 'doc1', name: 'contract.pdf', createdAt: new Date() },
    ]);

    const docs = await service.listDocuments('ws1', '0xcaller', 'd1');
    expect(docs).toHaveLength(1);
  });

  it('should reject if deal not in workspace', async () => {
    prisma.deal.findUnique.mockResolvedValue({
      id: 'd1',
      workspaceId: 'other-ws',
    });

    await expect(
      service.uploadDocument('ws1', '0xcaller', {
        dealId: 'd1',
        name: 'test.pdf',
        encryptedData: 'data',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject if deal not found', async () => {
    prisma.deal.findUnique.mockResolvedValue(null);

    await expect(
      service.uploadDocument('ws1', '0xcaller', {
        dealId: 'd1',
        name: 'test.pdf',
        encryptedData: 'data',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should delete document with version check', async () => {
    prisma.dealDocument.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.deleteDocument('ws1', 'doc1', 1);
    expect(result.success).toBe(true);
  });

  it('should reject delete on version mismatch', async () => {
    prisma.dealDocument.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.deleteDocument('ws1', 'doc1', 99),
    ).rejects.toThrow(NotFoundException);
  });
});
