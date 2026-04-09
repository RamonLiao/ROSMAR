import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from './sui.client';
import { Prisma } from '@prisma/client';
import Moralis from 'moralis';
import { KNOWN_DECIMALS } from './price-oracle.service';

interface BalanceRow {
  profileId: string;
  workspaceId: string;
  chain: string;
  address: string;
  assetType: string;
  contractAddress: string;
  collectionName: string | null;
  tokenSymbol: string | null;
  rawBalance: Prisma.Decimal;
  decimals: number;
}

@Injectable()
export class BalanceSyncService {
  private readonly logger = new Logger(BalanceSyncService.name);
  private readonly batchSize: number;
  private readonly batchDelayMs: number;
  private coinDecimalsCache = new Map<string, number | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly config: ConfigService,
  ) {
    this.batchSize = this.config.get<number>('BALANCE_SYNC_BATCH_SIZE', 50);
    this.batchDelayMs = this.config.get<number>(
      'BALANCE_SYNC_BATCH_DELAY_MS',
      1000,
    );
  }

  /** Sync all wallet balances for a workspace */
  async syncWorkspace(
    workspaceId: string,
  ): Promise<{ synced: number; errors: number }> {
    const wallets = await this.prisma.profileWallet.findMany({
      where: { profile: { workspaceId, isArchived: false } },
      include: { profile: { select: { id: true, workspaceId: true } } },
    });

    if (wallets.length === 0) {
      this.logger.debug(`No wallets to sync for workspace ${workspaceId}`);
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    for (let i = 0; i < wallets.length; i += this.batchSize) {
      const batch = wallets.slice(i, i + this.batchSize);

      const results = await Promise.allSettled(
        batch.map((w) =>
          this.syncWallet(
            w.profile.id,
            w.profile.workspaceId,
            w.chain,
            w.address,
          ),
        ),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') synced += r.value;
        else {
          errors++;
          this.logger.warn(`Wallet sync failed: ${r.reason}`);
        }
      }

      if (i + this.batchSize < wallets.length) {
        await this.delay(this.batchDelayMs);
      }
    }

    this.logger.log(
      `Workspace ${workspaceId}: synced ${synced} balances, ${errors} errors`,
    );
    return { synced, errors };
  }

  /** Sync a single wallet — returns number of balance rows upserted */
  private async syncWallet(
    profileId: string,
    workspaceId: string,
    chain: string,
    address: string,
  ): Promise<number> {
    const rows: BalanceRow[] = [];

    switch (chain) {
      case 'sui':
        rows.push(
          ...(await this.fetchSuiBalances(profileId, workspaceId, address)),
        );
        rows.push(
          ...(await this.fetchSuiNfts(profileId, workspaceId, address)),
        );
        break;
      case 'evm':
        rows.push(
          ...(await this.fetchEvmBalances(profileId, workspaceId, address)),
        );
        rows.push(
          ...(await this.fetchEvmNfts(profileId, workspaceId, address)),
        );
        break;
      case 'solana':
        rows.push(
          ...(await this.fetchSolanaBalances(profileId, workspaceId, address)),
        );
        rows.push(
          ...(await this.fetchSolanaNfts(profileId, workspaceId, address)),
        );
        break;
      default:
        this.logger.debug(`Skipping unsupported chain: ${chain}`);
        return 0;
    }

    if (rows.length === 0) return 0;

    // Upsert all balance rows in a transaction
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.walletBalance.upsert({
          where: {
            profileId_chain_address_contractAddress: {
              profileId: r.profileId,
              chain: r.chain,
              address: r.address,
              contractAddress: r.contractAddress,
            },
          },
          update: {
            rawBalance: r.rawBalance,
            decimals: r.decimals,
            collectionName: r.collectionName,
            tokenSymbol: r.tokenSymbol,
            lastSyncedAt: new Date(),
          },
          create: {
            ...r,
            lastSyncedAt: new Date(),
          },
        }),
      ),
    );

    return rows.length;
  }

  // ─── Coin Decimals ────────────────────────────────

  private async getCoinDecimals(coinType: string): Promise<number | null> {
    if (this.coinDecimalsCache.has(coinType)) {
      return this.coinDecimalsCache.get(coinType)!;
    }

    if (KNOWN_DECIMALS[coinType] !== undefined) {
      this.coinDecimalsCache.set(coinType, KNOWN_DECIMALS[coinType]);
      return KNOWN_DECIMALS[coinType];
    }

    try {
      const meta = await this.suiClient
        .getClient()
        .getCoinMetadata({ coinType });
      const decimals = meta?.decimals ?? null;
      this.coinDecimalsCache.set(coinType, decimals);
      return decimals;
    } catch (err) {
      this.logger.warn(`Failed to fetch CoinMetadata for ${coinType}: ${err}`);
      this.coinDecimalsCache.set(coinType, null);
      return null;
    }
  }

  // ─── SUI ──────────────────────────────────────────

  private async fetchSuiBalances(
    profileId: string,
    workspaceId: string,
    address: string,
  ): Promise<BalanceRow[]> {
    const client = this.suiClient.getClient();
    const balances = await client.getAllBalances({ owner: address });
    const rows: BalanceRow[] = [];

    for (const b of balances) {
      const coinType = b.coinType as string;
      const symbol = coinType.split('::').pop() || coinType;
      const decimals = await this.getCoinDecimals(coinType);

      if (decimals === null) {
        this.logger.debug(`Skipping ${coinType}: no decimals metadata`);
        continue;
      }

      rows.push({
        profileId,
        workspaceId,
        chain: 'sui',
        address,
        assetType: 'token' as const,
        contractAddress: coinType,
        collectionName: null,
        tokenSymbol: symbol,
        rawBalance: new Prisma.Decimal(b.totalBalance),
        decimals,
      });
    }

    return rows;
  }

  private async fetchSuiNfts(
    profileId: string,
    workspaceId: string,
    address: string,
  ): Promise<BalanceRow[]> {
    const rows: BalanceRow[] = [];
    let cursor: string | undefined;
    const collectionCounts = new Map<string, { name: string; count: number }>();

    do {
      const page = await this.suiClient.getOwnedObjects(address, {
        showType: true,
        showContent: true,
        limit: 50,
        cursor,
      });

      for (const obj of page.data) {
        if (!obj.data?.type) continue;
        const type = obj.data.type;
        if (type.startsWith('0x2::coin::Coin<')) continue;
        const match = type.match(/^(0x[a-f0-9]+::\w+::\w+)/);
        if (!match) continue;
        const collection = match[1];
        const name = collection.split('::').slice(1).join('::');
        const existing = collectionCounts.get(collection);
        collectionCounts.set(collection, {
          name: existing?.name ?? name,
          count: (existing?.count ?? 0) + 1,
        });
      }

      cursor = page.hasNextPage ? (page.nextCursor ?? undefined) : undefined;
    } while (cursor);

    for (const [contractAddress, { name, count }] of collectionCounts) {
      rows.push({
        profileId,
        workspaceId,
        chain: 'sui',
        address,
        assetType: 'nft',
        contractAddress,
        collectionName: name,
        tokenSymbol: null,
        rawBalance: new Prisma.Decimal(count),
        decimals: 0,
      });
    }

    return rows;
  }

  // ─── EVM ──────────────────────────────────────────

  private async fetchEvmBalances(
    profileId: string,
    workspaceId: string,
    address: string,
  ): Promise<BalanceRow[]> {
    try {
      const response = await Moralis.EvmApi.wallets.getWalletTokenBalancesPrice(
        {
          address,
          chain: '0x1',
        },
      );

      return response.result.map((t: any) => ({
        profileId,
        workspaceId,
        chain: 'evm',
        address,
        assetType: 'token' as const,
        contractAddress: t.tokenAddress ?? 'native',
        collectionName: null,
        tokenSymbol: t.symbol ?? 'Unknown',
        rawBalance: new Prisma.Decimal(t.balance ?? '0'),
        decimals: t.decimals ?? 18,
      }));
    } catch (err) {
      this.logger.warn(`EVM token fetch failed for ${address}: ${err}`);
      return [];
    }
  }

  private async fetchEvmNfts(
    profileId: string,
    workspaceId: string,
    address: string,
  ): Promise<BalanceRow[]> {
    try {
      const response = await Moralis.EvmApi.nft.getWalletNFTs({
        address,
        chain: '0x1',
      });

      const collections = new Map<string, { name: string; count: number }>();
      for (const nft of response.result) {
        const addr = (nft as any).tokenAddress ?? 'unknown';
        const name = (nft as any).name ?? addr;
        const existing = collections.get(addr);
        collections.set(addr, {
          name: existing?.name ?? name,
          count: (existing?.count ?? 0) + 1,
        });
      }

      return Array.from(collections.entries()).map(
        ([contractAddress, { name, count }]) => ({
          profileId,
          workspaceId,
          chain: 'evm',
          address,
          assetType: 'nft' as const,
          contractAddress,
          collectionName: name,
          tokenSymbol: null,
          rawBalance: new Prisma.Decimal(count),
          decimals: 0,
        }),
      );
    } catch (err) {
      this.logger.warn(`EVM NFT fetch failed for ${address}: ${err}`);
      return [];
    }
  }

  // ─── Solana ───────────────────────────────────────

  private async fetchSolanaBalances(
    profileId: string,
    workspaceId: string,
    address: string,
  ): Promise<BalanceRow[]> {
    try {
      const response = await Moralis.SolApi.account.getPortfolio({
        address,
        network: 'mainnet',
      });

      const rows: BalanceRow[] = [];

      const nativeSol = response?.result?.nativeBalance;
      if (nativeSol) {
        rows.push({
          profileId,
          workspaceId,
          chain: 'solana',
          address,
          assetType: 'token',
          contractAddress: 'native',
          collectionName: null,
          tokenSymbol: 'SOL',
          rawBalance: new Prisma.Decimal(nativeSol.lamports ?? '0'),
          decimals: 9,
        });
      }

      for (const t of response?.result?.tokens ?? []) {
        rows.push({
          profileId,
          workspaceId,
          chain: 'solana',
          address,
          assetType: 'token',
          contractAddress: (t as any).mint ?? 'unknown',
          collectionName: null,
          tokenSymbol: (t as any).symbol ?? 'Unknown',
          rawBalance: new Prisma.Decimal((t as any).amount ?? '0'),
          decimals: (t as any).decimals ?? 0,
        });
      }

      return rows;
    } catch (err) {
      this.logger.warn(`Solana balance fetch failed for ${address}: ${err}`);
      return [];
    }
  }

  private async fetchSolanaNfts(
    profileId: string,
    workspaceId: string,
    address: string,
  ): Promise<BalanceRow[]> {
    try {
      const response = await (Moralis.SolApi as any).nft?.getNFTs?.({
        address,
        network: 'mainnet',
      });

      if (!response?.result) return [];

      const collections = new Map<string, { name: string; count: number }>();
      for (const nft of response.result) {
        const mint = nft.mint ?? 'unknown';
        const name = nft.name ?? mint;
        const existing = collections.get(mint);
        collections.set(mint, {
          name: existing?.name ?? name,
          count: (existing?.count ?? 0) + 1,
        });
      }

      return Array.from(collections.entries()).map(
        ([contractAddress, { name, count }]) => ({
          profileId,
          workspaceId,
          chain: 'solana',
          address,
          assetType: 'nft' as const,
          contractAddress,
          collectionName: name,
          tokenSymbol: null,
          rawBalance: new Prisma.Decimal(count),
          decimals: 0,
        }),
      );
    } catch (err) {
      this.logger.warn(`Solana NFT fetch failed for ${address}: ${err}`);
      return [];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
