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
  private readonly fallbackThresholdMist: bigint;
  private readonly fallbackMaxPerDay: number;

  constructor(
    private readonly suiClient: SuiClientService,
    private readonly prisma: PrismaService,
    private readonly enokiSponsor: EnokiSponsorService,
    private readonly configService: ConfigService,
  ) {
    this.gasSponsorEnabled =
      this.configService.get<string>('GAS_SPONSOR_ENABLED', 'false') === 'true';
    this.fallbackThresholdMist = BigInt(
      this.configService.get<string>('GAS_SPONSOR_THRESHOLD_MIST', '100000000'),
    );
    this.fallbackMaxPerDay = Number(
      this.configService.get<string>('GAS_SPONSOR_MAX_PER_DAY', '5'),
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
      // 1. Load per-workspace config (fallback to env vars)
      const wsConfig = await this.prisma.workspaceGasConfig.findUnique({
        where: { workspaceId },
      });

      const enabled = wsConfig?.enabled ?? true; // env-var already checked above
      if (wsConfig && !enabled) return;

      const thresholdMist = wsConfig?.thresholdMist ?? this.fallbackThresholdMist;
      const maxPerDay = wsConfig?.dailyLimit ?? this.fallbackMaxPerDay;

      // 2. Check balance
      const balanceResult = await this.suiClient.getClient().getBalance({
        owner: address,
      });
      const balance = BigInt(balanceResult.totalBalance);

      if (balance >= thresholdMist) return;

      this.logger.log(
        `Low balance detected for ${address}: ${balance} MIST (threshold: ${thresholdMist})`,
      );

      // 3. DB-based rate-limit check
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const grantsToday = await this.prisma.gasSponsorGrant.count({
        where: {
          workspaceId,
          address,
          grantedAt: { gte: startOfDay },
        },
      });

      if (grantsToday >= maxPerDay) {
        this.logger.warn(
          `Gas sponsor rate limit reached for ${address} (${grantsToday}/${maxPerDay} today)`,
        );
        await this.createNotification(
          workspaceId, profile_id, address,
          'gas_sponsor_rate_limited', 'Daily gas sponsor limit reached',
        );
        return;
      }

      // 4. Record grant in DB
      await this.prisma.gasSponsorGrant.create({
        data: { workspaceId, address, profileId: profile_id },
      });

      this.logger.log(
        `Gas sponsorship pre-approved for ${address} (${grantsToday + 1}/${maxPerDay} today)`,
      );

      await this.createNotification(
        workspaceId, profile_id, address,
        'gas_sponsor_activated', 'Gas sponsorship activated for next transaction',
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to check balance for ${address}: ${error.message}`,
        error.stack,
      );
    }
  }

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
