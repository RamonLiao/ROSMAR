/* eslint-disable @typescript-eslint/no-unused-vars */
jest.mock('@mysten/sui/verify', () => ({
  verifyPersonalMessageSignature: jest.fn(),
}));
jest.mock('@mysten/sui/transactions', () => ({}));
jest.mock('@mysten/sui/jsonRpc', () => ({}));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { WalletClusterService } from './wallet-cluster.service';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_ID = 'profile-1';
const PROFILE_ID_2 = 'profile-2';
const WORKSPACE_ID = 'ws-1';
const ADDRESS = '0xabc123';
const ADDRESS_2 = '0xdef456';

function freshMessage(profileId = PROFILE_ID): string {
  return `ROSMAR_CLAIM:${profileId}:${Date.now()}`;
}

function expiredMessage(profileId = PROFILE_ID): string {
  const sixMinAgo = Date.now() - 6 * 60 * 1000;
  return `ROSMAR_CLAIM:${profileId}:${sixMinAgo}`;
}

// ── Mock Prisma with $transaction ──────────────────────────

const mockProfileWallet = {
  findFirst: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  upsert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockDeal = { updateMany: jest.fn() };
const mockWalletEvent = { updateMany: jest.fn() };
const mockSegmentMembership = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockSocialLink = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockQuestCompletion = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockWorkflowExecution = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockWorkflowActionLog = { updateMany: jest.fn() };
const mockVaultSecret = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockMessage = { updateMany: jest.fn() };
const mockProfileOrganization = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};
const mockProfile = {
  findFirst: jest.fn(),
  update: jest.fn(),
};

const mockPrisma = {
  profileWallet: mockProfileWallet,
  deal: mockDeal,
  walletEvent: mockWalletEvent,
  segmentMembership: mockSegmentMembership,
  socialLink: mockSocialLink,
  questCompletion: mockQuestCompletion,
  workflowExecution: mockWorkflowExecution,
  workflowActionLog: mockWorkflowActionLog,
  vaultSecret: mockVaultSecret,
  message: mockMessage,
  profileOrganization: mockProfileOrganization,
  profile: mockProfile,
  // $transaction executes the callback with mockPrisma itself as tx
  $transaction: jest.fn((cb: (tx: any) => Promise<void>) => cb(mockPrisma)),
};

