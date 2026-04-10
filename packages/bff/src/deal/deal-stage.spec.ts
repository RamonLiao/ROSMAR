// Mock ESM blockchain deps before any imports
jest.mock('@mysten/sui/transactions', () => ({ Transaction: jest.fn() }));
jest.mock('@mysten/sui/jsonRpc', () => ({ SuiJsonRpcClient: jest.fn() }));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DealService } from './deal.service';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { NotificationService } from '../notification/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('DealService — stage state machine (T11)', () => {
  let service: DealService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      deal: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({ success: true }),
      },
      auditLog: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        DealService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SuiClientService,
          useValue: { executeTransaction: jest.fn() },
        },
        {
          provide: TxBuilderService,
          useValue: { buildUpdateDealTx: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'SUI_DRY_RUN') return 'true';
              if (key === 'GLOBAL_CONFIG_ID') return 'cfg-1';
              if (key === 'ADMIN_CAP_ID') return 'cap-1';
              return def;
            }),
          },
        },
        {
          provide: NotificationService,
          useValue: { create: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(DealService);
  });

  const makeDeal = (stage: string) => ({
    id: 'd1',
    workspaceId: 'ws1',
    suiObjectId: '0xdeal',
    title: 'Test Deal',
    amountUsd: 1000,
    stage,
    version: 1,
  });

  // ── Valid transitions ──

  it('prospecting → qualification', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('prospecting'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'qualification', 1),
    ).resolves.toBeTruthy();
  });

  it('qualification → proposal', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('qualification'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'proposal', 1),
    ).resolves.toBeTruthy();
  });

  it('proposal → negotiation', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('proposal'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'negotiation', 1),
    ).resolves.toBeTruthy();
  });

  it('negotiation → closed_won', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('negotiation'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'closed_won', 1),
    ).resolves.toBeTruthy();
  });

  it('negotiation → closed_lost', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('negotiation'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'closed_lost', 1),
    ).resolves.toBeTruthy();
  });

  // ── Invalid transitions ──

  it('prospecting → closed_won should throw', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('prospecting'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'closed_won', 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('closed → anything should throw', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('closed'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'prospecting', 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('closed_won → closed_lost should throw', async () => {
    prisma.deal.findUniqueOrThrow.mockResolvedValue(makeDeal('closed_won'));
    await expect(
      service.updateStage('ws1', '0xcaller', 'd1', 'closed_lost', 1),
    ).rejects.toThrow(BadRequestException);
  });
});
