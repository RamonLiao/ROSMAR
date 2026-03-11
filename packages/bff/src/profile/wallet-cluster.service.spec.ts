/* eslint-disable @typescript-eslint/no-unused-vars */
jest.mock('@mysten/sui/verify', () => ({
  verifyPersonalMessageSignature: jest.fn(),
}));
jest.mock('@mysten/sui/transactions', () => ({}));
jest.mock('@mysten/sui/jsonRpc', () => ({}));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { WalletClusterService } from './wallet-cluster.service';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_ID = 'profile-1';
const WORKSPACE_ID = 'ws-1';
const ADDRESS = '0xabc123';

function freshMessage(profileId = PROFILE_ID): string {
  return `ROSMAR_CLAIM:${profileId}:${Date.now()}`;
}

function expiredMessage(profileId = PROFILE_ID): string {
  const sixMinAgo = Date.now() - 6 * 60 * 1000;
  return `ROSMAR_CLAIM:${profileId}:${sixMinAgo}`;
}

const mockPrisma = {
  profileWallet: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('WalletClusterService', () => {
  let service: WalletClusterService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletClusterService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(WalletClusterService);

    // Mock verifySignature to return the expected address by default
    jest
      .spyOn(service, 'verifySignature')
      .mockResolvedValue(ADDRESS);
  });

  // ── claimAddress ────────────────────────────────────────────

  it('should create a verified wallet on valid claim', async () => {
    const wallet = {
      id: 'w1',
      profileId: PROFILE_ID,
      chain: 'sui',
      address: ADDRESS,
      verified: true,
    };
    mockPrisma.profileWallet.findFirst.mockResolvedValue(null);
    mockPrisma.profileWallet.upsert.mockResolvedValue(wallet);

    const result = await service.claimAddress(
      WORKSPACE_ID,
      PROFILE_ID,
      ADDRESS,
      freshMessage(),
      'fake-sig',
    );

    expect(result).toEqual(wallet);
    expect(mockPrisma.profileWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { verified: true },
        create: expect.objectContaining({
          profileId: PROFILE_ID,
          chain: 'sui',
          address: ADDRESS,
          verified: true,
        }),
      }),
    );
  });

  it('should throw ConflictException when address belongs to another profile', async () => {
    mockPrisma.profileWallet.findFirst.mockResolvedValue({
      id: 'other',
      profileId: 'profile-2',
    });

    await expect(
      service.claimAddress(
        WORKSPACE_ID,
        PROFILE_ID,
        ADDRESS,
        freshMessage(),
        'fake-sig',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException on expired message', async () => {
    await expect(
      service.claimAddress(
        WORKSPACE_ID,
        PROFILE_ID,
        ADDRESS,
        expiredMessage(),
        'fake-sig',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on invalid message format', async () => {
    await expect(
      service.claimAddress(
        WORKSPACE_ID,
        PROFILE_ID,
        ADDRESS,
        'BAD_FORMAT',
        'fake-sig',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when signature address does not match', async () => {
    jest
      .spyOn(service, 'verifySignature')
      .mockResolvedValue('0xdifferent');

    await expect(
      service.claimAddress(
        WORKSPACE_ID,
        PROFILE_ID,
        ADDRESS,
        freshMessage(),
        'fake-sig',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ── getClusterForProfile ───────────────────────────────────

  it('should return only verified wallets', async () => {
    const wallets = [
      { id: 'w1', address: ADDRESS, verified: true },
      { id: 'w2', address: '0xdef', verified: true },
    ];
    mockPrisma.profileWallet.findMany.mockResolvedValue(wallets);

    const result = await service.getClusterForProfile(PROFILE_ID);

    expect(result).toEqual(wallets);
    expect(mockPrisma.profileWallet.findMany).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID, verified: true },
      orderBy: { createdAt: 'asc' },
    });
  });
});
