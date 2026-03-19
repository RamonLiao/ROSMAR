import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EngagementService } from '../engagement/engagement.service';
import type { IndexerEventDto } from './indexer-event.dto';

@Injectable()
export class EventIngestListener {
  private readonly logger = new Logger(EventIngestListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engagementService: EngagementService,
  ) {}

  @OnEvent('indexer.event')
  async handleEvent(event: IndexerEventDto): Promise<void> {
    try {
      // Resolve profile: prefer explicit profile_id, else lookup by address
      let profileId = event.profile_id;
      let workspaceId: string | undefined;

      if (!profileId) {
        const profile = await this.prisma.profile.findFirst({
          where: { wallets: { some: { address: event.address } } },
          select: { id: true, workspaceId: true },
        });
        if (!profile) return; // no matching profile — skip silently
        profileId = profile.id;
        workspaceId = profile.workspaceId;
      } else {
        const profile = await this.prisma.profile.findUnique({
          where: { id: profileId },
          select: { workspaceId: true },
        });
        workspaceId = profile?.workspaceId ?? undefined;
      }

      const { collection, token, amount, contract_address } = event.data as {
        collection?: string;
        token?: string;
        amount?: number;
        contract_address?: string;
      };

      await this.prisma.walletEvent.create({
        data: {
          time: new Date(event.timestamp),
          address: event.address,
          eventType: event.event_type,
          collection: collection ?? null,
          token: token ?? null,
          amount: amount ?? null,
          txDigest: event.tx_digest,
          contractAddress: contract_address ?? null,
          rawData: event.data as object,
          profileId,
          workspaceId: workspaceId ?? null,
        },
      });

      if (profileId && workspaceId) {
        await this.engagementService.recalculateAndPersist(
          profileId,
          workspaceId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to ingest event ${event.event_id}: ${error.message}`,
        error.stack,
      );
    }
  }
}
