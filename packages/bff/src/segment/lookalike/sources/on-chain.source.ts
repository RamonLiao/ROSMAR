import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CandidateSource } from '../interfaces';

@Injectable()
export class OnChainCandidateSource implements CandidateSource {
  readonly name = 'on-chain-discovery';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Discovers wallet addresses from on-chain transaction co-occurrence
   * that are NOT existing profiles in the workspace.
   *
   * Flow:
   * 1. Get seed profile addresses
   * 2. Find txDigests these addresses participated in
   * 3. Find other addresses in those same transactions
   * 4. Exclude addresses already belonging to workspace profiles
   * 5. Return discovered addresses as pseudo-profile IDs
   */
  async getCandidates(
    workspaceId: string,
    excludeIds: string[],
  ): Promise<string[]> {
    // 1. Get seed profile addresses
    const seedProfiles = await this.prisma.profile.findMany({
      where: { id: { in: excludeIds } },
      select: { primaryAddress: true },
    });
    const seedWallets = await this.prisma.profileWallet.findMany({
      where: { profileId: { in: excludeIds } },
      select: { address: true },
    });

    const seedAddresses = new Set([
      ...seedProfiles.map((p) => p.primaryAddress.toLowerCase()),
      ...seedWallets.map((w) => w.address.toLowerCase()),
    ]);

    if (seedAddresses.size === 0) return [];

    // 2. Find txDigests for seed addresses
    const seedEvents = await this.prisma.walletEvent.findMany({
      where: { address: { in: [...seedAddresses] } },
      select: { txDigest: true },
      distinct: ['txDigest'],
    });
    const txDigests = seedEvents.map((e) => e.txDigest);

    if (txDigests.length === 0) return [];

    // 3. Find other addresses in those transactions
    const coEvents = await this.prisma.walletEvent.findMany({
      where: {
        txDigest: { in: txDigests },
        address: { notIn: [...seedAddresses] },
      },
      select: { address: true },
      distinct: ['address'],
    });

    const discoveredAddresses = new Set(
      coEvents.map((e) => e.address.toLowerCase()),
    );

    if (discoveredAddresses.size === 0) return [];

    // 4. Exclude addresses belonging to existing workspace profiles
    const existingProfiles = await this.prisma.profile.findMany({
      where: {
        workspaceId,
        primaryAddress: { in: [...discoveredAddresses], mode: 'insensitive' },
        isArchived: false,
      },
      select: { primaryAddress: true },
    });
    const existingWallets = await this.prisma.profileWallet.findMany({
      where: {
        address: { in: [...discoveredAddresses], mode: 'insensitive' },
        profile: { workspaceId },
      },
      select: { address: true },
    });

    const knownAddresses = new Set([
      ...existingProfiles.map((p) => p.primaryAddress.toLowerCase()),
      ...existingWallets.map((w) => w.address.toLowerCase()),
    ]);

    // 5. Return discovered addresses (prefixed to distinguish from profile IDs)
    const result: string[] = [];
    for (const addr of discoveredAddresses) {
      if (!knownAddresses.has(addr)) {
        result.push(`discovered:${addr}`);
      }
    }

    return result;
  }
}
