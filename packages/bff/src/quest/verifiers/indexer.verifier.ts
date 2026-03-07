import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StepVerifier } from './step-verifier.interface';

@Injectable()
export class IndexerVerifier implements StepVerifier {
  constructor(private readonly prisma: PrismaService) {}

  async verify(
    profileId: string,
    step: { actionType: string; actionConfig: Record<string, unknown> },
    claimData: Record<string, unknown>,
  ): Promise<{ verified: boolean; txDigest?: string }> {
    // Look up matching wallet event from the indexer
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { primaryAddress: true },
    });

    if (!profile) {
      return { verified: false };
    }

    const event = await this.prisma.walletEvent.findFirst({
      where: {
        address: profile.primaryAddress,
        eventType: step.actionType,
        ...(step.actionConfig.contractAddress
          ? { contractAddress: step.actionConfig.contractAddress as string }
          : {}),
      },
      orderBy: { time: 'desc' },
    });

    if (!event) {
      return { verified: false };
    }

    return { verified: true, txDigest: event.txDigest };
  }
}
