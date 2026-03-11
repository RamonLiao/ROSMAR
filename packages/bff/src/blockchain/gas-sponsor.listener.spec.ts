import { Test } from '@nestjs/testing';
import { GasSponsorListener } from './gas-sponsor.listener';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// Mock SuiClientService to avoid @mysten/sui ESM issues
jest.mock('./sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockReturnValue({
      getBalance: jest.fn(),
    }),
  })),
}));

import { SuiClientService } from './sui.client';

// Mock EnokiSponsorService
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

  beforeEach(async () => {
    const mockGetBalance = jest.fn();
    suiClient = {
      getClient: jest.fn().mockReturnValue({
        getBalance: mockGetBalance,
      }),
    };
    prisma = {
      notification: { create: jest.fn() },
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
            get: (key: string, defaultVal?: string) => {
              const map: Record<string, string> = {
                GAS_SPONSOR_ENABLED: 'true',
                GAS_SPONSOR_THRESHOLD_MIST: '100000000',
              };
              return map[key] ?? defaultVal ?? '';
            },
          },
        },
      ],
    }).compile();

    listener = module.get(GasSponsorListener);
  });

  it('should flag low-balance wallet for sponsorship', async () => {
    // 0.05 SUI = 50_000_000 MIST, below threshold of 0.1 SUI = 100_000_000 MIST
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '50000000' });
    prisma.notification.create.mockResolvedValue({ id: 'n-1' });

    await listener.handleWalletConnected({
      event_id: 'evt-1',
      event_type: 'wallet_connected',
      address: '0xabc',
      profile_id: 'profile-1',
      data: { workspaceId: 'ws-1' },
      tx_digest: '0xtx1',
      timestamp: Date.now(),
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'gas_sponsor_activated',
        workspaceId: 'ws-1',
      }),
    });
  });

  it('should NOT flag wallet with sufficient balance', async () => {
    // 0.5 SUI = 500_000_000 MIST, above threshold
    suiClient.getClient().getBalance.mockResolvedValue({ totalBalance: '500000000' });

    await listener.handleWalletConnected({
      event_id: 'evt-2',
      event_type: 'wallet_connected',
      address: '0xdef',
      profile_id: 'profile-2',
      data: { workspaceId: 'ws-1' },
      tx_digest: '0xtx2',
      timestamp: Date.now(),
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('should NOT flag when gas sponsor is disabled', async () => {
    // Override the listener's enabled flag
    (listener as any).gasSponsorEnabled = false;

    await listener.handleWalletConnected({
      event_id: 'evt-3',
      event_type: 'wallet_connected',
      address: '0xghi',
      profile_id: 'profile-3',
      data: { workspaceId: 'ws-1' },
      tx_digest: '0xtx3',
      timestamp: Date.now(),
    });

    expect(suiClient.getClient().getBalance).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
