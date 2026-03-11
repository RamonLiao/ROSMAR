import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EscrowService } from './escrow.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DealEventListener {
  private readonly logger = new Logger(DealEventListener.name);

  constructor(
    private readonly escrowService: EscrowService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('deal.stage_changed')
  async handleStageChange(payload: {
    dealId: string;
    stage: string;
    workspaceId: string;
  }) {
    if (payload.stage !== 'closed_won') return;

    const escrow = await this.escrowService.getEscrowByDealId(payload.dealId);
    if (!escrow || escrow.state !== 'FUNDED') return;

    try {
      const remaining =
        Number(escrow.totalAmount) - Number(escrow.releasedAmount);
      await this.escrowService.release(escrow.id, remaining);

      this.logger.log(
        `Auto-released escrow ${escrow.id} for deal ${payload.dealId}`,
      );

      await this.notificationService
        .create({
          workspaceId: payload.workspaceId,
          userId: 'system',
          type: 'escrow_auto_released',
          title: 'Escrow auto-released for closed won deal',
          metadata: { dealId: payload.dealId, escrowId: escrow.id },
        })
        .catch(() => {});
    } catch (err: any) {
      this.logger.error(`Failed to auto-release escrow: ${err.message}`);
    }
  }
}
