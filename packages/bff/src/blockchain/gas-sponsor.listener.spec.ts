import { Test } from '@nestjs/testing';
import { GasSponsorListener } from './gas-sponsor.listener';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

jest.mock('./sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockReturnValue({
      getBalance: jest.fn(),
    }),
  })),
}));

import { SuiClientService } from './sui.client';

jest.mock('./enoki-sponsor.service', () => ({
  EnokiSponsorService: jest.fn().mockImplementation(() => ({
    isEnabled: true,
  })),
}));

import { EnokiSponsorService } from './enoki-sponsor.service';

describe('GasSponsorListener', () => {
  let listener: GasSponsorListener;
  let suiClient: any;
  let prisma: any;

  const baseEvent = {
    event_id: 'evt-1',
    event_type: 'wallet_connected',
    address: '0xabc',
    profile_id: 'profile-1',
    data: { workspaceId: 'ws-1' },
    tx_digest: '0xtx1',
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    suiClient = {
      getClient: jest.fn().mockReturnValue({
        getBalance: jest.fn(),
      }),
    };
    prisma = {
      notification: { create: jest.fn().mockResolvedValue({ id: 'n-1' }) },
      workspaceGasConfig: { findUnique: jest.fn() },
      gasSponsorGrant: { count: jest.fn(), create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        GasSponsorListener,
        { provide: SuiClientService, useValue: suiClient },
        { provide: PrismaService, useValue: prisma },
        { provide: EnokiSponsorService, useValue: { isEnabled: true } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: any) => {
              const map: Record<string, string> = {
                GAS_SPONSOR_ENABLED: 'true',
                GAS_SPONSOR_THRESHOLD_MIST: '100000000',
                GAS_SPONSOR_MAX_PER_DAY: '5',
              };
              return map[key] ?? defaultVal ?? '';
            },
          },
        },
      ],
    }).compile();

    listener = module.get(GasSponsorListener);
  });

  it('should use workspace config when available', async () => {
    prisma.workspaceGasConfig.findUnique.mockResolvedValue({
      enabled: true,
      thresholdMist: BigInt(200000000),
      dailyLimit: 3,
    });
    prisma.gasSponsorGrant.count.mockResolvedValue(0);
    prisma.gasSponsorGrant.create.mockResolvedValue({ id: 'g-1' });
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '100000000' });

    await listener.handleWalletConnected(baseEvent);

    // 100M < 200M threshold from workspace config → should sponsor
    expect(prisma.gasSponsorGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        address: '0xabc',
        profileId: 'profile-1',
      }),
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'gas_sponsor_activated' }),
    });
  });

  it('should fall back to env vars when no workspace config', async () => {
    prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);
    prisma.gasSponsorGrant.count.mockResolvedValue(0);
    prisma.gasSponsorGrant.create.mockResolvedValue({ id: 'g-1' });
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '50000000' });

    await listener.handleWalletConnected(baseEvent);

    // 50M < 100M env-var threshold → should sponsor
    expect(prisma.gasSponsorGrant.create).toHaveBeenCalled();
  });

  it('should skip when workspace config has enabled=false', async () => {
    prisma.workspaceGasConfig.findUnique.mockResolvedValue({
      enabled: false,
      thresholdMist: BigInt(100000000),
      dailyLimit: 5,
    });
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '50000000' });

    await listener.handleWalletConnected(baseEvent);

    expect(prisma.gasSponsorGrant.create).not.toHaveBeenCalled();
  });

  it('should NOT flag wallet with sufficient balance', async () => {
    prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '500000000' });

    await listener.handleWalletConnected(baseEvent);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should NOT flag when global gas sponsor is disabled', async () => {
    (listener as any).gasSponsorEnabled = false;

    await listener.handleWalletConnected(baseEvent);

    expect(suiClient.getClient().getBalance).not.toHaveBeenCalled();
  });

  it('should enforce DB-based rate limit', async () => {
    prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);
    prisma.gasSponsorGrant.count.mockResolvedValue(5); // at limit
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '50000000' });

    await listener.handleWalletConnected(baseEvent);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'gas_sponsor_rate_limited' }),
    });
    expect(prisma.gasSponsorGrant.create).not.toHaveBeenCalled();
  });

  describe('monkey tests', () => {
    it('should handle zero-balance wallet', async () => {
      prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);
      prisma.gasSponsorGrant.count.mockResolvedValue(0);
      prisma.gasSponsorGrant.create.mockResolvedValue({ id: 'g-1' });
      suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '0' });

      await listener.handleWalletConnected(baseEvent);

      expect(prisma.gasSponsorGrant.create).toHaveBeenCalled();
    });

    it('should handle balance exactly at threshold', async () => {
      prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);
      suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '100000000' });

      await listener.handleWalletConnected(baseEvent);

      // balance >= threshold → should NOT sponsor
      expect(prisma.gasSponsorGrant.create).not.toHaveBeenCalled();
    });

    it('should handle missing workspaceId gracefully', async () => {
      await listener.handleWalletConnected({
        ...baseEvent,
        data: {},
      });

      expect(suiClient.getClient().getBalance).not.toHaveBeenCalled();
    });

    it('should handle SUI RPC error gracefully', async () => {
      prisma.workspaceGasConfig.findUnique.mockResolvedValue(null);
      suiClient.getClient().getBalance.mockRejectedValue(new Error('RPC timeout'));

      // Should not throw
      await listener.handleWalletConnected(baseEvent);

      expect(prisma.gasSponsorGrant.create).not.toHaveBeenCalled();
    });

    it('should handle dailyLimit of 0 (sponsorship effectively disabled)', async () => {
      prisma.workspaceGasConfig.findUnique.mockResolvedValue({
        enabled: true,
        thresholdMist: BigInt(100000000),
        dailyLimit: 0,
      });
      prisma.gasSponsorGrant.count.mockResolvedValue(0);
      suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '50000000' });

      await listener.handleWalletConnected(baseEvent);

      // 0 >= 0 → rate limited
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'gas_sponsor_rate_limited' }),
      });
    });
  });
});
