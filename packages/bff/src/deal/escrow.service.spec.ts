// Mock ESM blockchain deps before any imports
jest.mock('@mysten/sui/transactions', () => ({ Transaction: jest.fn() }));
jest.mock('@mysten/sui/jsonRpc', () => ({ SuiJsonRpcClient: jest.fn() }));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({ Ed25519Keypair: jest.fn() }));

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../prisma/prisma.service';
import { TxBuilderService } from '../blockchain/tx-builder.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      escrow: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      escrowArbitrator: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      vestingSchedule: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prisma },
        { provide: TxBuilderService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'SUI_DRY_RUN') return 'true';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(EscrowService);
  });

  // ── T9 Test 1: createEscrow — creates Escrow + arbitrators in transaction ──

  it('should create escrow with arbitrators in a transaction', async () => {
    const mockEscrow = { id: 'esc-1', state: 'CREATED', totalAmount: 1000 };
    prisma.escrow.create.mockResolvedValue(mockEscrow);
    prisma.escrowArbitrator.create.mockResolvedValue({});

    const result = await service.createEscrow('ws-1', 'deal-1', {
      payee: '0xpayee',
      totalAmount: 1000,
      arbitrators: ['0xarb1', '0xarb2'],
      arbiterThreshold: 1,
    });

    expect(result).toEqual(mockEscrow);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.escrow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        dealId: 'deal-1',
        payee: '0xpayee',
        totalAmount: 1000,
        tokenType: 'SUI',
        arbiterThreshold: 1,
      }),
    });
    expect(prisma.escrowArbitrator.create).toHaveBeenCalledTimes(2);
  });

  // ── T9 Test 2: fundEscrow — CREATED→FUNDED ──

  it('should fund escrow from CREATED to FUNDED', async () => {
    prisma.escrow.findUnique.mockResolvedValue({
      id: 'esc-1',
      state: 'CREATED',
    });
    prisma.escrow.update.mockResolvedValue({
      id: 'esc-1',
      state: 'FUNDED',
    });

    const result = await service.fundEscrow('esc-1', '0xwallet');

    expect(result.state).toBe('FUNDED');
    expect(prisma.escrow.update).toHaveBeenCalledWith({
      where: { id: 'esc-1' },
      data: { state: 'FUNDED', version: { increment: 1 } },
    });
  });

  // ── T9 Test 3: releasePartial — FUNDED→PARTIALLY_RELEASED ──

  it('should partially release from FUNDED state', async () => {
    prisma.escrow.findUnique.mockResolvedValue({
      id: 'esc-1',
      state: 'FUNDED',
      totalAmount: 1000,
      releasedAmount: 0,
    });
    prisma.escrow.update.mockResolvedValue({
      id: 'esc-1',
      state: 'PARTIALLY_RELEASED',
      releasedAmount: 500,
    });

    const result = await service.release('esc-1', 500);

    expect(result.state).toBe('PARTIALLY_RELEASED');
    expect(prisma.escrow.update).toHaveBeenCalledWith({
      where: { id: 'esc-1' },
      data: {
        releasedAmount: 500,
        state: 'PARTIALLY_RELEASED',
        version: { increment: 1 },
      },
    });
  });

  // ── T9 Test 4: releaseFull — sets COMPLETED when full amount released ──

  it('should complete escrow when full amount is released', async () => {
    prisma.escrow.findUnique.mockResolvedValue({
      id: 'esc-1',
      state: 'PARTIALLY_RELEASED',
      totalAmount: 1000,
      releasedAmount: 500,
    });
    prisma.escrow.update.mockResolvedValue({
      id: 'esc-1',
      state: 'COMPLETED',
      releasedAmount: 1000,
    });

    const result = await service.release('esc-1', 500);

    expect(result.state).toBe('COMPLETED');
    expect(prisma.escrow.update).toHaveBeenCalledWith({
      where: { id: 'esc-1' },
      data: {
        releasedAmount: 1000,
        state: 'COMPLETED',
        version: { increment: 1 },
      },
    });
  });

  // ── T9 Test 5: refund — eligible states → REFUNDED ──

  it('should refund escrow from FUNDED state', async () => {
    prisma.escrow.findUnique.mockResolvedValue({
      id: 'esc-1',
      state: 'FUNDED',
      totalAmount: 1000,
      releasedAmount: 0,
    });
    prisma.escrow.update.mockResolvedValue({
      id: 'esc-1',
      state: 'REFUNDED',
      refundedAmount: 1000,
    });

    const result = await service.refund('esc-1');

    expect(result.state).toBe('REFUNDED');
    expect(prisma.escrow.update).toHaveBeenCalledWith({
      where: { id: 'esc-1' },
      data: {
        refundedAmount: 1000,
        state: 'REFUNDED',
        version: { increment: 1 },
      },
    });
  });

  // ── T9 Test 6: getEscrowByDealId — returns with relations ──

  it('should get escrow by deal ID with relations', async () => {
    const mockEscrow = {
      id: 'esc-1',
      dealId: 'deal-1',
      vestingSchedule: null,
      arbitrators: [{ address: '0xarb1' }],
      saftTemplates: [],
    };
    prisma.escrow.findFirst.mockResolvedValue(mockEscrow);

    const result = await service.getEscrowByDealId('deal-1');

    expect(result).toEqual(mockEscrow);
    expect(prisma.escrow.findFirst).toHaveBeenCalledWith({
      where: { dealId: 'deal-1' },
      include: {
        vestingSchedule: true,
        arbitrators: true,
        saftTemplates: true,
      },
    });
  });

  // ── T9 Test 7: invalid threshold → BadRequestException ──

  it('should throw when threshold exceeds arbitrator count', async () => {
    await expect(
      service.createEscrow('ws-1', 'deal-1', {
        payee: '0xpayee',
        totalAmount: 1000,
        arbitrators: ['0xarb1'],
        arbiterThreshold: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── T9 Test 8: release in wrong state → BadRequestException ──

  it('should throw when releasing from CREATED state', async () => {
    prisma.escrow.findUnique.mockResolvedValue({
      id: 'esc-1',
      state: 'CREATED',
      totalAmount: 1000,
      releasedAmount: 0,
    });

    await expect(service.release('esc-1', 100)).rejects.toThrow(
      BadRequestException,
    );
  });
});
