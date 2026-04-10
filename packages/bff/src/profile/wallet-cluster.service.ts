import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProfileWallet } from '@prisma/client';

const MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MESSAGE_PREFIX = 'ROSMAR_CLAIM';

export interface MergeCandidate {
  profileId: string;
  sharedAddresses: string[];
}

export interface MergeResult {
  targetProfileId: string;
  sourceProfileId: string;
  movedRecords: Record<string, number>;
}

export interface FundingCluster {
  funderAddress: string;
  ownWallets: string[];
  relatedProfiles: {
    id: string;
    primaryAddress: string;
    suinsName: string | null;
  }[];
  confidence: number; // 0-1
}

@Injectable()
export class WalletClusterService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────

  async claimAddress(
    workspaceId: string,
    profileId: string,
    address: string,
    message: string,
    signature: string,
  ): Promise<ProfileWallet> {
    // 1. Parse & validate message freshness
    this.validateMessage(message, profileId);

    // 2. Verify signature ownership
    const recovered = await this.verifySignature(message, signature);
    if (recovered !== address) {
      throw new BadRequestException(
        'Signature does not match the claimed address',
      );
    }

    // 3. Check address not owned by another profile in same workspace
    const existing = await this.prisma.profileWallet.findFirst({
      where: {
        address,
        chain: 'sui',
        profile: { workspaceId },
        profileId: { not: profileId },
        verified: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        'Address already belongs to another profile in this workspace',
      );
    }

    // 4. Upsert wallet as verified
    return this.prisma.profileWallet.upsert({
      where: {
        profileId_chain_address: {
          profileId,
          chain: 'sui',
          address,
        },
      },
      update: { verified: true },
      create: {
        profileId,
        chain: 'sui',
        address,
        verified: true,
      },
    });
  }

  async getClusterForProfile(profileId: string): Promise<ProfileWallet[]> {
    return this.prisma.profileWallet.findMany({
      where: { profileId, verified: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Merge Detection ──────────────────────────────────────

  async detectMergeCandidate(
    workspaceId: string,
    profileId: string,
  ): Promise<MergeCandidate | null> {
    // Find all verified addresses for this profile
    const myWallets = await this.prisma.profileWallet.findMany({
      where: { profileId, verified: true },
      select: { address: true },
    });
    if (myWallets.length === 0) return null;

    const myAddresses = myWallets.map((w) => w.address);

    // Find verified wallets with same addresses belonging to OTHER profiles in same workspace
    const overlapping = await this.prisma.profileWallet.findMany({
      where: {
        address: { in: myAddresses },
        verified: true,
        profile: { workspaceId, isArchived: false },
        profileId: { not: profileId },
      },
      select: { profileId: true, address: true },
    });

    if (overlapping.length === 0) return null;

    // Group by profileId, return the one with most shared addresses
    const byProfile = new Map<string, string[]>();
    for (const row of overlapping) {
      const arr = byProfile.get(row.profileId) ?? [];
      arr.push(row.address);
      byProfile.set(row.profileId, arr);
    }

    let bestId = '';
    let bestAddrs: string[] = [];
    for (const [pid, addrs] of byProfile) {
      if (addrs.length > bestAddrs.length) {
        bestId = pid;
        bestAddrs = addrs;
      }
    }

    return { profileId: bestId, sharedAddresses: bestAddrs };
  }

  // ── Funding Pattern Analysis ─────────────────────────────

  /**
   * Analyze on-chain funding patterns to detect wallets likely owned by the same entity.
   * Looks for: same funder address sending initial funds to multiple profile wallets.
   */
  async detectFundingPatterns(
    workspaceId: string,
    profileId: string,
  ): Promise<FundingCluster[]> {
    const wallets = await this.prisma.profileWallet.findMany({
      where: { profileId, chain: 'sui' },
    });

    if (wallets.length === 0) return [];

    // For each wallet, find the earliest funding transaction (first inbound transfer)
    const fundingSources: {
      address: string;
      funder: string;
      amount: string;
      time: Date;
    }[] = [];

    for (const wallet of wallets) {
      const firstFunding = await this.prisma.walletEvent.findFirst({
        where: {
          address: wallet.address,
          eventType: { in: ['TransferObject', 'transfer', 'coin_transfer'] },
        },
        orderBy: { time: 'asc' },
      });

      if (firstFunding?.rawData) {
        const raw = firstFunding.rawData as Record<string, unknown>;
        const sender = (raw.sender ?? raw.from ?? raw.source) as
          | string
          | undefined;
        if (sender && sender !== wallet.address) {
          fundingSources.push({
            address: wallet.address,
            funder: sender,
            amount: firstFunding.amount?.toString() ?? '0',
            time: firstFunding.time,
          });
        }
      }
    }

    // Group wallets by funder address
    const byFunder = new Map<string, typeof fundingSources>();
    for (const fs of fundingSources) {
      const list = byFunder.get(fs.funder) ?? [];
      list.push(fs);
      byFunder.set(fs.funder, list);
    }

    // Find other profiles with wallets funded by the same source
    const clusters: FundingCluster[] = [];
    for (const [funder, funded] of byFunder) {
      if (funded.length < 1) continue;

      // Search for other wallets in workspace funded by this same source
      const relatedEvents = await this.prisma.walletEvent.findMany({
        where: {
          workspaceId,
          eventType: { in: ['TransferObject', 'transfer', 'coin_transfer'] },
          rawData: { path: ['sender'], equals: funder },
        },
        distinct: ['address'],
        take: 20,
      });

      const relatedAddresses = relatedEvents
        .map((e) => e.address)
        .filter((a) => !wallets.some((w) => w.address === a));

      if (relatedAddresses.length === 0) continue;

      // Find profiles owning those addresses
      const relatedWallets = await this.prisma.profileWallet.findMany({
        where: {
          address: { in: relatedAddresses },
          profile: { workspaceId },
        },
        include: {
          profile: {
            select: { id: true, primaryAddress: true, suinsName: true },
          },
        },
      });

      const relatedProfiles = [
        ...new Map(
          relatedWallets.map((w) => [w.profileId, w.profile]),
        ).values(),
      ];

      if (relatedProfiles.length > 0) {
        clusters.push({
          funderAddress: funder,
          ownWallets: funded.map((f) => f.address),
          relatedProfiles: relatedProfiles.map((p) => ({
            id: p.id,
            primaryAddress: p.primaryAddress,
            suinsName: p.suinsName,
          })),
          confidence: Math.min(0.9, 0.5 + relatedProfiles.length * 0.1),
        });
      }
    }

    return clusters;
  }

  // ── Profile Merge ────────────────────────────────────────

  async mergeProfiles(
    workspaceId: string,
    targetProfileId: string,
    sourceProfileId: string,
  ): Promise<MergeResult> {
    if (targetProfileId === sourceProfileId) {
      throw new BadRequestException('Cannot merge a profile into itself');
    }

    // Verify both profiles exist in workspace
    const [target, source] = await Promise.all([
      this.prisma.profile.findFirst({
        where: { id: targetProfileId, workspaceId, isArchived: false },
      }),
      this.prisma.profile.findFirst({
        where: { id: sourceProfileId, workspaceId, isArchived: false },
      }),
    ]);
    if (!target) throw new NotFoundException('Target profile not found');
    if (!source) throw new NotFoundException('Source profile not found');

    const moved: Record<string, number> = {};

    await this.prisma.$transaction(async (tx) => {
      // 1. profileWallet — re-assign, skip duplicates
      const sourceWallets = await tx.profileWallet.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const w of sourceWallets) {
        const exists = await tx.profileWallet.findUnique({
          where: {
            profileId_chain_address: {
              profileId: targetProfileId,
              chain: w.chain,
              address: w.address,
            },
          },
        });
        if (exists) {
          await tx.profileWallet.delete({ where: { id: w.id } });
        } else {
          await tx.profileWallet.update({
            where: { id: w.id },
            data: { profileId: targetProfileId },
          });
        }
      }
      moved.profileWallet = sourceWallets.length;

      // 2. deal
      const dealResult = await tx.deal.updateMany({
        where: { profileId: sourceProfileId },
        data: { profileId: targetProfileId },
      });
      moved.deal = dealResult.count;

      // 3. walletEvent (no FK, raw profileId field)
      const weResult = await tx.walletEvent.updateMany({
        where: { profileId: sourceProfileId },
        data: { profileId: targetProfileId },
      });
      moved.walletEvent = weResult.count;

      // 4. segmentMembership (composite PK: segmentId + profileId)
      const sourceMemberships = await tx.segmentMembership.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const m of sourceMemberships) {
        const exists = await tx.segmentMembership.findUnique({
          where: {
            segmentId_profileId: {
              segmentId: m.segmentId,
              profileId: targetProfileId,
            },
          },
        });
        if (exists) {
          await tx.segmentMembership.delete({
            where: {
              segmentId_profileId: {
                segmentId: m.segmentId,
                profileId: sourceProfileId,
              },
            },
          });
        } else {
          await tx.segmentMembership.update({
            where: {
              segmentId_profileId: {
                segmentId: m.segmentId,
                profileId: sourceProfileId,
              },
            },
            data: { profileId: targetProfileId },
          });
        }
      }
      moved.segmentMembership = sourceMemberships.length;

      // 5. socialLink (unique: profileId + platform)
      const sourceLinks = await tx.socialLink.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const sl of sourceLinks) {
        const exists = await tx.socialLink.findUnique({
          where: {
            profileId_platform: {
              profileId: targetProfileId,
              platform: sl.platform,
            },
          },
        });
        if (exists) {
          await tx.socialLink.delete({ where: { id: sl.id } });
        } else {
          await tx.socialLink.update({
            where: { id: sl.id },
            data: { profileId: targetProfileId },
          });
        }
      }
      moved.socialLink = sourceLinks.length;

      // 6. questCompletion (unique: questId + profileId)
      const sourceQuests = await tx.questCompletion.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const qc of sourceQuests) {
        const exists = await tx.questCompletion.findUnique({
          where: {
            questId_profileId: {
              questId: qc.questId,
              profileId: targetProfileId,
            },
          },
        });
        if (exists) {
          await tx.questCompletion.delete({ where: { id: qc.id } });
        } else {
          await tx.questCompletion.update({
            where: { id: qc.id },
            data: { profileId: targetProfileId },
          });
        }
      }
      moved.questCompletion = sourceQuests.length;

      // 7. workflowExecution (unique: campaignId + profileId)
      const sourceExecs = await tx.workflowExecution.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const we of sourceExecs) {
        const exists = await tx.workflowExecution.findUnique({
          where: {
            campaignId_profileId: {
              campaignId: we.campaignId,
              profileId: targetProfileId,
            },
          },
        });
        if (exists) {
          await tx.workflowExecution.delete({ where: { id: we.id } });
        } else {
          await tx.workflowExecution.update({
            where: { id: we.id },
            data: { profileId: targetProfileId },
          });
        }
      }
      moved.workflowExecution = sourceExecs.length;

      // 8. workflowActionLog
      const walResult = await tx.workflowActionLog.updateMany({
        where: { profileId: sourceProfileId },
        data: { profileId: targetProfileId },
      });
      moved.workflowActionLog = walResult.count;

      // 9. vaultSecret (unique: workspaceId + profileId + key)
      const sourceSecrets = await tx.vaultSecret.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const vs of sourceSecrets) {
        const exists = await tx.vaultSecret.findFirst({
          where: {
            workspaceId: vs.workspaceId,
            profileId: targetProfileId,
            key: vs.key,
          },
        });
        if (exists) {
          await tx.vaultSecret.delete({ where: { id: vs.id } });
        } else {
          await tx.vaultSecret.update({
            where: { id: vs.id },
            data: { profileId: targetProfileId },
          });
        }
      }
      moved.vaultSecret = sourceSecrets.length;

      // 10. message
      const msgResult = await tx.message.updateMany({
        where: { profileId: sourceProfileId },
        data: { profileId: targetProfileId },
      });
      moved.message = msgResult.count;

      // 11. profileOrganization (composite PK: profileId + organizationId)
      const sourceOrgs = await tx.profileOrganization.findMany({
        where: { profileId: sourceProfileId },
      });
      for (const po of sourceOrgs) {
        const exists = await tx.profileOrganization.findUnique({
          where: {
            profileId_organizationId: {
              profileId: targetProfileId,
              organizationId: po.organizationId,
            },
          },
        });
        if (!exists) {
          await tx.profileOrganization.create({
            data: {
              profileId: targetProfileId,
              organizationId: po.organizationId,
            },
          });
        }
        await tx.profileOrganization.delete({
          where: {
            profileId_organizationId: {
              profileId: sourceProfileId,
              organizationId: po.organizationId,
            },
          },
        });
      }
      moved.profileOrganization = sourceOrgs.length;

      // 12. Archive source profile
      await tx.profile.update({
        where: { id: sourceProfileId },
        data: { isArchived: true },
      });
    });

    return {
      targetProfileId,
      sourceProfileId,
      movedRecords: moved,
    };
  }

  // ── Internals (mockable seam) ──────────────────────────────

  /** Wrapper around @mysten/sui verify — easy to mock in tests. */
  async verifySignature(message: string, signature: string): Promise<string> {
    const { verifyPersonalMessageSignature } =
      await import('@mysten/sui/verify');
    const messageBytes = new TextEncoder().encode(message);
    const publicKey = await verifyPersonalMessageSignature(
      messageBytes,
      signature,
    );
    return publicKey.toSuiAddress();
  }

  private validateMessage(message: string, profileId: string): void {
    // Expected: ROSMAR_CLAIM:<profileId>:<timestamp>
    const parts = message.split(':');
    if (parts.length !== 3 || parts[0] !== MESSAGE_PREFIX) {
      throw new BadRequestException(
        `Invalid message format. Expected ${MESSAGE_PREFIX}:<profileId>:<timestamp>`,
      );
    }
    if (parts[1] !== profileId) {
      throw new BadRequestException(
        'Message profileId does not match the target profile',
      );
    }
    const timestamp = Number(parts[2]);
    if (Number.isNaN(timestamp)) {
      throw new BadRequestException('Invalid timestamp in message');
    }
    const age = Date.now() - timestamp;
    if (age < 0 || age > MESSAGE_TTL_MS) {
      throw new BadRequestException(
        'Message expired or has a future timestamp',
      );
    }
  }
}
