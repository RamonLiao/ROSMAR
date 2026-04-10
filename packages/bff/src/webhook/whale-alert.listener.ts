import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import type { WhaleThreshold } from '../workspace/workspace.service';
import type { IndexerEventDto } from './indexer-event.dto';

@Injectable()
export class WhaleAlertListener {
  private readonly logger = new Logger(WhaleAlertListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Handle explicit WhaleAlert events from the indexer (backwards compat) */
  @OnEvent('indexer.event.WhaleAlert')
  async handleWhaleAlert(event: IndexerEventDto) {
    const { amount, token, tx_type } = event.data as {
      amount: number;
      token: string;
      tx_type: string;
    };

    const workspaceId = await this.resolveWorkspaceId(event.profile_id);

    this.logger.warn(
      `Whale alert: ${event.address} — ${amount} ${token} (${tx_type})`,
    );

    await this.createWhaleNotification(
      workspaceId,
      event,
      amount,
      token,
      tx_type,
    );
  }

  /** Check ALL indexer events against workspace whale thresholds */
  @OnEvent('indexer.event')
  async handleGenericEvent(event: IndexerEventDto) {
    const { amount, token } = event.data as {
      amount?: number;
      token?: string;
    };

    if (!amount || !token) return;

    const workspaceId = await this.resolveWorkspaceId(event.profile_id);
    if (!workspaceId) return;

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { whaleThresholds: true },
    });

    const thresholds = (ws?.whaleThresholds as WhaleThreshold[] | null) ?? [];
    if (thresholds.length === 0) return;

    const match = thresholds.find(
      (t) =>
        t.token.toUpperCase() === token.toUpperCase() && amount >= t.amount,
    );
    if (!match) return;

    const txType = event.data.tx_type as string | undefined;

    this.logger.warn(
      `Threshold whale alert: ${event.address} — ${amount} ${token} (threshold: ${match.amount})`,
    );

    await this.createWhaleNotification(
      workspaceId,
      event,
      amount,
      token,
      txType ?? event.event_type,
    );
  }

  private async createWhaleNotification(
    workspaceId: string,
    event: IndexerEventDto,
    amount: number,
    token: string,
    txType: string,
  ) {
    await this.notificationService.create({
      workspaceId,
      userId: event.profile_id ?? event.address,
      type: 'whale_alert',
      title: `Whale Alert: ${this.formatAmount(amount)} ${token}`,
      body: `Address ${this.truncateAddress(event.address)} executed a ${txType} of ${this.formatAmount(amount)} ${token}`,
      metadata: {
        address: event.address,
        amount,
        token,
        txType,
        txDigest: event.tx_digest,
        profileId: event.profile_id,
      },
    });

    this.eventEmitter.emit('whale_alert', {
      event_id: `whale-${Date.now()}`,
      event_type: 'whale_alert',
      address: event.data?.address ?? event.address,
      profile_id: event.profile_id,
      data: {
        token,
        amount,
        txType,
        txDigest: event.tx_digest,
        workspaceId,
      },
      timestamp: Date.now(),
    });
  }

  private async resolveWorkspaceId(profileId?: string): Promise<string> {
    if (!profileId) return '';
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { workspaceId: true },
    });
    return profile?.workspaceId ?? '';
  }

  private formatAmount(n: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(n);
  }

  private truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
}
