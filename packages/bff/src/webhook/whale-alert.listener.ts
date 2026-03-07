import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification/notification.service';
import type { IndexerEventDto } from './indexer-event.dto';

@Injectable()
export class WhaleAlertListener {
  private readonly logger = new Logger(WhaleAlertListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('indexer.event.WhaleAlert')
  async handleWhaleAlert(event: IndexerEventDto) {
    const { amount, token, tx_type } = event.data as {
      amount: number;
      token: string;
      tx_type: string;
    };

    this.logger.warn(
      `Whale alert: ${event.address} — ${amount} ${token} (${tx_type})`,
    );

    await this.notificationService.create({
      workspaceId: '',
      userId: event.profile_id ?? event.address,
      type: 'whale_alert',
      title: `Whale Alert: ${this.formatAmount(amount)} ${token}`,
      body: `Address ${this.truncateAddress(event.address)} executed a ${tx_type} of ${this.formatAmount(amount)} ${token}`,
      metadata: {
        address: event.address,
        amount,
        token,
        txType: tx_type,
        txDigest: event.tx_digest,
        profileId: event.profile_id,
      },
    });
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
