import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SuiClientService } from '../blockchain/sui.client';
import { TxBuilderService } from '../blockchain/tx-builder.service';
import { EvmResolverService } from '../blockchain/evm-resolver.service';
import { SolanaResolverService } from '../blockchain/solana-resolver.service';
import { SuinsService } from '../blockchain/suins.service';
import { BalanceAggregatorService } from '../blockchain/balance-aggregator.service';
import { DefiPositionService } from '../blockchain/defi-position.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalletDto } from './dto/wallet.dto';

export interface NftTrait {
  name: string;
  value: string;
}

export interface NftWithTraits {
  objectId: string;
  type: string;
  collection: string;
  name: string;
  imageUrl: string | null;
  traits: NftTrait[];
  rarityScore: number | null;
}

/** Convert ipfs:// URLs to an HTTPS gateway URL for browser display. */
function normalizeIpfsUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return url;
}

export interface CreateProfileDto {
  primaryAddress: string;
  suinsName?: string;
  tags?: string[];
}

export interface UpdateProfileDto {
  suinsName?: string;
  tags?: string[];
  expectedVersion: number;
}

@Injectable()
export class ProfileService {
  private grpcClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly suiClient: SuiClientService,
    private readonly txBuilder: TxBuilderService,
    private readonly configService: ConfigService,
    private readonly evmResolver: EvmResolverService,
    private readonly solanaResolver: SolanaResolverService,
    private readonly balanceAggregator: BalanceAggregatorService,
    private readonly defiPositionService: DefiPositionService,
    private readonly suinsService: SuinsService,
  ) {
    // TODO: Load actual proto service definition
    this.grpcClient = {
      getProfile: () => Promise.resolve({}),
      listProfiles: () => Promise.resolve({}),
    };
  }

  async create(
    workspaceId: string,
    callerAddress: string,
    dto: CreateProfileDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    // Build and execute Sui transaction
    const tx = this.txBuilder.buildCreateProfileTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      dto.primaryAddress,
      dto.suinsName || null,
      dto.tags || [],
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Parse profile_id from events
    const profileCreatedEvent = result.events?.find((e: any) =>
      e.type.includes('::profile::ProfileCreated'),
    );

    const profileId =
      (profileCreatedEvent?.parsedJson as any)?.profile_id ?? randomUUID();

    // Write to Prisma for indexing
    await this.prisma.profile.create({
      data: {
        id: profileId,
        workspaceId,
        primaryAddress: dto.primaryAddress,
        suinsName: dto.suinsName || null,
        tags: dto.tags || [],
        tier: 0,
        engagementScore: 0,
        version: 1,
      },
    });

    // Best-effort avatar resolution (non-blocking)
    if (dto.suinsName) {
      this.resolveAndUpdateAvatar(profileId).catch(() => {});
    }

    return {
      profileId,
      txDigest: result.digest,
    };
  }

  async getProfile(workspaceId: string, profileId: string): Promise<any> {
    return this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
    });
  }

  async listProfiles(
    workspaceId: string,
    limit: number,
    offset: number,
    search?: string,
  ): Promise<any> {
    const where: any = { workspaceId, isArchived: false };
    if (search) {
      where.OR = [
        { primaryAddress: { contains: search, mode: 'insensitive' } },
        { suinsName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.profile.count({ where }),
    ]);

    return { profiles, total };
  }

  async getProfileOrganizations(
    workspaceId: string,
    profileId: string,
  ): Promise<any> {
    const links = await this.prisma.profileOrganization.findMany({
      where: { profileId, profile: { workspaceId } },
      include: { organization: true },
    });
    return links.map((l) => l.organization);
  }

  async updateTags(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    // Build Sui transaction
    const tx = this.txBuilder.buildUpdateProfileTagsTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      profileId,
      dto.tags || [],
      dto.expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Update Prisma
    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        tags: dto.tags,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  async getAssets(workspaceId: string, profileId: string) {
    // Verify profile belongs to caller's workspace
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });

    const [rows, nftGallery] = await Promise.all([
      this.prisma.$queryRaw<
        {
          collection: string | null;
          event_type: string;
          cnt: bigint;
          total_amount: number | null;
        }[]
      >`
        SELECT
          collection,
          event_type,
          COUNT(*) AS cnt,
          SUM(amount)::float AS total_amount
        FROM wallet_events
        WHERE profile_id = ${profileId}
        GROUP BY collection, event_type
        ORDER BY cnt DESC
      `,
      this.fetchNftGallery(profileId),
    ]);

    const nftTypes = ['MintNFTEvent', 'TransferObject'];
    const defiTypes = [
      'SwapEvent',
      'AddLiquidityEvent',
      'StakeEvent',
      'UnstakeEvent',
    ];

    return {
      nfts: rows
        .filter((r) => nftTypes.includes(r.event_type))
        .map((r) => ({
          collection: r.collection ?? 'Unknown',
          count: Number(r.cnt),
          eventType: r.event_type,
        })),
      nftGallery,
      defi: rows
        .filter((r) => defiTypes.includes(r.event_type))
        .map((r) => ({
          type: r.event_type,
          count: Number(r.cnt),
          totalAmount: r.total_amount ?? 0,
        })),
      governance: rows
        .filter((r) => ['VoteEvent', 'DelegateEvent'].includes(r.event_type))
        .map((r) => ({
          type: r.event_type,
          count: Number(r.cnt),
        })),
    };
  }

  /** Fetch on-chain NFT objects with Display metadata for all Sui wallets of a profile. */
  private async fetchNftGallery(profileId: string) {
    const suiWallets = await this.prisma.profileWallet.findMany({
      where: { profileId, chain: 'sui' },
      select: { address: true },
    });
    if (suiWallets.length === 0) return [];

    const allNfts: {
      objectId: string;
      type: string;
      name: string | null;
      description: string | null;
      imageUrl: string | null;
      ownerAddress: string;
    }[] = [];

    for (const wallet of suiWallets) {
      try {
        const response = await this.suiClient.getOwnedObjects(wallet.address, {
          showContent: true,
          showDisplay: true,
          showType: true,
          limit: 50,
        });

        for (const item of response.data) {
          const obj = item.data;
          if (!obj) continue;

          // Only include objects that have Display metadata (i.e. NFTs)
          const display = (obj as any).display?.data;
          if (!display) continue;

          allNfts.push({
            objectId: obj.objectId,
            type: obj.type ?? 'unknown',
            name: display.name ?? null,
            description: display.description ?? null,
            imageUrl: normalizeIpfsUrl(display.image_url) ?? null,
            ownerAddress: wallet.address,
          });
        }
      } catch {
        // Skip wallet on RPC failure — partial results are acceptable
      }
    }

    return allNfts;
  }

  async getTimeline(
    workspaceId: string,
    profileId: string,
    limit = 20,
    offset = 0,
  ) {
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });
    const [events, total] = await Promise.all([
      this.prisma.walletEvent.findMany({
        where: { profileId },
        orderBy: { time: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.walletEvent.count({ where: { profileId } }),
    ]);

    return { events, total };
  }

  async archive(
    workspaceId: string,
    callerAddress: string,
    profileId: string,
    expectedVersion: number,
  ): Promise<any> {
    const globalConfigId = this.configService.get<string>('GLOBAL_CONFIG_ID')!;
    const adminCapId = this.configService.get<string>('ADMIN_CAP_ID')!;

    const tx = this.txBuilder.buildArchiveProfileTx(
      globalConfigId,
      workspaceId,
      adminCapId,
      profileId,
      expectedVersion,
    );

    const result = await this.suiClient.executeTransaction(tx);

    // Mark as archived in Prisma
    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        isArchived: true,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      txDigest: result.digest,
    };
  }

  // ── Wallet CRUD ──────────────────────────────────────────────

  async addWallet(
    workspaceId: string,
    profileId: string,
    dto: CreateWalletDto,
  ) {
    // Verify profile exists and belongs to workspace
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
    });

    // Auto-resolve ENS/SNS names
    let ensName = dto.ensName ?? null;
    let snsName = dto.snsName ?? null;

    if (dto.chain === 'evm' && !ensName) {
      ensName = await this.evmResolver.lookupAddress(dto.address);
    }
    if (dto.chain === 'solana' && !snsName) {
      snsName = await this.solanaResolver.lookupAddress(dto.address);
    }

    const wallet = await this.prisma.profileWallet.create({
      data: {
        profileId,
        chain: dto.chain,
        address: dto.address,
        ensName,
        snsName,
      },
    });

    // Best-effort avatar resolution when adding EVM wallet with ENS name
    if (dto.chain === 'evm' && ensName) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: profileId },
        select: { avatarUrl: true },
      });
      if (!profile?.avatarUrl) {
        this.resolveAndUpdateAvatar(profileId).catch(() => {});
      }
    }

    return wallet;
  }

  async listWallets(workspaceId: string, profileId: string) {
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });
    return this.prisma.profileWallet.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeWallet(workspaceId: string, profileId: string, walletId: string) {
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });
    const wallet = await this.prisma.profileWallet.findFirst({
      where: { id: walletId, profileId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    await this.prisma.profileWallet.delete({ where: { id: walletId } });
    return { success: true };
  }

  async resolveAndUpdateAvatar(profileId: string): Promise<string | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { wallets: true },
    });
    if (!profile) return null;

    let avatarUrl: string | null = null;

    // Try SuiNS first
    if (profile.suinsName) {
      avatarUrl = await this.suinsService.resolveAvatar(profile.suinsName);
    }

    // Fallback to ENS from linked EVM wallets
    if (!avatarUrl) {
      const evmWallet = profile.wallets.find(
        (w) => w.chain === 'evm' && w.ensName,
      );
      if (evmWallet?.ensName) {
        avatarUrl = await this.evmResolver.resolveAvatar(evmWallet.ensName);
      }
    }

    if (avatarUrl) {
      await this.prisma.profile.update({
        where: { id: profileId },
        data: { avatarUrl },
      });
    }

    return avatarUrl;
  }

  // ── NFT Trait Analysis & Rarity ─────────────────────────────

  async fetchNftWithTraits(workspaceId: string, profileId: string) {
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });

    const suiWallets = await this.prisma.profileWallet.findMany({
      where: { profileId, chain: 'sui' },
      select: { address: true },
    });
    if (suiWallets.length === 0) return [];

    const allNfts: NftWithTraits[] = [];
    const skipFields = new Set([
      'id',
      'name',
      'description',
      'url',
      'image_url',
      'img_url',
    ]);

    for (const wallet of suiWallets) {
      try {
        const response = await this.suiClient.getOwnedObjects(wallet.address, {
          showContent: true,
          showDisplay: true,
          showType: true,
          limit: 50,
        });

        for (const item of response.data) {
          const obj = item.data;
          if (!obj?.content || (obj.content as any).dataType !== 'moveObject')
            continue;

          const fields = (obj.content as any).fields ?? {};
          const display = (obj as any).display?.data ?? {};
          const type = (obj.content as any).type ?? obj.type ?? '';

          // Extract collection from type (e.g. "0xabc::my_nft::MyNFT" -> "my_nft::MyNFT")
          const typeParts = type.split('::');
          const collection =
            typeParts.length >= 3
              ? `${typeParts[typeParts.length - 2]}::${typeParts[typeParts.length - 1]}`
              : type;

          // Extract traits from fields (skip id, name, description, url fields)
          const traits: NftTrait[] = [];
          for (const [key, value] of Object.entries(fields)) {
            if (skipFields.has(key)) continue;
            if (typeof value === 'object' && value !== null) continue;
            traits.push({ name: key, value: String(value) });
          }

          allNfts.push({
            objectId: obj.objectId,
            type,
            collection,
            name: display.name ?? fields.name ?? 'Unnamed',
            imageUrl:
              normalizeIpfsUrl(display.image_url ?? fields.image_url) ?? null,
            traits,
            rarityScore: null,
          });
        }
      } catch {
        // Skip wallet on RPC failure
      }
    }

    // Compute rarity scores per collection
    const byCollection = new Map<string, NftWithTraits[]>();
    for (const nft of allNfts) {
      const list = byCollection.get(nft.collection) ?? [];
      list.push(nft);
      byCollection.set(nft.collection, list);
    }

    for (const [, nfts] of byCollection) {
      if (nfts.length < 2) continue;

      // Count trait value frequencies
      const traitFreq = new Map<string, number>();
      for (const nft of nfts) {
        for (const t of nft.traits) {
          const key = `${t.name}:${t.value}`;
          traitFreq.set(key, (traitFreq.get(key) ?? 0) + 1);
        }
      }

      // Compute rarity score per NFT (0-100, higher = rarer)
      for (const nft of nfts) {
        if (nft.traits.length === 0) continue;
        let totalRarity = 0;
        for (const t of nft.traits) {
          const freq = traitFreq.get(`${t.name}:${t.value}`) ?? 1;
          totalRarity += 1 / (freq / nfts.length);
        }
        nft.rarityScore = Math.min(
          100,
          Math.round((totalRarity / nft.traits.length) * 10),
        );
      }
    }

    return allNfts;
  }

  async getNetWorth(workspaceId: string, profileId: string) {
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });
    return this.balanceAggregator.getNetWorth(profileId);
  }

  // ── DeFi Position Tracking ─────────────────────────────────

  async getDefiPositions(workspaceId: string, profileId: string) {
    await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
      select: { id: true },
    });

    const wallets = await this.prisma.profileWallet.findMany({
      where: { profileId, chain: 'sui' },
      select: { address: true },
    });

    if (wallets.length === 0) {
      return { totalStakedSui: '0', stakes: [], lpPositions: [] };
    }

    const allPositions = await Promise.all(
      wallets.map((w) => this.defiPositionService.getPositions(w.address)),
    );

    return {
      totalStakedSui: allPositions
        .reduce((sum, p) => sum + BigInt(p.totalStakedSui), 0n)
        .toString(),
      stakes: allPositions.flatMap((p) => p.stakes),
      lpPositions: allPositions.flatMap((p) => p.lpPositions),
    };
  }

  // ── Primary Domain ─────────────────────────────────────────

  async getAvailableDomains(
    profileId: string,
  ): Promise<{ domain: string; chain: string; source: string }[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { wallets: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const domains: { domain: string; chain: string; source: string }[] = [];

    if (profile.suinsName) {
      domains.push({
        domain: profile.suinsName,
        chain: 'sui',
        source: 'suins',
      });
    }

    for (const w of profile.wallets) {
      if (w.ensName) {
        domains.push({ domain: w.ensName, chain: 'evm', source: 'ens' });
      }
      if (w.snsName) {
        domains.push({ domain: w.snsName, chain: 'solana', source: 'sns' });
      }
    }

    return domains;
  }

  async setPrimaryDomain(profileId: string, domain: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { wallets: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const validDomains = this.collectDomains(profile);
    if (!validDomains.includes(domain)) {
      throw new BadRequestException('Domain not associated with this profile');
    }

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { primaryDomain: domain },
    });
  }

  private collectDomains(profile: any): string[] {
    const domains: string[] = [];
    if (profile.suinsName) domains.push(profile.suinsName);
    for (const w of profile.wallets ?? []) {
      if (w.ensName) domains.push(w.ensName);
      if (w.snsName) domains.push(w.snsName);
    }
    return domains;
  }

  // ── Summary Aggregation ─────────────────────────────────────

  async getSummary(workspaceId: string, profileId: string) {
    const profile = await this.prisma.profile.findFirstOrThrow({
      where: { id: profileId, workspaceId },
    });

    const [
      wallets,
      netWorth,
      recentActivity,
      socialLinks,
      assetCount,
      organizationCount,
      messageCount,
    ] = await Promise.all([
      this.prisma.profileWallet.findMany({
        where: { profileId },
        orderBy: { createdAt: 'desc' },
      }),
      this.balanceAggregator.getNetWorth(profileId),
      this.prisma.walletEvent.findMany({
        where: { profileId },
        orderBy: { time: 'desc' },
        take: 5,
      }),
      this.prisma.socialLink.findMany({
        where: { profileId },
        orderBy: { linkedAt: 'desc' },
      }),
      this.prisma.walletEvent.count({ where: { profileId } }),
      this.prisma.profileOrganization.count({ where: { profileId } }),
      this.prisma.message.count({ where: { profileId } }),
    ]);

    return {
      profile,
      wallets,
      netWorth,
      recentActivity,
      socialLinks,
      stats: { assetCount, organizationCount, messageCount },
    };
  }
}
