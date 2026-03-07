import { Test } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from './walrus.client';
import { ConfigService } from '@nestjs/config';

jest.mock('../blockchain/sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    getObject: jest.fn(),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SuiClientService } = require('../blockchain/sui.client');

describe('VaultService — Audit Log', () => {
  let service: VaultService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({
          roleLevel: 3,
          permissions: 31,
        }),
      },
      vaultSecret: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'secret-1',
          workspaceId: 'ws1',
          profileId: 'p1',
          key: 'api_key',
          walrusBlobId: 'blob-1',
          sealPolicyId: null,
          version: 1,
        }),
        upsert: jest.fn().mockResolvedValue({ id: 'secret-1' }),
      },
      vaultAccessLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log-1',
            actor: '0xcaller',
            action: 'read',
            createdAt: new Date(),
          },
          {
            id: 'log-2',
            actor: '0xcaller',
            action: 'create',
            createdAt: new Date(),
          },
        ]),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: prisma },
        { provide: SuiClientService, useValue: { getObject: jest.fn() } },
        { provide: WalrusClient, useValue: {} },
        { provide: ConfigService, useValue: { get: () => '' } },
      ],
    }).compile();

    service = module.get(VaultService);
  });

  it('should return audit logs for a secret', async () => {
    const result = await service.getAccessLog('ws1', 'p1', 'api_key');

    expect(result.logs).toHaveLength(2);
    expect(result.logs[0].action).toBe('read');
    expect(prisma.vaultAccessLog.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws1', secretId: 'secret-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('should return empty logs if secret not found', async () => {
    prisma.vaultSecret.findUnique.mockResolvedValue(null);

    const result = await service.getAccessLog('ws1', 'p1', 'nonexistent');
    expect(result.logs).toEqual([]);
  });

  it('should log access on getSecret', async () => {
    await service.getSecret('ws1', '0xcaller', 'p1', 'api_key');

    expect(prisma.vaultAccessLog.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws1',
        secretId: 'secret-1',
        actor: '0xcaller',
        action: 'read',
        metadata: undefined,
      },
    });
  });
});
