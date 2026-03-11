import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProfileWallet } from '@prisma/client';

const MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MESSAGE_PREFIX = 'ROSMAR_CLAIM';

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

  // ── Internals (mockable seam) ──────────────────────────────

  /** Wrapper around @mysten/sui verify — easy to mock in tests. */
  async verifySignature(message: string, signature: string): Promise<string> {
    const { verifyPersonalMessageSignature } = await import(
      '@mysten/sui/verify'
    );
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
