import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Mock SuiClientService to avoid ESM issues
jest.mock('./sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockReturnValue({
      getBalance: jest.fn(),
      getAllBalances: jest.fn(),
    }),
  })),
}));

import { SuiClientService } from './sui.client';

// Mock PrismaService to avoid @prisma/client ESM issues
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    profileWallet: { findMany: jest.fn() },
  })),
}));

import { PrismaService } from '../prisma/prisma.service';

// Mock moralis — __esModule: true ensures `import Moralis from 'moralis'` gets the default export
const mockMoralis = {
  start: jest.fn(),
  EvmApi: {
    wallets: {
      getWalletTokenBalancesPrice: jest.fn(),
    },
  },
  SolApi: {
    account: {
      getPortfolio: jest.fn(),
    },
  },
};
jest.mock('moralis', () => ({
  __esModule: true,
  default: mockMoralis,
}));

import { BalanceAggregatorService } from './balance-aggregator.service';
import { PriceOracleService } from './price-oracle.service';

describe('BalanceAggregatorService', () => {
  let service: BalanceAggregatorService;
  let prisma: any;
  let suiClient: any;

  beforeEach(async () => {
    // Don't clear all mocks — it resets Moralis mock implementations.
    // Instead, reset only what we need.

    const mockGetAllBalances = jest.fn();
    suiClient = {
      getClient: jest.fn().mockReturnValue({
        getBalance: jest.fn(),
        getAllBalances: mockGetAllBalances,
      }),
    };

    prisma = {
      profileWallet: {
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        BalanceAggregatorService,
        { provide: SuiClientService, useValue: suiClient },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: string) => {
              const map: Record<string, string> = {
                MORALIS_API_KEY: 'test-moralis-key',
              };
              return map[key] ?? defaultVal ?? '';
            },
          },
        },
        {
          provide: PriceOracleService,
          useValue: {
            getSuiUsdPrice: jest.fn().mockResolvedValue(0),
            getSolUsdPrice: jest.fn().mockResolvedValue(0),
            getTokenPrice: jest.fn().mockReturnValue(0),
          },
        },
      ],
    }).compile();

    service = module.get(BalanceAggregatorService);
  });

  describe('getSuiBalance', () => {
    it('should return SUI balance', async () => {
      suiClient
        .getClient()
        .getAllBalances.mockResolvedValue([
          { coinType: '0x2::sui::SUI', totalBalance: '2000000000' },
        ]);

      const result = await service.getSuiBalance('0xabc123');
      expect(result.chain).toBe('sui');
      expect(result.address).toBe('0xabc123');
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0]).toEqual(
        expect.objectContaining({
          symbol: 'SUI',
          balance: '2000000000',
        }),
      );
    });

    it('should handle empty balance', async () => {
      suiClient.getClient().getAllBalances.mockResolvedValue([]);
      const result = await service.getSuiBalance('0xempty');
      expect(result.tokens).toEqual([]);
      expect(result.balanceUsd).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      suiClient
        .getClient()
        .getAllBalances.mockRejectedValue(new Error('RPC error'));
      const result = await service.getSuiBalance('0xbad');
      expect(result.tokens).toEqual([]);
      expect(result.balanceUsd).toBe(0);
    });
  });

  describe('getEvmBalance', () => {
    it('should fetch EVM token balances via Moralis', async () => {
      mockMoralis.EvmApi.wallets.getWalletTokenBalancesPrice.mockResolvedValue({
        result: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '1000000000000000000',
            decimals: 18,
            usdPrice: 3500,
            usdValue: 3500,
            nativeToken: true,
          },
          {
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '1000000000',
            decimals: 6,
            usdPrice: 1,
            usdValue: 1000,
            nativeToken: false,
          },
        ],
      });

      const result = await service.getEvmBalance('0xevmaddr');
      expect(result.chain).toBe('evm:ETH');
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0]).toEqual(
        expect.objectContaining({ symbol: 'ETH', usdValue: 3500 }),
      );
      expect(result.tokens[1]).toEqual(
        expect.objectContaining({ symbol: 'USDC', usdValue: 1000 }),
      );
      expect(result.balanceUsd).toBe(4500);
    });

    it('should return empty tokens on Moralis error', async () => {
      mockMoralis.EvmApi.wallets.getWalletTokenBalancesPrice.mockRejectedValue(
        new Error('API error'),
      );
      const result = await service.getEvmBalance('0xbadaddr');
      expect(result.chain).toBe('evm:ETH');
      expect(result.tokens).toEqual([]);
      expect(result.balanceUsd).toBe(0);
    });
  });

  describe('getSolanaBalance', () => {
    it('should include SOL USD price in Solana balance', async () => {
      // Override getSolUsdPrice for this test
      const priceOracle = (service as any).priceOracle;
      priceOracle.getSolUsdPrice.mockResolvedValue(150);

      mockMoralis.SolApi.account.getPortfolio.mockResolvedValue({
        result: {
          nativeBalance: { lamports: '5000000000' }, // 5 SOL
          tokens: [
            {
              mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              symbol: 'USDC',
              name: 'USD Coin',
              amount: '1000000',
              decimals: 6,
            },
          ],
        },
      });

      const result = await service.getSolanaBalance('SoLaddr1');
      expect(result.chain).toBe('solana');
      expect(result.tokens).toHaveLength(2);

      // Native SOL token
      const sol = result.tokens[0];
      expect(sol.symbol).toBe('SOL');
      expect(sol.usdPrice).toBe(150);
      expect(sol.usdValue).toBe(750); // 5 SOL * $150

      // Non-SOL token should still have 0 price
      const usdc = result.tokens[1];
      expect(usdc.symbol).toBe('USDC');
      expect(usdc.usdPrice).toBe(0);
      expect(usdc.usdValue).toBe(0);

      expect(result.balanceUsd).toBe(750);
    });

    it('should handle Solana API error gracefully', async () => {
      mockMoralis.SolApi.account.getPortfolio.mockRejectedValue(
        new Error('Solana RPC error'),
      );
      const result = await service.getSolanaBalance('SoLbad');
      expect(result.tokens).toEqual([]);
      expect(result.balanceUsd).toBe(0);
    });
  });

  describe('getNetWorth', () => {
    it('should aggregate balances across all wallets for a profile', async () => {
      prisma.profileWallet.findMany.mockResolvedValue([
        { id: 'w1', profileId: 'p1', chain: 'sui', address: '0xsui1' },
        { id: 'w2', profileId: 'p1', chain: 'ETH', address: '0xevm1' },
      ]);

      suiClient
        .getClient()
        .getAllBalances.mockResolvedValue([
          { coinType: '0x2::sui::SUI', totalBalance: '1000000000' },
        ]);

      mockMoralis.EvmApi.wallets.getWalletTokenBalancesPrice.mockResolvedValue({
        result: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '500000000000000000',
            decimals: 18,
            usdPrice: 3500,
            usdValue: 1750,
            nativeToken: true,
          },
        ],
      });

      const result = await service.getNetWorth('p1');
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0].chain).toBe('sui');
      expect(result.breakdown[1].chain).toBe('evm:ETH');
      expect(result.totalUsd).toBe(1750); // SUI has 0 usdValue, EVM has 1750
    });

    it('should return zero for profile with no wallets', async () => {
      prisma.profileWallet.findMany.mockResolvedValue([]);
      const result = await service.getNetWorth('p-empty');
      expect(result.totalUsd).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it('should handle unknown chain gracefully', async () => {
      prisma.profileWallet.findMany.mockResolvedValue([
        { id: 'w1', profileId: 'p1', chain: 'bitcoin', address: 'bc1q...' },
      ]);
      const result = await service.getNetWorth('p1');
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].tokens).toEqual([]);
    });
  });
});