describe('WalletClusterService', () => {
  let service: WalletClusterService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset default return values for merge-related mocks
    mockDeal.updateMany.mockResolvedValue({ count: 0 });
    mockWalletEvent.updateMany.mockResolvedValue({ count: 0 });
    mockWorkflowActionLog.updateMany.mockResolvedValue({ count: 0 });
    mockMessage.updateMany.mockResolvedValue({ count: 0 });
    mockProfileWallet.findMany.mockResolvedValue([]);
    mockSegmentMembership.findMany.mockResolvedValue([]);
    mockSocialLink.findMany.mockResolvedValue([]);
    mockQuestCompletion.findMany.mockResolvedValue([]);
    mockWorkflowExecution.findMany.mockResolvedValue([]);
    mockVaultSecret.findMany.mockResolvedValue([]);
    mockProfileOrganization.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletClusterService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(WalletClusterService);

    // Mock verifySignature to return the expected address by default
    jest.spyOn(service, 'verifySignature').mockResolvedValue(ADDRESS);
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
    mockProfileWallet.findFirst.mockResolvedValue(null);
    mockProfileWallet.upsert.mockResolvedValue(wallet);

    const result = await service.claimAddress(
      WORKSPACE_ID,
      PROFILE_ID,
      ADDRESS,
      freshMessage(),
      'fake-sig',
    );

    expect(result).toEqual(wallet);
    expect(mockProfileWallet.upsert).toHaveBeenCalledWith(
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
    mockProfileWallet.findFirst.mockResolvedValue({
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
    jest.spyOn(service, 'verifySignature').mockResolvedValue('0xdifferent');

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
    mockProfileWallet.findMany.mockResolvedValue(wallets);

    const result = await service.getClusterForProfile(PROFILE_ID);

    expect(result).toEqual(wallets);
    expect(mockProfileWallet.findMany).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID, verified: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  // ── detectMergeCandidate ───────────────────────────────────

  describe('detectMergeCandidate', () => {
    it('should return null when profile has no wallets', async () => {
      mockProfileWallet.findMany.mockResolvedValueOnce([]); // myWallets query

      const result = await service.detectMergeCandidate(
        WORKSPACE_ID,
        PROFILE_ID,
      );
      expect(result).toBeNull();
    });

    it('should return null when no overlapping addresses exist', async () => {
      mockProfileWallet.findMany
        .mockResolvedValueOnce([{ address: ADDRESS }]) // myWallets
        .mockResolvedValueOnce([]); // overlapping

      const result = await service.detectMergeCandidate(
        WORKSPACE_ID,
        PROFILE_ID,
      );
      expect(result).toBeNull();
    });

    it('should detect duplicate address across profiles', async () => {
      mockProfileWallet.findMany
        .mockResolvedValueOnce([{ address: ADDRESS }, { address: ADDRESS_2 }]) // myWallets
        .mockResolvedValueOnce([{ profileId: PROFILE_ID_2, address: ADDRESS }]); // overlapping

      const result = await service.detectMergeCandidate(
        WORKSPACE_ID,
        PROFILE_ID,
      );

      expect(result).toEqual({
        profileId: PROFILE_ID_2,
        sharedAddresses: [ADDRESS],
      });
    });

    it('should return profile with most shared addresses', async () => {
      mockProfileWallet.findMany
        .mockResolvedValueOnce([{ address: ADDRESS }, { address: ADDRESS_2 }])
        .mockResolvedValueOnce([
          { profileId: PROFILE_ID_2, address: ADDRESS },
          { profileId: PROFILE_ID_2, address: ADDRESS_2 },
          { profileId: 'profile-3', address: ADDRESS },
        ]);

      const result = await service.detectMergeCandidate(
        WORKSPACE_ID,
        PROFILE_ID,
      );

      expect(result).toEqual({
        profileId: PROFILE_ID_2,
        sharedAddresses: [ADDRESS, ADDRESS_2],
      });
    });
  });

  // ── mergeProfiles ──────────────────────────────────────────

  describe('mergeProfiles', () => {
    const targetProfile = {
      id: PROFILE_ID,
      workspaceId: WORKSPACE_ID,
      isArchived: false,
    };
    const sourceProfile = {
      id: PROFILE_ID_2,
      workspaceId: WORKSPACE_ID,
      isArchived: false,
    };

    beforeEach(() => {
      mockProfile.findFirst
        .mockResolvedValueOnce(targetProfile)
        .mockResolvedValueOnce(sourceProfile);
      mockProfile.update.mockResolvedValue({
        ...sourceProfile,
        isArchived: true,
      });
    });

    it('should throw when merging profile into itself', async () => {
      await expect(
        service.mergeProfiles(WORKSPACE_ID, PROFILE_ID, PROFILE_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when target profile not found', async () => {
      mockProfile.findFirst.mockReset();
      mockProfile.findFirst
        .mockResolvedValueOnce(null) // target not found
        .mockResolvedValueOnce(sourceProfile);

      await expect(
        service.mergeProfiles(WORKSPACE_ID, PROFILE_ID, PROFILE_ID_2),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when source profile not found', async () => {
      mockProfile.findFirst.mockReset();
      mockProfile.findFirst
        .mockResolvedValueOnce(targetProfile)
        .mockResolvedValueOnce(null); // source not found

      await expect(
        service.mergeProfiles(WORKSPACE_ID, PROFILE_ID, PROFILE_ID_2),
      ).rejects.toThrow(NotFoundException);
    });

    it('should move all records to target and archive source', async () => {
      // Setup: source has 1 wallet, 2 deals, 1 message
      mockProfileWallet.findMany.mockResolvedValue([
        { id: 'sw1', profileId: PROFILE_ID_2, chain: 'sui', address: ADDRESS },
      ]);
      mockProfileWallet.findUnique.mockResolvedValue(null); // no duplicate
      mockProfileWallet.update.mockResolvedValue({});
      mockDeal.updateMany.mockResolvedValue({ count: 2 });
      mockWalletEvent.updateMany.mockResolvedValue({ count: 0 });
      mockWorkflowActionLog.updateMany.mockResolvedValue({ count: 0 });
      mockMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.mergeProfiles(
        WORKSPACE_ID,
        PROFILE_ID,
        PROFILE_ID_2,
      );

      expect(result.targetProfileId).toBe(PROFILE_ID);
      expect(result.sourceProfileId).toBe(PROFILE_ID_2);
      expect(result.movedRecords.deal).toBe(2);
      expect(result.movedRecords.message).toBe(1);
      expect(result.movedRecords.profileWallet).toBe(1);

      // Verify source was archived
      expect(mockProfile.update).toHaveBeenCalledWith({
        where: { id: PROFILE_ID_2 },
        data: { isArchived: true },
      });
    });

    it('should handle duplicate wallet by deleting source wallet', async () => {
      mockProfileWallet.findMany.mockResolvedValue([
        { id: 'sw1', profileId: PROFILE_ID_2, chain: 'sui', address: ADDRESS },
      ]);
      // Target already has this wallet
      mockProfileWallet.findUnique.mockResolvedValue({
        id: 'tw1',
        profileId: PROFILE_ID,
        chain: 'sui',
        address: ADDRESS,
      });

      const result = await service.mergeProfiles(
        WORKSPACE_ID,
        PROFILE_ID,
        PROFILE_ID_2,
      );

      expect(mockProfileWallet.delete).toHaveBeenCalledWith({
        where: { id: 'sw1' },
      });
    });

    it('should handle profileOrganization composite PK with upsert logic', async () => {
      mockProfileOrganization.findMany.mockResolvedValue([
        { profileId: PROFILE_ID_2, organizationId: 'org-1' },
      ]);
      // Target does NOT have this org
      mockProfileOrganization.findUnique.mockResolvedValue(null);
      mockProfileOrganization.create.mockResolvedValue({});
      mockProfileOrganization.delete.mockResolvedValue({});

      const result = await service.mergeProfiles(
        WORKSPACE_ID,
        PROFILE_ID,
        PROFILE_ID_2,
      );

      expect(mockProfileOrganization.create).toHaveBeenCalledWith({
        data: {
          profileId: PROFILE_ID,
          organizationId: 'org-1',
        },
      });
      expect(mockProfileOrganization.delete).toHaveBeenCalledWith({
        where: {
          profileId_organizationId: {
            profileId: PROFILE_ID_2,
            organizationId: 'org-1',
          },
        },
      });
      expect(result.movedRecords.profileOrganization).toBe(1);
    });

    it('should use $transaction for atomicity', async () => {
      await service.mergeProfiles(WORKSPACE_ID, PROFILE_ID, PROFILE_ID_2);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
