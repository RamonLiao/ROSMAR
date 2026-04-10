// Mock ESM blockchain deps before any imports
jest.mock('@mysten/sui/transactions', () => ({ Transaction: jest.fn() }));
jest.mock('@mysten/sui/jsonRpc', () => ({ SuiJsonRpcClient: jest.fn() }));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VaultExpiryJob } from './vault-expiry.job';
import { PrismaService } from '../prisma/prisma.service';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { SuiClientService } from '../blockchain/sui.client';
import { NotificationService } from '../notification/notification.service';

describe('VaultExpiryJob', () => {
  let job: VaultExpiryJob;
  let prisma: { vaultSecret: { findMany: jest.Mock; delete: jest.Mock } };
  let txBuilder: { buildEnforceVaultExpiryTx: jest.Mock };
  let suiClient: { executeTransaction: jest.Mock };
  let notificationService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      vaultSecret: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'v1',
            suiObjectId: '0xabc',
            workspaceId: 'ws1',
            profileId: 'p1',
            key: 'secret-1',
          },
          {
            id: 'v2',
            suiObjectId: null,
            workspaceId: 'ws1',
            profileId: 'p2',
            key: 'secret-2',
          },
        ]),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    txBuilder = { buildEnforceVaultExpiryTx: jest.fn().mockReturnValue({}) };
    suiClient = {
      executeTransaction: jest.fn().mockResolvedValue({ digest: 'abc' }),
    };
    notificationService = { create: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        VaultExpiryJob,
        { provide: PrismaService, useValue: prisma },
        { provide: TxBuilderService, useValue: txBuilder },
        { provide: SuiClientService, useValue: suiClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'SUI_DRY_RUN') return 'false';
              return def;
            }),
          },
        },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    job = module.get(VaultExpiryJob);
  });

  it('should process expired secrets with on-chain call and notification', async () => {
    await job.process({} as any);

    // Should call on-chain for the one with suiObjectId
    expect(txBuilder.buildEnforceVaultExpiryTx).toHaveBeenCalledWith('0xabc');
    expect(suiClient.executeTransaction).toHaveBeenCalledTimes(1);

    // Should delete both
    expect(prisma.vaultSecret.delete).toHaveBeenCalledTimes(2);

    // Should notify both owners
    expect(notificationService.create).toHaveBeenCalledTimes(2);
  });

  it('should handle zero expired secrets gracefully', async () => {
    prisma.vaultSecret.findMany.mockResolvedValue([]);

    await expect(job.process({} as any)).resolves.not.toThrow();
    expect(prisma.vaultSecret.delete).not.toHaveBeenCalled();
  });

  it('should skip on-chain call in dry-run mode', async () => {
    const module = await Test.createTestingModule({
      providers: [
        VaultExpiryJob,
        { provide: PrismaService, useValue: prisma },
        { provide: TxBuilderService, useValue: txBuilder },
        { provide: SuiClientService, useValue: suiClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'SUI_DRY_RUN') return 'true';
              return def;
            }),
          },
        },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    const dryRunJob = module.get(VaultExpiryJob);
    await dryRunJob.process({} as any);

    expect(txBuilder.buildEnforceVaultExpiryTx).not.toHaveBeenCalled();
    expect(suiClient.executeTransaction).not.toHaveBeenCalled();
    // Should still delete and notify
    expect(prisma.vaultSecret.delete).toHaveBeenCalledTimes(2);
    expect(notificationService.create).toHaveBeenCalledTimes(2);
  });
});
