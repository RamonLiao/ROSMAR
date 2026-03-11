import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SuiClientService } from './sui.client';
import { EnokiSponsorService } from './enoki-sponsor.service';

interface WalletConnectedEvent {
  event_id: string;
  event_type: string;
  address: string;
  profile_id?: string;
  data: Record<string, unknown>;
  tx_digest: string;
  timestamp: number;
}

@Injectable()
export class GasSponsorListener {
  private readonly logger = new Logger(GasSponsorListener.name);
  private gasSponsorEnabled: boolean;
  private thresholdMist: bigint;

  constructor(
    private readonly suiClient: SuiClientService,
    private readonly prisma: PrismaService,
    private readonly enokiSponsor: EnokiSponsorService,
    private readonly configService: ConfigService,
  ) {
    this.gasSponsorEnabled =
      this.configService.get<string>('GAS_SPONSOR_ENABLED', 'false') === 'true';
    // Default: 0.1 SUI = 100_000_000 MIST
    this.thresholdMist = BigInt(
      this.configService.get<string>('GAS_SPONSOR_THRESHOLD_MIST', '100000000'),
    );
  }

  @OnEvent('indexer.event.wallet_connected')
  async handleWalletConnected(event: WalletConnectedEvent): Promise<void> {
    if (!this.gasSponsorEnabled) {
      return;
    }

    if (!this.enokiSponsor.isEnabled) {
      this.logger.warn('Gas sponsor triggered but Enoki is not configured');
      return;
    }

    const { address, profile_id, data } = event;
    const workspaceId = data.workspaceId as string;

    if (!workspaceId || !profile_id) {
      return;
    }

    try {
      const balanceResult = await this.suiClient.getClient().getBalance({
        owner: address,
      });

      const balance = BigInt(balanceResult.totalBalance);

      if (balance < this.thresholdMist) {
        this.logger.log(
          `Low balance detected for ${address}: ${balance} MIST (threshold: ${this.thresholdMist})`,
        );

        // Rate-limit check (in-memory, resets on restart)
        const todayKey = `${address}:${new Date().toISOString().slice(0, 10)}`;
        const grantsToday = GasSponsorListener.grantCountCache.get(todayKey) ?? 0;
        const maxPerDay = this.configService.get<number>('GAS_SPONSOR_MAX_PER_DAY', 5);

        if (grantsToday >= maxPerDay) {
          this.logger.warn(
            `Gas sponsor rate limit reached for ${address} (${grantsToday}/${maxPerDay} today)`,
          );
          await this.createNotification(
            workspaceId,
            profile_id,
            address,
            'gas_sponsor_rate_limited',
            'Daily gas sponsor limit reached',
          );
          return;
        }

        // Record the grant
        GasSponsorListener.grantCountCache.set(todayKey, grantsToday + 1);
        this.logger.log(
          `Gas sponsorship pre-approved for ${address} (${grantsToday + 1}/${maxPerDay} today)`,
        );

        await this.createNotification(
          workspaceId,
          profile_id,
          address,
          'gas_sponsor_activated',
          'Gas sponsorship activated for next transaction',
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to check balance for ${address}: ${error.message}`,
        error.stack,
      );
    }
  }

  // TODO: Replace with Prisma GasSponsorGrant model when ready
  private static grantCountCache = new Map<string, number>();

  private async createNotification(
    workspaceId: string,
    userId: string | undefined,
    address: string,
    type: string,
    title: string,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          workspaceId,
          userId: userId ?? address,
          type,
          title,
          body: `Wallet ${address.slice(0, 8)}...${address.slice(-4)}: ${title}`,
          metadata: { address },
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to create notification: ${err.message}`);
    }
  }
}
