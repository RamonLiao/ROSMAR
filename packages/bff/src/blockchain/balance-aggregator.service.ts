import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClientService } from './sui.client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceOracleService, KNOWN_DECIMALS } from './price-oracle.service';
import Moralis from 'moralis';

const EVM_CHAIN_MAP: Record<string, string> = {
  ETH: '0x1',
  POLYGON: '0x89',
  ARBITRUM: '0xa4b1',
  BASE: '0x2105',
};

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usdPrice: number;
  usdValue: number;
}

export interface ChainBalance {
  chain: string;
  address: string;
  balanceUsd: number;
  tokens: TokenBalance[];
}

export interface NetWorthResult {
  totalUsd: number;
  breakdown: ChainBalance[];
}

@Injectable()
export class BalanceAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(BalanceAggregatorService.name);
  private moralisInitialized = false;

  constructor(
    private readonly suiClient: SuiClientService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly priceOracle: PriceOracleService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('MORALIS_API_KEY');
    if (apiKey) {
      try {
        await Moralis.start({ apiKey });
        this.moralisInitialized = true;
      } catch (err) {
        this.logger.warn(`Moralis init failed: ${err}`);
      }
    }
  }

  /** Get all token balances for a SUI address */
  async getSuiBalance(address: string): Promise<ChainBalance> {
    try {
      const balances = await this.suiClient.getClient().getAllBalances({
        owner: address,
      });

      const tokens: TokenBalance[] = balances.map((b: any) => {
        const coinType = b.coinType as string;
        const symbol = coinType.split('::').pop() || coinType;
        const usdPrice = this.priceOracle.getTokenPrice(coinType) ?? 0;
        const decimals = KNOWN_DECIMALS[coinType] ?? 9;
        const usdValue =
          (parseFloat(b.totalBalance) / 10 ** decimals) * usdPrice;
        return {
          symbol,
          name: symbol,
          balance: b.totalBalance,
          decimals,
          usdPrice,
          usdValue,
        };
      });

      const balanceUsd = tokens.reduce((sum, t) => sum + t.usdValue, 0);

      return { chain: 'sui', address, balanceUsd, tokens };
    } catch (err) {
      this.logger.warn(`Failed to get SUI balance for ${address}: ${err}`);
      return { chain: 'sui', address, balanceUsd: 0, tokens: [] };
    }
  }

  /** Get all token balances for an EVM address via Moralis */
  async getEvmBalance(
    address: string,
    chain = 'ETH',
  ): Promise<ChainBalance> {
    const chainLabel = `evm:${chain}`;
    try {
      const response = await Moralis.EvmApi.wallets.getWalletTokenBalancesPrice(
        {
          address,
          chain: EVM_CHAIN_MAP[chain] ?? '0x1',
        },
      );

      const tokens: TokenBalance[] = response.result.map((t: any) => ({
        symbol: t.symbol,
        name: t.name,
        balance: t.balance,
        decimals: t.decimals,
        usdPrice: t.usdPrice ?? 0,
        usdValue: t.usdValue ?? 0,
      }));

      const balanceUsd = tokens.reduce((sum, t) => sum + t.usdValue, 0);

      return { chain: chainLabel, address, balanceUsd, tokens };
    } catch (err) {
      this.logger.warn(`Failed to get EVM balance for ${address}: ${err}`);
      return { chain: chainLabel, address, balanceUsd: 0, tokens: [] };
    }
  }

  /** Get all token balances for a Solana address via Moralis */
  async getSolanaBalance(address: string): Promise<ChainBalance> {
    try {
      const response = await Moralis.SolApi.account.getPortfolio({
        address,
        network: 'mainnet',
      });

      const solUsdPrice = await this.priceOracle.getSolUsdPrice();

      const tokens: TokenBalance[] = (response?.result?.tokens ?? []).map(
        (t: any) => {
          const isSol =
            t.mint === 'So11111111111111111111111111111111111111112';
          const usdPrice = isSol ? solUsdPrice : 0;
          const decimals = t.decimals ?? 0;
          const usdValue = isSol
            ? (parseFloat(t.amount ?? '0') / 10 ** decimals) * usdPrice
            : 0;
          return {
            symbol: t.symbol ?? 'Unknown',
            name: t.name ?? 'Unknown',
            balance: t.amount ?? '0',
            decimals,
            usdPrice,
            usdValue,
          };
        },
      );

      // Add native SOL
      const nativeSol = response?.result?.nativeBalance;
      if (nativeSol) {
        const lamports = nativeSol.lamports ?? '0';
        const usdValue = (parseFloat(lamports) / 1e9) * solUsdPrice;
        tokens.unshift({
          symbol: 'SOL',
          name: 'Solana',
          balance: lamports,
          decimals: 9,
          usdPrice: solUsdPrice,
          usdValue,
        });
      }

      const balanceUsd = tokens.reduce((sum, t) => sum + t.usdValue, 0);

      return { chain: 'solana', address, balanceUsd, tokens };
    } catch (err) {
      this.logger.warn(`Failed to get Solana balance for ${address}: ${err}`);
      return { chain: 'solana', address, balanceUsd: 0, tokens: [] };
    }
  }

  /** Aggregate net worth across all wallets linked to a profile */
  async getNetWorth(profileId: string): Promise<NetWorthResult> {
    const wallets = await this.prisma.profileWallet.findMany({
      where: { profileId },
    });

    if (wallets.length === 0) {
      return { totalUsd: 0, breakdown: [] };
    }

    const balancePromises = wallets.map((w) => {
      const chain = w.chain.toUpperCase();
      if (chain === 'SUI') return this.getSuiBalance(w.address);
      if (chain === 'SOLANA') return this.getSolanaBalance(w.address);
      if (EVM_CHAIN_MAP[chain])
        return this.getEvmBalance(w.address, chain);
      return Promise.resolve<ChainBalance>({
        chain: w.chain,
        address: w.address,
        balanceUsd: 0,
        tokens: [],
      });
    });

    const breakdown = await Promise.all(balancePromises);
    const totalUsd = breakdown.reduce((sum, b) => sum + b.balanceUsd, 0);

    return { totalUsd, breakdown };
  }
}
