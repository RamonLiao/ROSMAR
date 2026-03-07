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

        await this.prisma.notification.create({
          data: {
            workspaceId,
            userId: profile_id,
            type: 'gas_sponsor_flagged',
            title: 'Low SUI balance detected',
            body: `Wallet ${address.slice(0, 8)}...${address.slice(-4)} has ${Number(balance) / 1e9} SUI. Gas sponsorship will be applied on next transaction.`,
            metadata: {
              address,
              profileId: profile_id,
              balanceMist: balance.toString(),
              thresholdMist: this.thresholdMist.toString(),
            },
          },
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to check balance for ${address}: ${error.message}`,
        error.stack,
      );
    }
  }
}
